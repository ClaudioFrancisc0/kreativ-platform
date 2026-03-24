const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const namingService = require('../services/namingService');

/**
 * POST /api/naming/start
 * Inicia uma nova verificação de naming
 */
router.post('/start', verifyToken, async (req, res) => {
    try {
        const { names, keywords, classes, inpiClasses, inputSource, gsheetId } = req.body;

        if (!names || !Array.isArray(names) || names.length === 0) {
            return res.status(400).json({ error: 'Lista de nomes é obrigatória' });
        }

        const config = {
            names,
            keywords: keywords || [],
            inpiClasses: inpiClasses || classes || [36, 37, 42, 29, 30, 21, 25, 16, 3, 5],
            inputSource,
            gsheetId
        };

        const verificationId = namingService.startVerification(req.user.id, config);

        console.log(`🔍 Verificação iniciada: ${verificationId} - ${names.length} nomes`);

        res.json({
            verificationId,
            message: 'Verificação iniciada',
            totalNames: names.length
        });

    } catch (error) {
        console.error('Erro ao iniciar verificação:', error);
        res.status(500).json({ error: 'Erro ao iniciar verificação' });
    }
});

/**
 * GET /api/naming/status/:id
 * Retorna o status de uma verificação
 */
router.get('/status/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const verification = namingService.getVerification(id);

        if (!verification) {
            return res.status(404).json({ error: 'Verificação não encontrada' });
        }

        // Check ownership
        if (verification.userId !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        res.json({
            id: verification.id,
            status: verification.status,
            progress: verification.progress,
            startedAt: verification.startedAt,
            completedAt: verification.completedAt
        });

    } catch (error) {
        console.error('Erro ao buscar status:', error);
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

/**
 * POST /api/naming/cancel/:id
 * Cancela uma verificação em andamento
 */
router.post('/cancel/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const success = namingService.cancelVerification(id, req.user.id);

        if (!success) {
            return res.status(404).json({ error: 'Verificação não encontrada ou acesso negado' });
        }

        console.log(`❌ Verificação cancelada: ${id}`);

        res.json({ message: 'Verificação cancelada' });

    } catch (error) {
        console.error('Erro ao cancelar verificação:', error);
        res.status(500).json({ error: 'Erro ao cancelar verificação' });
    }
});

/**
 * GET /api/naming/results/:id
 * Retorna os resultados de uma verificação concluída
 */
router.get('/results/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const verification = namingService.getVerification(id);

        if (!verification) {
            return res.status(404).json({ error: 'Verificação não encontrada' });
        }

        if (verification.userId !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        // Calculate stats
        const stats = {
            green: verification.results.filter(r => r.generalScore === 'green').length,
            yellow: verification.results.filter(r => r.generalScore === 'yellow').length,
            red: verification.results.filter(r => r.generalScore === 'red').length
        };

        res.json({
            id: verification.id,
            config: verification.config,
            results: verification.results,
            stats: stats,
            completedAt: verification.completedAt
        });

    } catch (error) {
        console.error('Erro ao buscar resultados:', error);
        res.status(500).json({ error: 'Erro ao buscar resultados' });
    }
});

/**
 * GET /api/naming/download/:id
 * Gera e retorna o arquivo Excel
 */
router.get('/download/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const verification = namingService.getVerification(id);

        if (!verification) {
            return res.status(404).json({ error: 'Verificação não encontrada' });
        }

        if (verification.userId !== req.user.id) {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const buffer = await namingService.generateExcel(id);

        if (!buffer) {
            return res.status(500).json({ error: 'Erro ao gerar planilha' });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=naming_results_${id}.xlsx`);
        res.send(buffer);

    } catch (error) {
        console.error('Erro ao baixar planilha:', error);
        res.status(500).json({ error: 'Erro ao baixar planilha' });
    }
});

module.exports = router;
