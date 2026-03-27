const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../database/db');

/**
 * GET /api/agents/rb_podcast/number
 */
router.get('/rb_podcast/number', verifyToken, (req, res) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['last_rb_podcast_number'], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erro no bd' });
        res.json({ number: row ? parseInt(row.value) : 0 });
    });
});

/**
 * POST /api/agents/rb_podcast/number
 */
router.post('/rb_podcast/number', verifyToken, express.json(), (req, res) => {
    const { number } = req.body;
    db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        ['last_rb_podcast_number', number.toString(), number.toString()],
        (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao salvar' });
            res.json({ success: true });
        }
    );
});

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

        // Default para rb_podcast se não houver configuração
        if (!enabledAgents || !Array.isArray(enabledAgents)) {
            enabledAgents = ['rb_podcast'];
        }

        // Admins têm acesso a tudo
        if (req.user.role === 'admin') {
            enabledAgents = ['rb_podcast'];
        }

        res.json({ enabled_agents: enabledAgents });
    } catch (error) {
        console.error('Erro ao obter agentes disponíveis:', error);
        res.status(500).json({ error: 'Erro ao obter agentes disponíveis' });
    }
});

module.exports = router;
