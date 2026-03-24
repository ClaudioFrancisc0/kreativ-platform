require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Log de ambiente
console.log('🔧 Iniciando servidor...');
console.log('📦 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🔌 PORT:', PORT);

// 1. Proxies FIRST (before body parsers consume the stream)
const { createProxyMiddleware } = require('http-proxy-middleware');

// Proxy para o app YouTube (Streamlit)
app.use('/youtube-app', createProxyMiddleware({
    target: 'http://127.0.0.1:8501',
    changeOrigin: true,
    ws: true,
    onError: (err, req, res) => {
        console.error('Erro no proxy YouTube:', err);
        res.status(502).json({
            error: 'O app de automação ainda está iniciando.',
            details: err.message
        });
    }
}));

// Proxy para o app Trade Fácil (Flask)
app.use('/trade-facil-api', createProxyMiddleware({
    target: 'http://127.0.0.1:5001',
    changeOrigin: true,
    pathRewrite: { '^/trade-facil-api': '' },
    timeout: 120000,
    proxyTimeout: 120000,
    onError: (err, req, res) => {
        console.error('Erro no proxy Trade Fácil:', err);
        res.status(502).json({
            error: 'O serviço de estatísticas não está respondendo.',
            details: err.message
        });
    }
}));

// 2. Body Parsers (for internal routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const namingRoutes = require('./routes/naming');
const agentsRoutes = require('./routes/agents');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/naming', namingRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/admin', require('./routes/admin'));

// Python Services
const pythonService = require('./services/pythonService');
const tradeStatsService = require('./services/tradeStatsService');

// Redirecionar raiz para login (login.html verifica se precisa de setup automaticamente)
app.get('/', (req, res) => {
    console.log('📄 GET / - Redirecionando para login');
    res.redirect('/login.html');
});

// Health check endpoint
app.get('/health', (req, res) => {
    console.log('💚 GET /health - Health check');
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Config endpoint (Protected by auth in frontend, but could add middleware here too)
app.get('/api/config', (req, res) => {
    // Only expose safe public variables
    res.json({
        youtubeAppUrl: process.env.YOUTUBE_APP_URL || '/youtube-app'
    });
});

// Diag endpoint for cloud debugging
app.get('/api/diag', async (req, res) => {
    const fs = require('fs');
    const path = require('path');

    const diag = {
        node_env: process.env.NODE_ENV,
        platform: process.platform,
        python_services: {
            youtube: pythonService.process ? `PID: ${pythonService.process.pid}` : 'Offline',
            trade: tradeStatsService.process ? `PID: ${tradeStatsService.process.pid}` : 'Offline'
        },
        checks: {
            youtube_dir: fs.existsSync(path.join(__dirname, 'apps/youtube-shorts')),
            youtube_venv: fs.existsSync(path.join(__dirname, 'apps/youtube-shorts/venv/bin/python')),
            trade_dir: fs.existsSync(path.join(__dirname, 'apps/trade-facil')),
            trade_venv: fs.existsSync(path.join(__dirname, 'apps/trade-facil/venv/bin/python')),
            trade_db: fs.existsSync('/data/trade_facil.db')
                ? `${(fs.statSync('/data/trade_facil.db').size / 1024 / 1024).toFixed(2)} MB`
                : 'Not found in /data'
        },
        env: {
            LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH,
            PATH: process.env.PATH,
            DATABASE_PATH: process.env.DATABASE_PATH
        },
        logs: {
            youtube: pythonService.logBuffer,
            trade: tradeStatsService.logBuffer
        },
        timestamp: new Date().toISOString()
    };
    res.json(diag);
});

// Catch-all para SPA routing (serve index.html para rotas desconhecidas)
app.use((req, res) => {
    console.log(`⚠️ 404 - Rota não encontrada: ${req.method} ${req.url}`);
    res.status(404).sendFile(path.join(__dirname, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Erro:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Start server
const server = app.listen(PORT, HOST, async () => {
    console.log(`🚀 StudioMe Platform rodando na porta ${PORT}`);
    console.log(`✅ Servidor pronto para receber requisições`);

    // Iniciar serviços Python de forma assíncrona
    pythonService.start().catch(err => console.error('Erro ao iniciar YouTube Service:', err));
    tradeStatsService.start().catch(err => console.error('Erro ao iniciar Trade Stats Service:', err));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⏹️ SIGTERM recebido. Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor NODE encerrado com sucesso');
        // Encerrar serviços Python
        pythonService.stop();
        tradeStatsService.stop();
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⏹️ SIGINT recebido. Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor NODE encerrado com sucesso');
        // Encerrar serviços Python
        pythonService.stop();
        tradeStatsService.stop();
        process.exit(0);
    });
});
