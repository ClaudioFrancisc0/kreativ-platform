const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const { verifyToken, isAdmin } = require('../middleware/auth'); // Ensure these middlewares exist or adapt

// Get INPI config (Admin only)
router.get('/config/inpi', verifyToken, async (req, res) => {
    // Basic check for admin role if available in req.user
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const credentials = await configService.getInpiCredentials();
    // Return sanitized data (hide password in real app, but for now return as is or masked)
    res.json({
        username: credentials ? credentials.username : '',
        password: credentials ? credentials.password : ''
    });
});

// Update INPI config (Admin only)
router.post('/config/inpi', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acesso negado' });
    }

    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    }

    const success = await configService.setInpiCredentials(username, password);

    if (success) {
        res.json({ message: 'Credenciais INPI atualizadas com sucesso' });
    } else {
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Get Google config (Admin only)
router.get('/config/google', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

    const credentials = await configService.getGoogleCredentials();
    res.json({
        apiKey: credentials ? credentials.apiKey : '',
        searchEngineId: credentials ? credentials.searchEngineId : ''
    });
});

// Update Google config (Admin only)
router.post('/config/google', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

    const { apiKey, searchEngineId } = req.body;
    // Allow saving empty strings to clear config, but warn if partial? 
    // Let's assume user wants to save whatever (even clear it)

    const success = await configService.setGoogleCredentials(apiKey, searchEngineId);

    if (success) {
        res.json({ message: 'Credenciais Google atualizadas com sucesso' });
    } else {
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Get YouTube Automation config (Admin only)
router.get('/config/youtube', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

    const config = await configService.getYoutubeAutomationConfig();
    res.json({
        geminiApiKey: config ? config.geminiApiKey : '',
        youtubeClientSecrets: config ? config.youtubeClientSecrets : ''
    });
});

// Update YouTube Automation config (Admin only)
router.post('/config/youtube', verifyToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });

    const { geminiApiKey, youtubeClientSecrets } = req.body;

    // Configurações do YouTube Automation
    const success = await configService.setYoutubeAutomationConfig(geminiApiKey, youtubeClientSecrets);

    if (success) {
        // Sincronizar com o disco se houver secrets
        if (youtubeClientSecrets) {
            const pythonService = require('../services/pythonService');
            pythonService.saveSecretsToDisk(youtubeClientSecrets);
        }
        res.json({ message: 'Configurações de Youtube Shorts atualizadas com sucesso' });
    } else {
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

// Internal endpoint for Python Service to sync back generated tokens
router.post('/config/youtube/token-sync', async (req, res) => {
    // Security: only allow from localhost (internal process)
    const remoteAddress = req.socket.remoteAddress;
    if (remoteAddress !== '::1' && remoteAddress !== '127.0.0.1' && remoteAddress !== '::ffff:127.0.0.1') {
        console.warn(`🛑 Tentativa de sincronização de token de origem externa: ${remoteAddress}`);
        return res.status(403).json({ error: 'Acesso negado (apenas interno)' });
    }

    const { lang, tokenData } = req.body;
    if (!lang || !tokenData) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    const success = await configService.setYoutubeToken(lang, tokenData);
    if (success) {
        console.log(`✅ Token para [${lang}] sincronizado no banco de dados.`);
        res.json({ message: 'Token sincronizado com sucesso' });
    } else {
        res.status(500).json({ error: 'Erro ao sincronizar token' });
    }
});

module.exports = router;
