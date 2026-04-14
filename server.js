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

// 2. Body Parsers (for internal routes)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Static Files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const agentsRoutes = require('./routes/agents');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/admin', require('./routes/admin'));

// API Routes

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
    const diag = {
        node_env: process.env.NODE_ENV,
        platform: process.platform,
        env: {
            DATABASE_PATH: process.env.DATABASE_PATH
        },
        timestamp: new Date().toISOString()
    };
    res.json(diag);
});

// Redirect root to main platform
app.get('/', (req, res) => res.redirect('/agents/rb_podcast.html'));

// Catch-all para rotas desconhecidas
app.use((req, res) => {
    console.log(`⚠️ 404 - Rota não encontrada: ${req.method} ${req.url}`);
    res.status(404).json({ error: 'Endpoint ou arquivo não encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Erro:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
});

// Start server
const server = app.listen(PORT, HOST, async () => {
    console.log(`🚀 Kreativ Platform rodando na porta ${PORT}`);
    console.log(`✅ Servidor pronto para receber requisições`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⏹️ SIGTERM recebido. Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor NODE encerrado com sucesso');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⏹️ SIGINT recebido. Encerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor NODE encerrado com sucesso');
        process.exit(0);
    });
});
