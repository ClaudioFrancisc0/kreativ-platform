const puppeteer = require('puppeteer');

class InstagramService {
    constructor() {
        this.browser = null;
    }

    async init() {
        if (this.browser && !this.browser.isConnected()) {
            this.browser = null;
        }

        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: "new",
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu'
                ]
            });
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async checkProfile(username) {
        if (!this.browser) await this.init();

        let page = null;
        try {
            try {
                page = await this.browser.newPage();
            } catch (pageError) {
                console.error('Error creating new page:', pageError);
                // Try to re-init browser once
                await this.close();
                await this.init();
                page = await this.browser.newPage();
            }

            // Randomize User Agent to avoid detection
            const userAgents = [
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ];
            const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
            await page.setUserAgent(ua);

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            });

            const response = await Promise.race([
                page.goto(`https://www.instagram.com/${username}/`, {
                    waitUntil: 'domcontentloaded',
                    timeout: 15000
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Navigation timeout')), 20000))
            ]);

            const status = response.status();
            const title = await page.title();

            // Instagram returns 200 even for 404 pages sometimes, but title says "Page Not Found"
            // Also check for specific text in body
            const content = await page.content();
            const isNotFound = title.includes('Page Not Found') ||
                title.includes('Página não encontrada') ||
                content.includes('Esta página não está disponível') ||
                status === 404;

            if (isNotFound) {
                return { exists: false, username };
            }

            // Extract basic info if exists
            const bio = await page.evaluate(() => {
                const meta = document.querySelector('meta[name="description"]');
                return meta ? meta.content : '';
            });

            return {
                exists: true,
                username,
                title,
                bio,
                url: `https://www.instagram.com/${username}/`
            };

        } catch (error) {
            console.error(`Error checking IG ${username}:`, error.message);
            // If timeout or other error, assume we couldn't verify (maybe blocked)
            // Return error but don't crash
            return { error: true, username, message: error.message };
        } finally {
            if (page) await page.close().catch(e => console.error('Error closing page:', e));
        }
    }

    async verifyName(name) {
        // Normalize and split name
        const cleanName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, "");
        const parts = cleanName.split(/\s+/).filter(p => p.length > 0);

        // Limit to 3 parts for now
        const activeParts = parts.slice(0, 3);

        const variations = new Set();

        // 1. Base variations (joined, dot, underscore)
        if (activeParts.length === 1) {
            variations.add(activeParts[0]);
        } else {
            // Generate separator combinations
            const separators = ['', '_'];

            // Helper to generate combinations recursively
            const combine = (currentParts, currentSep) => {
                return currentParts.join(currentSep);
            };

            // Add all separator styles
            separators.forEach(sep => {
                variations.add(combine(activeParts, sep));
            });
        }

        console.log(`Checking variations for "${name}":`, [...variations]);

        const results = [];
        for (const variant of variations) {
            const result = await this.checkProfile(variant);
            results.push(result);

            // Small random delay to avoid block (1-2 seconds)
            const delay = Math.floor(Math.random() * 1000) + 1000;
            await new Promise(r => setTimeout(r, delay));
        }

        return this.analyzeResults(name, results);
    }

    analyzeResults(originalName, results) {
        // Filter out errors
        const validResults = results.filter(r => !r.error);

        // Find exact matches (profiles that exist)
        const foundProfiles = validResults.filter(r => r.exists);

        let score = 'green';
        let summary = 'Nenhum perfil exato encontrado';

        if (foundProfiles.length > 0) {
            score = 'red';
            const usernames = foundProfiles.map(p => '@' + p.username).join(', ');
            summary = `Encontrados: ${usernames}`;
        }

        return {
            source: 'instagram',
            score,
            summary,
            details: results // Return all results, including non-existing ones if needed for debug
        };
    }
}

module.exports = new InstagramService();
