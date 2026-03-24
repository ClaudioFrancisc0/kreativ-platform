const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

/**
 * GET /api/agents/available
 * Retorna lista de agentes habilitados para o usuário atual
 */
router.get('/available', verifyToken, (req, res) => {
    try {
        // Parse enabled_agents se for string
        let enabledAgents = req.user.enabled_agents;

        if (typeof enabledAgents === 'string') {
            enabledAgents = JSON.parse(enabledAgents);
        }

        // Default para naming se não houver configuração
        if (!enabledAgents || !Array.isArray(enabledAgents)) {
            enabledAgents = ['naming'];
        }

        // Admins têm acesso a tudo
        if (req.user.role === 'admin') {
            enabledAgents = ['naming', 'youtube', 'trade_facil'];
        }

        res.json({ enabled_agents: enabledAgents });
    } catch (error) {
        console.error('Erro ao obter agentes disponíveis:', error);
        res.status(500).json({ error: 'Erro ao obter agentes disponíveis' });
    }
});

module.exports = router;
