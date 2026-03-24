const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class TradeStatsService {
    constructor() {
        this.process = null;
        this.appDir = path.join(__dirname, '../apps/trade-facil');
        this.venvPath = path.join(this.appDir, 'venv'); // Assuming 'venv' for trade-facil
        this.isWindows = process.platform === 'win32';
        this.logBuffer = []; // Buffer for last 100 lines
    }

    addLog(msg, isError = false) {
        const timestamp = new Date().toISOString();
        const line = `[${timestamp}] ${isError ? 'ERR' : 'LOG'}: ${msg}`;
        this.logBuffer.push(line);
        if (this.logBuffer.length > 100) this.logBuffer.shift();
    }

    async start() {
        console.log('📈 Iniciando serviço Trade Fácil (Flask)...');

        try {
            const pythonPath = this.getPythonPath();
            const scriptPath = 'main.py';

            if (!fs.existsSync(this.appDir)) {
                console.error(`❌ Diretório ${this.appDir} não encontrado.`);
                return;
            }

            const env = {
                ...process.env,
                PORT: '5001',
                PYTHONUNBUFFERED: '1',
                DATABASE_PATH: process.env.DATABASE_PATH || (fs.existsSync('/data') ? '/data' : this.appDir)
            };

            const isRailway = fs.existsSync('/data') || process.env.RAILWAY_STATIC_URL;
            let spawnCmd, spawnArgs;

            if (isRailway && !this.isWindows) {
                // Production: Use gunicorn
                const gunicornPath = path.join(this.venvPath, 'bin', 'gunicorn');
                spawnCmd = fs.existsSync(gunicornPath) ? gunicornPath : 'gunicorn';
                // 1 worker, 1 thread for maximum trace clarity and SQLite safety
                spawnArgs = ['--workers', '1', '--threads', '1', '--bind', '0.0.0.0:5001', '--timeout', '120', '--access-logfile', '-', '--error-logfile', '-', 'main:app'];
                this.addLog(`Iniciando com GUNICORN em: ${spawnCmd}`);
            } else {
                // Development
                spawnCmd = pythonPath;
                spawnArgs = [scriptPath];
                this.addLog("Iniciando com FLASK DEV SERVER");
            }

            this.process = spawn(spawnCmd, spawnArgs, {
                cwd: this.appDir,
                shell: true,
                env
            });

            this.process.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.log(`[TradeFacil] ${output}`);
                    this.addLog(output);
                }
            });

            this.process.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    console.error(`[TradeFacil Error] ${output}`);
                    this.addLog(output, true);
                }
            });

            this.process.on('close', (code) => {
                console.log(`📈 Serviço Trade Fácil encerrado com código ${code}`);
                this.process = null;
            });

        } catch (error) {
            console.error('❌ Falha ao iniciar serviço Trade Fácil:', error);
        }
    }

    stop() {
        if (this.process) {
            console.log('🛑 Parando serviço Trade Fácil...');
            this.process.kill('SIGTERM');
            this.process = null;
        }
    }

    getPythonPath() {
        const venvPython = this.isWindows
            ? path.join(this.venvPath, 'Scripts', 'python.exe')
            : path.join(this.venvPath, 'bin', 'python');

        if (fs.existsSync(venvPython)) {
            return venvPython;
        }
        return this.isWindows ? 'python' : 'python3';
    }
}

module.exports = new TradeStatsService();
