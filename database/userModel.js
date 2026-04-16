const db = require('./db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Verifica se existe algum usuário no banco
 */
const hasAnyUsers = () => {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count > 0);
            }
        });
    });
};

/**
 * Cria um novo usuário
 */
const createUser = async (email, password, role = 'user', mustResetPassword = false) => {
    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        return new Promise((resolve, reject) => {
            const sql = `
        INSERT INTO users (email, password_hash, role, must_reset_password, is_active)
        VALUES (?, ?, ?, ?, 1)
      `;

            db.run(sql, [email, passwordHash, role, mustResetPassword ? 1 : 0], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        id: this.lastID,
                        email,
                        role,
                        must_reset_password: mustResetPassword,
                        is_active: true
                    });
                }
            });
        });
    } catch (error) {
        throw error;
    }
};

/**
 * Busca usuário por email
 */
const findUserByEmail = (email) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
};

/**
 * Busca usuário por ID
 */
const findUserById = (id) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
};

/**
 * Lista todos os usuários
 */
const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT id, email, role, is_active, must_reset_password, enabled_agents, created_at FROM users', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                // Parse enabled_agents JSON strings
                const users = rows.map(user => ({
                    ...user,
                    enabled_agents: user.enabled_agents ? JSON.parse(user.enabled_agents) : ['naming']
                }));
                resolve(users);
            }
        });
    });
};

/**
 * Atualiza role do usuário
 */
const updateUserRole = (userId, newRole) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

        db.run(sql, [newRole, userId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
};

/**
 * Força reset de senha do usuário
 */
const forcePasswordReset = (userId) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE users SET must_reset_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

        db.run(sql, [userId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
};

/**
 * Atualiza senha do usuário
 */
const updatePassword = async (userId, newPassword) => {
    try {
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        return new Promise((resolve, reject) => {
            const sql = `
        UPDATE users 
        SET password_hash = ?, must_reset_password = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

            db.run(sql, [passwordHash, userId], function (err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    } catch (error) {
        throw error;
    }
};

/**
 * Ativa/desativa usuário
 */
const toggleUserActive = (userId, isActive) => {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

        db.run(sql, [isActive ? 1 : 0, userId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
};

/**
 * Verifica se senha está correta
 */
const verifyPassword = async (plainPassword, hashedPassword) => {
    return await bcrypt.compare(plainPassword, hashedPassword);
};

/**
 * Atualiza agentes habilitados para o usuário
 */
const updateUserAgents = (userId, enabledAgents) => {
    return new Promise((resolve, reject) => {
        const agentsJson = JSON.stringify(enabledAgents);
        const sql = 'UPDATE users SET enabled_agents = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';

        db.run(sql, [agentsJson, userId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
};

/**
 * Exclui fisicamente o usuário do banco
 */
const deleteUser = (userId) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM users WHERE id = ?';

        db.run(sql, [userId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
};

module.exports = {
    hasAnyUsers,
    createUser,
    findUserByEmail,
    findUserById,
    getAllUsers,
    updateUserRole,
    forcePasswordReset,
    updatePassword,
    toggleUserActive,
    updateUserAgents,
    verifyPassword,
    deleteUser
};
