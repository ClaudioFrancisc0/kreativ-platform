const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const { verifyToken } = require('../middleware/auth'); 

// Configurações e ferramentas do System Admin virão no futuro

// ================= RB PODCAST (OpenAI) =================
router.get('/config/openai', verifyToken, requireAdmin, async (req, res) => {
    try {
        let key = await configService.getOpenAiApiKey();
        if (!key && process.env.OPENAI_API_KEY) {
            key = 'ENV_VARS'; // Indica apenas que existe no Railway
        }
        res.json({ key: key ? 'sk-proj-...[ofuscado]' : '' });
    } catch (error) {
        console.error('Erro ao buscar chave OpenAI:', error);
        res.status(500).json({ error: 'Erro ao buscar chave OpenAI' });
    }
});

router.post('/config/openai', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey) return res.status(400).json({ error: 'A chave API é obrigatória.' });
        
        await configService.setOpenAiApiKey(apiKey);
        res.json({ message: 'Chave salva com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar chave OpenAI:', error);
        res.status(500).json({ error: 'Erro ao salvar chave OpenAI' });
    }
});

module.exports = router;
