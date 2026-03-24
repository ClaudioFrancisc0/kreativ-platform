const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { verifyToken } = require('../middleware/auth');
const {
    hasAnyUsers,
    createUser,
    findUserByEmail,
    verifyPassword,
    updatePassword
} = require('../database/userModel');

/**
 * GET /api/auth/check-setup
 * Verifica se a plataforma precisa de setup inicial
 */
router.get('/check-setup', async (req, res) => {
    try {
        const usersExist = await hasAnyUsers();
        res.json({ needsSetup: !usersExist });
    } catch (error) {
        console.error('Erro ao verificar setup:', error);
        res.status(500).json({ error: 'Erro ao verificar setup' });
    }
});

/**
 * POST /api/auth/setup
 * Cria o primeiro administrador (só funciona se não houver usuários)
 */
router.post('/setup', [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres')
], async (req, res) => {
    try {
        // Validar dados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Verificar se já existem usuários
        const usersExist = await hasAnyUsers();
        if (usersExist) {
            return res.status(403).json({ error: 'Setup já foi realizado' });
        }

        const { email, password } = req.body;

        // Criar primeiro admin
        const user = await createUser(email, password, 'admin', false);

        res.status(201).json({
            message: 'Administrador criado com sucesso',
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error('Erro no setup:', error);

        if (error.code === 'SQLITE_CONSTRAINT') {
            return res.status(400).json({ error: 'Email já cadastrado' });
        }

        res.status(500).json({ error: 'Erro ao criar administrador' });
    }
});

/**
 * POST /api/auth/login
 * Realiza login e retorna JWT token
 */
router.post('/login', [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Senha é obrigatória')
], async (req, res) => {
    try {
        // Validar dados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        console.log('🔐 Tentativa de login para:', email);

        // Buscar usuário
        const user = await findUserByEmail(email);
        if (!user) {
            console.log('❌ Usuário não encontrado:', email);
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Verificar se usuário está ativo
        if (!user.is_active) {
            console.log('❌ Usuário desativado:', email);
            return res.status(403).json({ error: 'Usuário desativado. Contate o administrador.' });
        }

        // Verificar senha
        const passwordValid = await verifyPassword(password, user.password_hash);
        if (!passwordValid) {
            console.log('❌ Senha incorreta para:', email);
            return res.status(401).json({ error: 'Email ou senha incorretos' });
        }

        // Garantir que JWT_SECRET existe
        const jwtSecret = process.env.JWT_SECRET || 'nirin-default-secret-change-in-production';

        // Gerar token JWT (válido por 24 horas)
        const token = jwt.sign(
            { userId: user.id },
            jwtSecret,
            { expiresIn: '24h' }
        );

        console.log('✅ Login bem-sucedido para:', email);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                must_reset_password: user.must_reset_password === 1
            }
        });
    } catch (error) {
        console.error('❌ Erro no login:', error.message, error.stack);
        res.status(500).json({ error: 'Erro ao realizar login: ' + error.message });
    }
});

/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado
 */
router.get('/me', verifyToken, async (req, res) => {
    try {
        res.json({
            user: req.user
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do usuário' });
    }
});

/**
 * POST /api/auth/reset-my-password
 * Usuário reseta sua própria senha (quando obrigado pelo admin)
 */
router.post('/reset-my-password', [
    verifyToken,
    body('newPassword').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres')
], async (req, res) => {
    try {
        // Validar dados
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { newPassword } = req.body;

        // Atualizar senha
        await updatePassword(req.user.id, newPassword);

        res.json({ message: 'Senha atualizada com sucesso' });
    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        res.status(500).json({ error: 'Erro ao atualizar senha' });
    }
});

/**
 * POST /api/auth/logout
 * Logout (client-side apenas limpa o token)
 */
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout realizado com sucesso' });
});

/**
 * POST /api/auth/first-access
 * Permite que usuários novos (com must_reset_password=true) criem sua senha
 * SEM precisar fazer login primeiro
 */
router.post('/first-access', [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Senha deve ter no mínimo 6 caracteres')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        console.log('🔑 Primeiro acesso para:', email);

        // Buscar usuário
        const user = await findUserByEmail(email);
        if (!user) {
            console.log('❌ Usuário não encontrado:', email);
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        // Verificar se usuário precisa resetar senha
        if (user.must_reset_password !== 1) {
            console.log('❌ Usuário já tem senha definida:', email);
            return res.status(400).json({ error: 'Este usuário já possui senha definida. Use a tela de login.' });
        }

        // Verificar se usuário está ativo
        if (!user.is_active) {
            return res.status(403).json({ error: 'Usuário desativado. Contate o administrador.' });
        }

        // Atualizar senha
        await updatePassword(user.id, password);
        console.log('✅ Senha criada com sucesso para:', email);

        res.json({ message: 'Senha criada com sucesso! Agora você pode fazer login.' });
    } catch (error) {
        console.error('❌ Erro no primeiro acesso:', error);
        res.status(500).json({ error: 'Erro ao criar senha' });
    }
});

module.exports = router;
