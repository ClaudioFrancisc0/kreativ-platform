const configService = require('./configService');

class GoogleService {
    constructor() {
        this.baseUrl = 'https://www.googleapis.com/customsearch/v1';
    }

    async search(name, keywords = []) {
        console.log(`[Google API] Starting search for: ${name} with keywords: ${keywords.join(', ')}`);

        const credentials = await configService.getGoogleCredentials();

        if (!credentials || !credentials.apiKey || !credentials.searchEngineId) {
            console.warn('[Google API] Missing credentials');
            return {
                status: 'CONFIG_REQUIRED',
                query: '',
                results: [],
                error: 'Configure a API Key e Search Engine ID no painel.'
            };
        }

        const query = `${keywords.join(' ')} ${name}`.trim();
        const url = `${this.baseUrl}?key=${credentials.apiKey}&cx=${credentials.searchEngineId}&q=${encodeURIComponent(query)}&num=10`;

        try {
            console.log(`[Google API] Requesting: ${url.replace(credentials.apiKey, 'HIDDEN_KEY')}`); // Log without key

            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                console.error('[Google API] Error response:', data);
                // Handle specific errors like quota
                if (data.error && data.error.code === 429) {
                    return { status: 'QUOTA', results: [], error: 'Cota diária do Google excedida.' };
                }
                throw new Error(data.error ? data.error.message : 'Unknown Google API Error');
            }

            const items = data.items || [];
            console.log(`[Google API] Found ${items.length} results.`);

            const results = items.map(item => ({
                title: item.title,
                link: item.link,
                snippet: item.snippet
            }));

            // Analyze/Score results
            let status = 'LIVRE';
            if (results.length > 5) status = 'OCUPADO';
            else if (results.length > 0) status = 'VERIFICAR';

            return {
                status,
                query,
                results
            };

        } catch (error) {
            console.error('[Google API] Execution Error:', error);
            return {
                status: 'ERRO',
                details: error.message,
                results: []
            };
        }
    }
}

module.exports = new GoogleService();
