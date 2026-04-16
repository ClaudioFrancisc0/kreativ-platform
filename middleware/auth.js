const jwt = require('jsonwebtoken');
const { findUserById } = require('../database/userModel');

// Fallback JWT_SECRET (mesma chave usada na rota de login)
const getJwtSecret = () => process.env.JWT_SECRET || 'nirin-default-secret-change-in-production';

/**
 * Middleware para verificar token JWT
 */
const verifyToken = async (req, res, next) => {
    try {
        // Buscar token no header Authorization ou query params
        const authHeader = req.headers['authorization'];
        let token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            token = req.query.t;
        }

        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        // Verificar token com a mesma chave usada para assinar
        const decoded = jwt.verify(token, getJwtSecret());

        // Buscar usuário no banco
        const user = await findUserById(decoded.userId);

        if (!user) {
            return res.status(401).json({ error: 'Usuário não encontrado' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Usuário desativado' });
        }

        // Adicionar usuário ao request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            must_reset_password: user.must_reset_password
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(500).json({ error: 'Erro ao verificar token' });
    }
};

/**
 * Middleware para verificar se usuário é admin
 */
const requireAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'dev') {
        return res.status(403).json({ error: 'Acesso negado. Apenas administradores e devs.' });
    }

    next();
};

module.exports = {
    verifyToken,
    requireAdmin
};
