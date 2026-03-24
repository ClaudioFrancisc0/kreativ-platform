const instagramService = require('./instagramService');
const inpiService = require('./inpiService');
const googleService = require('./googleService');
const ExcelJS = require('exceljs');

class NamingService {
    constructor() {
        this.activeVerifications = new Map();
    }

    startVerification(userId, config) {
        const verificationId = `ver_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const verification = {
            id: verificationId,
            userId,
            config,
            status: 'pending',
            progress: {
                current: 0,
                total: config.names.length,
                currentName: null,
                currentStep: null // 'instagram', 'google', 'inpi'
            },
            results: [],
            startedAt: new Date().toISOString(),
            completedAt: null
        };

        this.activeVerifications.set(verificationId, verification);

        // Start processing in background
        this.processVerification(verificationId);

        return verificationId;
    }

    async processVerification(verificationId) {
        const verification = this.activeVerifications.get(verificationId);
        if (!verification) return;

        verification.status = 'running';

        try {
            // Initialize services
            await instagramService.init();

            for (let i = 0; i < verification.config.names.length; i++) {
                // Check if cancelled
                if (verification.status === 'cancelled') break;

                const name = verification.config.names[i];
                verification.progress.current = i;
                verification.progress.currentName = name;

                try {
                    // 1. INPI Verification
                    verification.progress.currentStep = 'inpi';
                    let inpiResult;
                    if (verification.config.inpiClasses && verification.config.inpiClasses.length > 0) {
                        const checkResult = await inpiService.checkAvailability(name, verification.config.inpiClasses);
                        // Map result to score (LIVRE->green, OCUPADO->red, etc.)
                        // logic: error -> red, LIVRE -> green, OCUPADO -> red
                        let score = 'green';
                        if (checkResult.status === 'error') score = 'red';
                        // We need a more nuanced score. 
                        // Any class occupied -> RED overall for INPI? Or Yellow?
                        // Let's iterate classes: if any occupied -> RED. If only pending -> YELLOW. All free -> GREEN.

                        let hasOccupied = false;
                        let hasPending = false; // logic TBD if used

                        let classes = checkResult.classes || [];

                        // If error in global service, ensure we have a detail to show
                        if (checkResult.status === 'error') {
                            score = 'red';
                            if (classes.length === 0) {
                                classes.push({
                                    class: 'ERRO',
                                    status: 'ERRO',
                                    details: checkResult.details || 'Erro desconhecido no serviço INPI',
                                    processes: []
                                });
                            }
                        }

                        const occupiedClasses = classes.filter(c => c.status === 'OCUPADO');
                        const verifyClasses = classes.filter(c => c.status === 'VERIFICAR');

                        if (occupiedClasses.length > 0) score = 'red';
                        else if (verifyClasses.length > 0) score = 'yellow';

                        inpiResult = {
                            source: 'inpi',
                            score: score,
                            details: classes
                        };
                    } else {
                        inpiResult = { source: 'inpi', score: 'green', summary: 'Nenhuma classe selecionada' };
                    }

                    // 2. Google Verification
                    verification.progress.currentStep = 'google';
                    let googleResult;
                    try {
                        googleResult = await googleService.search(name, verification.config.keywords);

                        // Analyze results for Scoring
                        let foundRedAndYellow = false;
                        let foundAnyMatch = false;

                        if (googleResult.results && googleResult.results.length > 0) {
                            for (const item of googleResult.results) {
                                const textToAnalyze = (item.title + ' ' + (item.snippet || '')).trim();
                                // Use the new helper to find matches
                                const matches = this.parseTextForMatches(textToAnalyze, name, verification.config.keywords);

                                const hasRedItem = matches.some(m => m.type === 'match-red');
                                const hasYellowItem = matches.some(m => m.type === 'match-yellow');

                                if (hasRedItem && hasYellowItem) foundRedAndYellow = true;
                                if (hasRedItem || hasYellowItem) foundAnyMatch = true;
                            }
                        }

                        // Score Logic:
                        // 1. Red AND Yellow in same snippet -> Red (OCUPADO)
                        // 2. Red OR Yellow -> Yellow (VERIFICAR)
                        // 3. None -> Green (LIVRE)
                        if (foundRedAndYellow) {
                            googleResult.score = 'red';
                            googleResult.status = 'OCUPADO';
                        } else if (foundAnyMatch) {
                            googleResult.score = 'yellow';
                            googleResult.status = 'VERIFICAR';
                        } else {
                            googleResult.score = 'green';
                            googleResult.status = 'LIVRE';
                        }

                    } catch (e) {
                        console.error('Google search error:', e);
                        googleResult = { source: 'google', score: 'green', status: 'LIVRE', results: [] };
                    }

                    // 3. Instagram Verification
                    verification.progress.currentStep = 'instagram';
                    const igResult = await instagramService.verifyName(name);

                    // Aggregate results
                    const result = {
                        name,
                        inpi: inpiResult,
                        google: googleResult,
                        instagram: igResult,
                        // Calculate general score
                        // Pass INPI separate from others
                        generalScore: this.calculateGeneralScore(inpiResult.score, [igResult.score, googleResult.score])
                    };

                    verification.results.push(result);

                } catch (itemError) {
                    console.error(`Error processing name "${name}":`, itemError);
                    // Push error result so it appears in the final list
                    verification.results.push({
                        name,
                        inpi: { score: 'red', status: 'ERRO', details: [{ class: 'GERAL', status: 'ERRO', details: itemError.message }] },
                        google: { score: 'red', status: 'ERRO', details: 'Erro ao processar' },
                        instagram: { score: 'red', summary: 'Erro ao processar' },
                        generalScore: 'red'
                    });
                }
            }

            if (verification.status !== 'cancelled') {
                verification.status = 'completed';
                verification.completedAt = new Date().toISOString();
                verification.progress.current = verification.config.names.length;
                verification.progress.currentName = 'Concluído';
                verification.progress.currentStep = 'done';
            }

        } catch (error) {
            console.error(`Error processing verification ${verificationId}:`, error);
            verification.status = 'error';
            verification.error = error.message;
        }
    }

    calculateGeneralScore(inpiScore, otherScores) {
        // Rule: If INPI is 'green' (LIVRE), the worst we get is 'yellow' (VERIFICAR), unless matched by 'green' globally.
        // If INPI is NOT green, we follow the worst score logic (usually).

        if (inpiScore === 'green') {
            // If INPI is free, we check others.
            // If any other is NOT green, we flag as YELLOW (Verify).
            // We do NOT flag as RED because INPI allows it.
            if (otherScores.some(s => s !== 'green')) return 'yellow';
            return 'green';
        }

        // If INPI is red, it's red.
        if (inpiScore === 'red') return 'red';

        // If INPI is yellow (Verify).
        // If others are red, it's red.
        if (otherScores.includes('red')) return 'red';

        return 'yellow';
    }

    getVerification(verificationId) {
        return this.activeVerifications.get(verificationId);
    }

    cancelVerification(verificationId, userId) {
        const verification = this.activeVerifications.get(verificationId);
        if (!verification) return false;
        if (verification.userId !== userId) return false;

        verification.status = 'cancelled';
        verification.completedAt = new Date().toISOString();
        return true;
    }

    async generateExcel(verificationId) {
        const verification = this.activeVerifications.get(verificationId);
        if (!verification) return null;

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'StudioMe';
        workbook.created = new Date();

        // --- 1. Aba Resumo ---
        const wsSummary = workbook.addWorksheet('Resumo');
        wsSummary.columns = [
            { header: 'Nome', key: 'nome', width: 30 },
            { header: 'Score Geral', key: 'score', width: 20 },
            { header: 'INPI', key: 'inpi', width: 20 },
            { header: 'Google', key: 'google', width: 20 },
            { header: 'Instagram', key: 'instagram', width: 20 }
        ];

        // Headers Style
        wsSummary.getRow(1).font = { bold: true };

        verification.results.forEach(r => {
            const row = wsSummary.addRow({
                nome: r.name,
                score: this.translateScore(r.generalScore),
                inpi: this.translateScore(r.inpi.score),
                google: this.translateScore(r.google.score),
                instagram: this.translateScore(r.instagram.score)
            });

            // Styling Loop for Score Columns (2,3,4,5) -> B,C,D,E
            [2, 3, 4, 5].forEach(colIdx => {
                const cell = row.getCell(colIdx);
                const val = (cell.value || '').toString().toUpperCase();
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

                if (val === 'LIVRE') cell.font = { color: { argb: 'FF008000' }, bold: true }; // Green
                else if (val === 'OCUPADO') cell.font = { color: { argb: 'FFFF0000' }, bold: true }; // Red
                else if (val === 'VERIFICAR') cell.font = { color: { argb: 'FFD4A017' }, bold: true }; // Gold
            });
            // Style Name Column
            const nameCell = row.getCell(1);
            nameCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        });


        // --- 2. Aba INPI ---
        const wsInpi = workbook.addWorksheet('INPI');
        wsInpi.columns = [
            { header: 'Nome', key: 'nome', width: 20 },
            { header: 'Classe Buscada', key: 'classe', width: 15 },
            { header: 'Situação', key: 'situacao', width: 30 },
            { header: 'Marca Encontrada', key: 'marca', width: 35 },
            { header: 'Titular', key: 'titular', width: 40 },
            { header: 'Nº Processo', key: 'processo', width: 20 },
            { header: 'Prioridade', key: 'prioridade', width: 12 }
        ];
        wsInpi.getRow(1).font = { bold: true };

        verification.results.forEach(r => {
            if (r.inpi && r.inpi.details && Array.isArray(r.inpi.details)) {
                r.inpi.details.forEach(res => {
                    const searchedClass = res.class;

                    const addInpiRow = (data) => {
                        const row = wsInpi.addRow({
                            nome: r.name,
                            classe: searchedClass,
                            ...data
                        });
                        // Style Situacao Column (3)
                        const cell = row.getCell(3);
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        const val = (cell.value || '').toString().toLowerCase().trim();

                        if (val === 'livre') cell.font = { color: { argb: 'FF008000' }, bold: true };
                        else if (val === 'registro de marca em vigor' || val === 'ocupado') cell.font = { color: { argb: 'FFFF0000' }, bold: true };
                        else cell.font = { color: { argb: 'FFD4A017' }, bold: true }; // Fallback Yellow

                        // Add borders to other cells
                        row.eachCell(c => {
                            c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                        });
                    };

                    if (res.status === 'LIVRE') {
                        addInpiRow({ situacao: 'LIVRE', marca: '-', titular: '-', processo: '-', prioridade: '-' });
                    } else if (res.status === 'ERRO') {
                        addInpiRow({ situacao: 'ERRO', marca: '-', titular: '-', processo: '-', prioridade: '-' });
                    } else {
                        if (res.processes && res.processes.length > 0) {
                            res.processes.forEach(proc => {
                                addInpiRow({
                                    situacao: proc.situacao || res.status,
                                    marca: proc.brandName,
                                    titular: proc.holder,
                                    processo: proc.processNumber,
                                    prioridade: proc.prioridade || ''
                                });
                            });
                        } else {
                            addInpiRow({ situacao: res.status, marca: '?', titular: '?', processo: '?', prioridade: '' });
                        }
                    }
                });
            } else {
                wsInpi.addRow([r.name, '-', '-', '-', '-', '-', '-']);
            }
        });


        // --- 3. Aba Google ---
        const wsGoogle = workbook.addWorksheet('Google');
        wsGoogle.columns = [
            { header: 'Marca', key: 'marca', width: 25 },
            { header: 'Resultado', key: 'resultado', width: 50 },
            { header: 'Link', key: 'link', width: 60 },
            { header: 'Detalhes', key: 'detalhes', width: 100 }
        ];
        wsGoogle.getRow(1).font = { bold: true };

        const keywords = verification.config.keywords || [];

        verification.results.forEach(r => {
            if (r.google && r.google.results && r.google.results.length > 0) {
                r.google.results.forEach(res => {
                    // Rich Text Build
                    const richText = this.buildRichText(res.title || '', r.name, keywords);

                    const row = wsGoogle.addRow({
                        marca: r.name,
                        resultado: { richText: richText },
                        link: { text: res.link, hyperlink: res.link },
                        detalhes: res.snippet || ''
                    });

                    // Styling
                    row.eachCell(cell => {
                        cell.alignment = { vertical: 'top', wrapText: true, horizontal: 'left' };
                        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    });
                    // Link Style (Blue Underline)
                    const linkCell = row.getCell(3);
                    linkCell.font = { color: { argb: 'FF0000FF' }, underline: true };
                });
            } else {
                const row = wsGoogle.addRow({ marca: r.name, resultado: '-', link: '-', detalhes: 'Nenhum resultado encontrado' });
                row.eachCell(cell => cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } });
            }
        });


        // --- 4. Aba Instagram ---
        const wsIg = workbook.addWorksheet('Instagram');
        wsIg.columns = [
            { header: 'Nome Original', key: 'nome', width: 30 },
            { header: 'Variações / Status', key: 'status', width: 40 },
            { header: 'Link', key: 'link', width: 50 },
            { header: 'Bio', key: 'bio', width: 60 }
        ];
        wsIg.getRow(1).font = { bold: true };

        verification.results.forEach(r => {
            const details = r.instagram.details || [];
            const variationsText = details.map(d => `${d.username}: ${d.exists ? 'OCUPADO' : 'LIVRE'}`).join('\n');
            const linksText = details.map(d => d.exists ? d.url : '-').join('\n');
            const biosText = details.map(d => d.exists ? (d.bio || '').substring(0, 100).replace(/\n/g, ' ') : '-').join('\n');

            const row = wsIg.addRow({
                nome: r.name,
                status: variationsText,
                link: linksText,
                bio: biosText
            });

            row.eachCell(cell => {
                cell.alignment = { vertical: 'top', wrapText: true, horizontal: 'left' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        return await workbook.xlsx.writeBuffer();
    }

    // Centralized text parsing logic for both Excel and Scoring
    parseTextForMatches(text, name, keywords) {
        if (!text) return [];

        // --- Helpers inside method scope ---
        const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const isWordChar = (char) => /[a-zA-Z0-9À-ÿ]/.test(char);

        const createAccentRegex = (str) => {
            const normalized = removeAccents(str);
            const map = {
                'a': '[aáàâãä]', 'e': '[eéèêë]', 'i': '[iíìîï]', 'o': '[oóòôõö]', 'u': '[uúùûü]',
                'c': '[cç]', 'n': '[nñ]',
                'A': '[AÁÀÂÃÄ]', 'E': '[EÉÈÊË]', 'I': '[IÍÌÎÏ]', 'O': '[OÓÒÔÕÖ]', 'U': '[UÚÙÛÜ]',
                'C': '[CÇ]', 'N': '[NÑ]'
            };
            return normalized.split('').map(char => map[char] || escapeRegExp(char)).join('');
        };
        // -----------------------------------

        const validKeywords = keywords.filter(k => k && k.trim().length > 0);

        const terms = [
            createAccentRegex(removeAccents(name)),
            ...validKeywords.map(k => createAccentRegex(removeAccents(k)))
        ];

        if (terms.length === 0) return [{ text: text, type: 'text' }];

        // Sort terms by length desc to match longest first
        const termsObjs = [
            { pattern: createAccentRegex(removeAccents(name)), len: name.length },
            ...validKeywords.map(k => ({ pattern: createAccentRegex(removeAccents(k)), len: k.length }))
        ];
        termsObjs.sort((a, b) => b.len - a.len);

        const regexPattern = `(${termsObjs.map(t => t.pattern).join('|')})`;
        const regex = new RegExp(regexPattern, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (!part) return { text: '', type: 'text' };

            const normPart = removeAccents(part.toLowerCase());
            const normName = removeAccents(name.toLowerCase());

            let type = 'text';

            if (normPart === normName) {
                type = 'match-red';
            } else if (validKeywords.some(k => removeAccents(k.toLowerCase()) === normPart)) {
                type = 'match-yellow';
            }

            if (type !== 'text') {
                const prev = parts[index - 1];
                if (prev && prev.length > 0 && isWordChar(prev[prev.length - 1])) {
                    type = 'text';
                }
                const next = parts[index + 1];
                if (next && next.length > 0 && isWordChar(next[0])) {
                    type = 'text';
                }
            }

            return { text: part, type: type };
        });
    }

    buildRichText(text, name, keywords) {
        const tokens = this.parseTextForMatches(text, name, keywords);

        return tokens.map(token => {
            if (!token.text) return { text: '' };

            if (token.type === 'match-red') {
                return { text: token.text, font: { color: { argb: 'FFFF0000' }, bold: true } };
            } else if (token.type === 'match-yellow') {
                return { text: token.text, font: { color: { argb: 'FFD4A017' }, bold: true } };
            } else {
                return { text: token.text, font: { color: { argb: 'FF000000' }, bold: false } };
            }
        });
    }

    translateScore(score) {
        const map = {
            'green': 'LIVRE',
            'yellow': 'VERIFICAR',
            'red': 'OCUPADO'
        };
        return map[score] || score;
    }
}

module.exports = new NamingService();
