const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const configService = require('./configService');

class PythonService {
    constructor() {
        this.process = null;
        this.appDir = path.join(__dirname, '../apps/youtube-shorts');
        this.venvPath = path.join(this.appDir, 'venv'); // Unified 'venv' path everywhere
        this.isWindows = process.platform === 'win32';
        this.secretsPath = path.join(this.appDir, 'client_secrets.json');
        this.logBuffer = []; // Buffer for last 100 lines
    }

    addLog(msg, isError = false) {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${isError ? 'ERR' : 'LOG'}: ${msg}`;
        this.logBuffer.push(line);
        if (this.logBuffer.length > 100) this.logBuffer.shift();
    }

    /**
     * Writes credentials to disk for the Python app to consume.
     * Can be called whenever settings are updated in the UI.
     */
    saveSecretsToDisk(secrets) {
        if (!secrets) {
            console.log('ℹ️ Nenhuma credencial do YouTube para sincronizar.');
            return;
        }
        try {
            fs.writeFileSync(this.secretsPath, secrets);
            console.log(`📝 client_secrets.json sincronizado com o disco em: ${this.secretsPath}`);
            return true;
        } catch (err) {
            console.error(`❌ Erro ao escrever client_secrets.json em ${this.secretsPath}:`, err);
            return false;
        }
    }

    /**
     * Reads tokens from DB and restores them to the 'tokens/' directory.
     */
    async syncTokensToDisk() {
        const tokens = await configService.getYoutubeTokens();
        const tokensDir = path.join(this.appDir, 'tokens');

        if (!fs.existsSync(tokensDir)) {
            fs.mkdirSync(tokensDir, { recursive: true });
        }

        const languages = Object.keys(tokens);
        if (languages.length === 0) {
            console.log('ℹ️ Nenhum token de canal para restaurar.');
            return;
        }

        console.log(`🔄 Restaurando ${languages.length} tokens de canais do banco de dados...`);

        for (const lang of languages) {
            const data = tokens[lang];
            if (!data || !data.pickle_base64) continue;

            try {
                // Restore .pickle
                const pickleBuffer = Buffer.from(data.pickle_base64, 'base64');
                fs.writeFileSync(path.join(tokensDir, `${lang}.pickle`), pickleBuffer);

                // Restore .json (metadata)
                if (data.metadata) {
                    fs.writeFileSync(path.join(tokensDir, `${lang}.json`), JSON.stringify(data.metadata, null, 2));
                }
                console.log(`✅ Token [${lang}] restaurado.`);
            } catch (err) {
                console.error(`❌ Erro ao restaurar token [${lang}]:`, err);
            }
        }
    }

    async start() {
        console.log('🐍 Iniciando serviço Python (YouTube Automation)...');

        try {
            // --- MIGRATION & CONFIG LOADING START ---
            let dbConfig = await configService.getYoutubeAutomationConfig();

            // Check if DB is empty but local files exist (Migration)
            const envPath = path.join(this.appDir, '.env');
            const secretsPath = path.join(this.appDir, 'client_secrets.json');

            if (!dbConfig || !dbConfig.geminiApiKey || !dbConfig.youtubeClientSecrets) {
                console.log('🔄 Verificando arquivos locais para migração de credenciais faltantes...');
                let migratedApiKey = (dbConfig && dbConfig.geminiApiKey) ? dbConfig.geminiApiKey : '';
                let migratedSecrets = (dbConfig && dbConfig.youtubeClientSecrets) ? dbConfig.youtubeClientSecrets : '';
                let hasChanges = false;

                // 1. Try to read .env for GEMINI_API_KEY (only if not already in DB)
                if (!migratedApiKey && fs.existsSync(envPath)) {
                    const envContent = fs.readFileSync(envPath, 'utf8');
                    const match = envContent.match(/GEMINI_API_KEY=(.*)/);
                    if (match && match[1]) {
                        migratedApiKey = match[1].trim();
                        console.log('✅ GEMINI_API_KEY encontrada localmente.');
                        hasChanges = true;
                    }
                }

                // 2. Try to read client_secrets.json (only if not already in DB)
                if (!migratedSecrets && fs.existsSync(secretsPath)) {
                    try {
                        const secretsContent = fs.readFileSync(secretsPath, 'utf8');
                        // Validate JSON
                        JSON.parse(secretsContent);
                        migratedSecrets = secretsContent;
                        console.log('✅ client_secrets.json encontrado localmente.');
                        hasChanges = true;
                    } catch (e) {
                        console.error('⚠️ Erro ao ler client_secrets.json local:', e.message);
                    }
                }

                if (hasChanges) {
                    await configService.setYoutubeAutomationConfig(migratedApiKey, migratedSecrets);
                    console.log('💾 Configurações migradas para o banco de dados com sucesso!');
                    // Refresh config
                    dbConfig = await configService.getYoutubeAutomationConfig();
                }
            }

            // Prepare Environment Variables
            const processEnv = { ...process.env, PYTHONUNBUFFERED: '1' };

            if (dbConfig) {
                if (dbConfig.geminiApiKey) {
                    console.log('🔑 Injetando GEMINI_API_KEY do banco de dados.');
                    processEnv.GEMINI_API_KEY = dbConfig.geminiApiKey;
                }

                if (dbConfig.youtubeClientSecrets) {
                    this.saveSecretsToDisk(dbConfig.youtubeClientSecrets);
                }
            }

            // Sync channel tokens to disk
            await this.syncTokensToDisk();

            // --- MIGRATION & CONFIG LOADING END ---

            const pythonPath = this.getPythonPath();
            const scriptPath = 'app/main.py';

            // Check if virtualenv exists, if not, warn user (auto-install is complex/risky to do silently)
            if (!fs.existsSync(this.venvPath)) {
                console.warn('⚠️  Virtualenv não encontrado em', this.venvPath);
                console.warn('⚠️  Certifique-se de que as dependências estão instaladas ou crie o venv manualmente.');
                // Fallback to system python if venv missing, or just try to run it
            }

            console.log(`📂 Diretório do App: ${this.appDir}`);
            console.log(`🔧 Executável Python: ${pythonPath}`);

            const args = ['-m', 'streamlit', 'run', scriptPath, '--server.port', '8501', '--server.headless', 'true', '--server.baseUrlPath', '/youtube-app'];

            this.process = spawn(pythonPath, args, {
                cwd: this.appDir,
                shell: true,
                env: { ...processEnv, PORT: '8501' } // Streamlit port
            });

            this.process.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.log(`[Python] ${output}`);
                    this.addLog(output);
                }
            });

            this.process.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.error(`[Python Error] ${output}`);
                    this.addLog(output, true);
                }
            });

            this.process.on('close', (code) => {
                console.log(`🐍 Processo Python encerrado com código ${code}`);
                this.process = null;
            });

            console.log('✅ Serviço Python iniciado (PID:', this.process.pid + ')');

        } catch (error) {
            console.error('❌ Falha ao iniciar serviço Python:', error);
        }
    }

    stop() {
        if (this.process) {
            console.log('🛑 Parando serviço Python...');
            // On Windows, tree-kill might be needed, but standard kill works for many cases
            // Using SIGTERM for graceful shutdown
            this.process.kill('SIGTERM');
            this.process = null;
        }
    }

    getPythonPath() {
        // Prefer venv python if it exists
        const venvPython = this.isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');

        if (fs.existsSync(venvPython)) {
            return venvPython;
        }

        // Fallback to system python
        return this.isWindows ? 'python' : 'python3';
    }
}

module.exports = new PythonService();
