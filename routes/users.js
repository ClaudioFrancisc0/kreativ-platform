const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const {
    createUser,
    getAllUsers,
    updateUserRole,
    forcePasswordReset,
    toggleUserActive,
    updateUserAgents,
    findUserById
} = require('../database/userModel');

/**
 * GET /api/users
 * Lista todos os usuários (admin only)
 */
router.get('/', verifyToken, requireAdmin, async (req, res) => {
    try {
        const users = await getAllUsers();

        // Remover dados sensíveis
        const sanitizedUsers = users.map(user => ({
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active === 1,
            must_reset_password: user.must_reset_password === 1,
            enabled_agents: user.enabled_agents || ['naming'],
            created_at: user.created_at
        }));

        res.json({ users: sanitizedUsers });
    } catch (error) {
        console.error('Erro ao listar usuários:', error);
        res.status(500).json({ error: 'Erro ao listar usuários' });
    }
});

/**
 * POST /api/users
 * Cria novo usuário (admin only)
 * O usuário é criado com senha temporária e flag de reset obrigatório
 */
router.post('/', [
    verifyToken,
    requireAdmin,
    body('email').isEmail().withMessage('Email inválido'),
    body('role').isIn(['user', 'admin']).withMessage('Role deve ser user ou admin')
], async (req, res) => {
    try {
        // Validar dados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, role } = req.body;

        // Gerar senha temporária aleatória (o usuário vai criar a própria no primeiro login)
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);

        // Criar usuário com flag de reset de senha obrigatório
        const user = await createUser(email, tempPassword, role, true);

        res.status(201).json({
            message: 'Usuário criado com sucesso. Ele deverá criar sua senha no primeiro login.',
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Erro ao criar usuário:', error);

        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        res.status(500).json({ error: 'Erro ao criar usuário' });
    }
});

/**
 * PATCH /api/users/:id/role
 * Altera role do usuário (admin only)
 */
router.patch('/:id/role', [
    verifyToken,
    requireAdmin,
    body('role').isIn(['user', 'admin']).withMessage('Role deve ser user ou admin')
], async (req, res) => {
    try {
        // Validar dados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = parseInt(req.params.id);
        const { role } = req.body;

        // Verificar se usuário existe
        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Não permitir que usuário altere sua própria role
        if (userId === req.user.id) {
            return res.status(403).json({ error: 'Você não pode alterar sua própria role' });
        }

        // Atualizar role
        await updateUserRole(userId, role);

        res.json({ message: 'Role atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar role:', error);
        res.status(500).json({ error: 'Erro ao atualizar role' });
    }
});

/**
 * PATCH /api/users/:id/reset-password
 * Força reset de senha do usuário (admin only)
 */
router.patch('/:id/reset-password', verifyToken, requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Verificar se usuário existe
        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Forçar reset de senha
        await forcePasswordReset(userId);

        res.json({ message: 'Reset de senha agendado. Usuário deverá criar nova senha no próximo login.' });
    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({ error: 'Erro ao resetar senha' });
    }
});

/**
 * PATCH /api/users/:id/toggle-active
 * Ativa/desativa usuário (admin only)
 */
router.patch('/:id/toggle-active', [
    verifyToken,
    requireAdmin,
    body('isActive').isBoolean().withMessage('isActive deve ser boolean')
], async (req, res) => {
    try {
        // Validar dados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = parseInt(req.params.id);
        const { isActive } = req.body;

        // Verificar se usuário existe
        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Não permitir que usuário desative a si mesmo
        if (userId === req.user.id) {
            return res.status(403).json({ error: 'Você não pode desativar sua própria conta' });
        }

        // Toggle active
        await toggleUserActive(userId, isActive);

        res.json({ message: `Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso` });
    } catch (error) {
        console.error('Erro ao alterar status:', error);
        res.status(500).json({ error: 'Erro ao alterar status do usuário' });
    }
});

/**
 * PATCH /api/users/:id/agents
 * Atualiza agentes habilitados do usuário (admin only)
 */
router.patch('/:id/agents', [
    verifyToken,
    requireAdmin,
    body('enabled_agents').isArray().withMessage('enabled_agents deve ser um array')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const userId = parseInt(req.params.id);
        const { enabled_agents } = req.body;

        const user = await findUserById(userId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const validAgents = ['naming', 'youtube'];
        const invalidAgents = enabled_agents.filter(a => !validAgents.includes(a));
        if (invalidAgents.length > 0) {
            return res.status(400).json({
                error: `Agentes inválidos: ${invalidAgents.join(', ')}`
            });
        }

        await updateUserAgents(userId, enabled_agents);
        res.json({ message: 'Agentes atualizados com sucesso' });
    } catch (error) {
        console.error('Erro ao atualizar agentes:', error);
        res.status(500).json({ error: 'Erro ao atualizar agentes' });
    }
});

module.exports = router;
