/**
 * Middleware para verificar se o usuário tem acesso a um agente específico
 */
const requireAgent = (agentName) => {
    return (req, res, next) => {
        // Admins sempre têm acesso a tudo
        if (req.user && req.user.role === 'admin') {
            return next();
        }

        // Verificar se o usuário tem o agente habilitado
        const enabledAgents = req.user?.enabled_agents;

        if (!enabledAgents) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: 'Você não tem agentes habilitados. Entre em contato com o administrador.'
            });
        }

        // Parse se for string
        const agents = typeof enabledAgents === 'string'
            ? JSON.parse(enabledAgents)
            : enabledAgents;

        if (!agents.includes(agentName)) {
            return res.status(403).json({
                error: 'Acesso negado',
                message: `Você não tem acesso ao agente "${agentName}". Entre em contato para upgrade.`
            });
        }

        next();
    };
};

module.exports = { requireAgent };
