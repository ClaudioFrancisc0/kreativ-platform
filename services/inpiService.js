const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const configService = require('./configService');

class InpiService {
    async checkAvailability(name, nclClasses) {
        console.log(`[INPI] Starting check for: ${name} (Classes: ${nclClasses.join(', ')})`);

        let browser = null;
        let finalResults = [];

        try {
            // Get credentials from config
            const credentials = await configService.getInpiCredentials();
            if (!credentials || !credentials.username || !credentials.password) {
                return {
                    status: 'error',
                    details: 'Credenciais do INPI não configuradas. Acesse o Dashboard para configurar.'
                };
            }

            browser = await puppeteer.launch({
                headless: "new",
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                ignoreHTTPSErrors: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--window-size=1280,800',
                    '--disable-gpu'
                ]
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Initial Navigation with retry
            const searchUrl = 'https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp';
            let navSuccess = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`[INPI] Navigation attempt ${attempt}...`);
                    await page.goto(searchUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 30000
                    });
                    navSuccess = true;
                    break;
                } catch (e) {
                    console.log(`[INPI] Attempt ${attempt} failed:`, e.message);
                    if (attempt < 3) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }

            if (!navSuccess) {
                return {
                    status: 'error',
                    details: 'Não foi possível acessar o site do INPI após 3 tentativas. Verifique sua conexão.'
                };
            }

            // Handle Login if needed
            await this.handleLogin(page, credentials);

            // Loop through each class
            for (const nclClass of nclClasses) {
                console.log(`[INPI] Checking Class: ${nclClass}`);

                // Navigate back to search for each attempt to clear state
                // Only if not already there (optimization to avoid reload loop if inputs are present)
                const isSearchPage = await this.isSearchPage(page);
                if (!isSearchPage) {
                    await page.goto('https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp', { waitUntil: 'domcontentloaded' });
                }

                const result = await this.performSearch(page, name, nclClass);
                finalResults.push({
                    class: nclClass,
                    ...result
                });

                // Small delay between searches
                await new Promise(r => setTimeout(r, 2000));
            }

            return this.analyzeFinalResults(finalResults);

        } catch (error) {
            console.error('[INPI] Global Service Error:', error);
            // Return failure state but preserve any partial results if needed (for now, full error)
            return {
                status: 'error',
                details: `Erro no serviço INPI: ${error.message}`,
                partialResults: finalResults
            };
        } finally {
            if (browser) await browser.close();
        }
    }

    async isSearchPage(page) {
        try {
            return await page.evaluate(() => {
                const hasInput = document.querySelector('input[name="marca"]') || document.querySelector('input[name="expressaoPesquisa"]');
                const hasTitle = document.body.innerText.includes("Pesquisa básica");
                return !!(hasInput || hasTitle);
            });
        } catch { return false; }
    }

    async handleLogin(page, credentials) {
        // Quick check for login fields
        const loginSelectors = ['input[type="password"]', 'input[name*="senha"]', 'input[name="j_password"]'];
        let needsLogin = false;

        for (const sel of loginSelectors) {
            if (await page.$(sel)) { needsLogin = true; break; }
        }

        if (needsLogin) {
            console.log("[INPI] Login required. Authenticating...");

            // Try to find user input
            const userSelectors = ['input[name*="user"]', 'input[name*="login"]', 'input[type="text"]'];
            let userInput = null;
            for (const sel of userSelectors) {
                userInput = await page.$(sel);
                if (userInput) break;
            }

            // Find password input
            let passInput = await page.$('input[type="password"]');

            if (userInput && passInput) {
                // Clear and type
                await userInput.click({ clickCount: 3 });
                await userInput.type(credentials.username);

                await passInput.click({ clickCount: 3 });
                await passInput.type(credentials.password);

                const submitBtn = await page.$('input[type="submit"], button[type="submit"]');
                if (submitBtn) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log('Login Nav timeout')),
                        submitBtn.click()
                    ]);
                } else {
                    await passInput.press('Enter');
                    await page.waitForNavigation({ waitUntil: 'domcontentloaded' }).catch(e => console.log('Login Nav timeout'));
                }

                // Force return to search URL after login just in case
                await page.goto('https://busca.inpi.gov.br/pePI/jsp/marcas/Pesquisa_classe_basica.jsp', { waitUntil: 'domcontentloaded' });
            } else {
                throw new Error("Login fields not found");
            }
        }
    }

    async performSearch(page, name, nclClass) {
        // Find Inputs (Brand and Class)
        let targetFrame = page;
        // Search in frames if needed (INPI uses frames heavily)
        const frame = page.frames().find(f => f.name() === 'main' || f.url().includes('Pesquisa_classe_basica'));
        if (frame) {
            targetFrame = frame;
            console.log('[INPI] Found target frame');
        }

        // Try multiple selectors for the brand input
        const nameInput = await targetFrame.$('input[name="marca"], input[name="expressaoPesquisa"]');
        if (!nameInput) {
            console.log("[INPI] Search input not found for this attempt.");
            return { status: 'error', details: 'Campo de busca não encontrado' };
        }

        // Fill Brand Name
        console.log(`[INPI] Filling brand name: "${name}"`);
        await nameInput.click({ clickCount: 3 });
        await nameInput.type(name);

        // Try multiple selectors for the class input
        // INPI uses "classeInter" as the field name (discovered via DOM inspection)
        const classSelectors = [
            'input[name="classeInter"]',  // Correct field name for INPI
            'input[name="classe"]',
            'input[name="classificacao"]',
            'input[name="nclasse"]',
            'input[name="classeNice"]',
            'input[name="classeNCL"]'
        ];

        let classInput = null;
        for (const selector of classSelectors) {
            classInput = await targetFrame.$(selector);
            if (classInput) {
                console.log(`[INPI] Found class input with selector: ${selector}`);
                break;
            }
        }

        if (classInput) {
            console.log(`[INPI] Filling class: "${nclClass}"`);
            await classInput.click({ clickCount: 3 });
            await classInput.type(nclClass.toString());
        } else {
            console.log("[INPI] WARNING: Class input NOT FOUND! Searching without class filter.");
            // Log all input names for debugging
            const allInputs = await targetFrame.$$eval('input', inputs =>
                inputs.map(i => ({ name: i.name, type: i.type, id: i.id }))
            );
            console.log('[INPI] Available inputs:', JSON.stringify(allInputs));
        }

        // Submit
        const searchBtn = await targetFrame.$('input[type="submit"], a[href*="pesquisar"]');
        if (searchBtn) {
            console.log('[INPI] Clicking search button...');
            await Promise.all([
                targetFrame.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(e => { }),
                searchBtn.click()
            ]);
        } else {
            console.log("[INPI] Search button not found");
            return { status: 'error', details: 'Botão pesquisar não encontrado' };
        }

        // Extract Results
        return await this.extractResults(page);
    }

    async extractResults(page) {
        // Check for specific "No results" messages
        const bodyText = await page.evaluate(() => document.body.innerText);
        console.log('[INPI] Body text length:', bodyText.length);

        if (bodyText.includes("Nenhum registro encontrado") || bodyText.includes("Não foram encontrados")) {
            return {
                status: 'LIVRE',
                details: 'Nenhum registro encontrado.',
                processes: []
            };
        }

        // Check for "processos que satisfazem" which indicates results were found
        const resultsMatch = bodyText.match(/(\d+)\s*processos?\s*que\s*satisfaz/i);
        console.log('[INPI] Results match:', resultsMatch ? resultsMatch[1] : 'none');

        // Scrape Table - try main page first, then frames
        let data = await this.scrapeTable(page);
        console.log('[INPI] Main page results:', data.length);

        // If no results on main page, try frames
        if (data.length === 0) {
            for (const frame of page.frames()) {
                try {
                    const frameData = await this.scrapeTable(frame);
                    console.log('[INPI] Frame results:', frameData.length);
                    if (frameData.length > 0) {
                        data = frameData;
                        break;
                    }
                } catch (e) {
                    console.log('[INPI] Frame error:', e.message);
                }
            }
        }

        console.log('[INPI] Total extracted:', data.length);

        if (data.length > 0) {
            // Determine status based on situação values
            const allInactive = data.every(d =>
                d.situacao.toLowerCase().includes('extinto') ||
                d.situacao.toLowerCase().includes('arquivado') ||
                d.situacao.toLowerCase().includes('indeferido')
            );

            let status = 'OCUPADO';
            if (allInactive) {
                status = 'VERIFICAR';
            }

            return {
                status: status,
                details: `${data.length} processos encontrados.`,
                processes: data
            };
        }

        // Fallback
        return {
            status: 'LIVRE',
            details: 'Nenhum registro estruturado encontrado.',
            processes: []
        };
    }

    async scrapeTable(frameOrPage) {
        return await frameOrPage.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('tr'));
            const results = [];

            rows.forEach((row, idx) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 4) {
                    const cellTexts = Array.from(cells).map(c => c.innerText.trim());

                    // Look for process number pattern anywhere in the row
                    const rowText = cellTexts.join(' ');
                    const processMatch = rowText.match(/(\d{9})/);

                    if (processMatch) {
                        // Try to identify each column by content patterns
                        let processNumber = processMatch[1];
                        let prioridade = '';
                        let marca = '';
                        let situacao = '';
                        let titular = '';
                        let classe = '';

                        cellTexts.forEach((text, i) => {
                            // Date pattern (dd/mm/yyyy)
                            if (/^\d{2}\/\d{2}\/\d{4}$/.test(text) && !prioridade) {
                                prioridade = text;
                            }
                            // Class pattern (number : number or NCL(number) number)
                            else if (/^\d+\s*:\s*\d+$/.test(text) || /^NCL\(/i.test(text)) {
                                classe = text;
                            }
                            // Situação keywords
                            else if (/extinto|arquivado|vigente|exame|aguardando|indeferido|pedido|registro/i.test(text)) {
                                situacao = text;
                            }
                            // Process number (already captured)
                            else if (/^\d{9,}$/.test(text.replace(/\D/g, '').slice(0, 9))) {
                                // skip, already got it
                            }
                            // If it's a substantial text without digits, might be marca or titular
                            else if (text.length > 1 && !/^\d+$/.test(text)) {
                                if (!marca) {
                                    marca = text;
                                } else if (!titular) {
                                    titular = text;
                                }
                            }
                        });

                        // Only add if we have at least marca
                        if (marca && marca.length > 0) {
                            results.push({
                                processNumber: processNumber,
                                prioridade: prioridade,
                                brandName: marca,
                                situacao: situacao,
                                holder: titular,
                                classe: classe,
                                raw: cellTexts.join(' | ')
                            });
                        }
                    }
                }
            });
            return results;
        });
    }
    analyzeFinalResults(results) {
        // Consolidate per class results into one object
        // For simple output from checkAvailability
        return {
            source: 'inpi',
            classes: results // full details per class
        };
    }
}

module.exports = new InpiService();
