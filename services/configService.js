const db = require('../database/db');

class ConfigService {
    constructor() {
        this.ensureTable();
    }

    ensureTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `;
        db.run(sql, (err) => {
            if (err) {
                console.error('❌ Erro ao criar tabela config:', err);
            } else {
                console.log('✅ Tabela config criada/verificada');
            }
        });
    }

    get(key) {
        return new Promise((resolve, reject) => {
            db.get('SELECT value FROM config WHERE key = ?', [key], (err, row) => {
                if (err) {
                    console.error('Error reading config:', err);
                    resolve(null);
                } else {
                    resolve(row ? JSON.parse(row.value) : null);
                }
            });
        });
    }

    set(key, value) {
        return new Promise((resolve, reject) => {
            const sql = `INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`;
            db.run(sql, [key, JSON.stringify(value)], (err) => {
                if (err) {
                    console.error('Error saving config:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }

    // Specific helpers - now async
    async getInpiCredentials() {
        return await this.get('inpi_credentials');
    }

    async setInpiCredentials(username, password) {
        return await this.set('inpi_credentials', { username, password });
    }

    async getGoogleCredentials() {
        return await this.get('google_credentials');
    }

    async setGoogleCredentials(apiKey, searchEngineId) {
        return await this.set('google_credentials', { apiKey, searchEngineId });
    }

    async getYoutubeAutomationConfig() {
        return await this.get('youtube_automation_config');
    }

    async setYoutubeAutomationConfig(geminiApiKey, youtubeClientSecrets) {
        return await this.set('youtube_automation_config', { geminiApiKey, youtubeClientSecrets });
    }

    async getYoutubeTokens() {
        return await this.get('youtube_tokens') || {};
    }

    async setYoutubeToken(lang, tokenData) {
        const tokens = await this.getYoutubeTokens();
        tokens[lang] = tokenData;
        return await this.set('youtube_tokens', tokens);
    }

    async getOpenAiApiKey() {
        return await this.get('openai_api_key');
    }

    async setOpenAiApiKey(apiKey) {
        return await this.set('openai_api_key', apiKey);
    }
}

module.exports = new ConfigService();
