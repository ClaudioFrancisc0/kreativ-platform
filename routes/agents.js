const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const db = require('../database/db');
const multer = require('multer');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const { generateAllLayouts } = require('../generate_arts');

const upload = multer({ dest: 'uploads/' });

// Memória de trabalhos em background para acompanhar o progresso das mídias
const jobs = new Map();

/**
 * GET /api/agents/rb_podcast/number
 */
router.get('/rb_podcast/number', verifyToken, (req, res) => {
    db.get('SELECT value FROM settings WHERE key = ?', ['last_rb_podcast_number'], (err, row) => {
        if (err) return res.status(500).json({ error: 'Erro no bd' });
        res.json({ number: row ? parseInt(row.value) : 0 });
    });
});

/**
 * POST /api/agents/rb_podcast/number
 */
router.post('/rb_podcast/number', verifyToken, express.json(), (req, res) => {
    const { number } = req.body;
    db.run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
        ['last_rb_podcast_number', number.toString(), number.toString()],
        (err) => {
            if (err) return res.status(500).json({ error: 'Erro ao salvar' });
            res.json({ success: true });
        }
    );
});

/**
 * POST /api/agents/rb_podcast/generate
 * Recebe formulário multipart, inicia trabalho background e retorna jobId.
 */
router.post('/rb_podcast/generate', verifyToken, upload.fields([{ name: 'audioFile' }, { name: 'photoFile' }]), async (req, res) => {
    try {
        const { number, gender, name, subject } = req.body;
        
        if (!req.files || !req.files['photoFile']) {
            return res.status(400).json({ error: 'Foto não enviada.' });
        }
        
        const photoFile = req.files['photoFile'][0];
        // const audioFile = req.files['audioFile'][0]; // guardado para a futura integração de vídeo

        const podcastData = {
            number: "Nº " + number,
            guestLabel: gender === 'F' ? 'Convidada:' : 'Convidado:',
            guestName: name,
            title: subject
        };

        const jobId = Date.now().toString();
        const sessionFolder = path.join(__dirname, '..', 'output', `session_${jobId}`);
        const zipFilename = `RB_${number}_Podcast_View.zip`;
        const zipFilePath = path.join(__dirname, '..', 'output', zipFilename);
        
        jobs.set(jobId, { status: 'processing', message: 'Iniciando extração da foto...', downloadUrl: null });

        // Envia a resposta imediatamente ao cliente para startar o preenchimento da barra de progresso
        res.json({ jobId });

        // Inicia a geração em *background*
        (async () => {
            try {
                // 1. Gera todas as artes JPG
                await generateAllLayouts(podcastData, photoFile.path, sessionFolder, (msg) => {
                    if (jobs.has(jobId)) jobs.get(jobId).message = msg;
                });

                if (jobs.has(jobId)) jobs.get(jobId).message = 'Zipando arquivos...';

                // 2. Prepara o arquivo ZIP diretamente no disco
                const outputZip = fs.createWriteStream(zipFilePath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                archive.on('error', (err) => { throw err; });
                
                // Finaliza pipeline do ZIP
                outputZip.on('close', () => {
                    if (jobs.has(jobId)) {
                        jobs.get(jobId).status = 'done';
                        jobs.get(jobId).message = 'Processamento concluído!';
                        jobs.get(jobId).downloadUrl = `/api/agents/rb_podcast/download/${jobId}?file=${encodeURIComponent(zipFilename)}`;
                    }

                    // 3. Limpeza dos arquivos temporários (uploads e outputs folder)
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(sessionFolder)) fs.rmSync(sessionFolder, { recursive: true, force: true });
                            if (fs.existsSync(photoFile.path)) fs.unlinkSync(photoFile.path);
                            if (req.files['audioFile'] && fs.existsSync(req.files['audioFile'][0].path)) {
                                fs.unlinkSync(req.files['audioFile'][0].path);
                            }
                        } catch (cleanupErr) {
                            console.error("Erro no cleanup:", cleanupErr);
                        }
                    }, 5000);
                });

                archive.pipe(outputZip);
                archive.directory(sessionFolder, false);
                await archive.finalize();

            } catch (bgErr) {
                console.error("Erro no job background:", bgErr);
                if (jobs.has(jobId)) {
                    jobs.get(jobId).status = 'error';
                    jobs.get(jobId).message = 'Erro ao processar as mídias.';
                }
            }
        })();

    } catch (err) {
        console.error('Erro na inicialização da geração:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Erro interno ao iniciar os materiais.' });
        }
    }
});

/**
 * GET /api/agents/rb_podcast/status/:jobId
 * Retorna o progresso atual do trabalho
 */
router.get('/rb_podcast/status/:jobId', verifyToken, (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Processo não encontrado.' });
    res.json(job);
});

/**
 * GET /api/agents/rb_podcast/download/:jobId
 * Baixa o arquivo ZIP do job
 */
router.get('/rb_podcast/download/:jobId', verifyToken, (req, res) => {
    const filename = req.query.file;
    if (!filename) return res.status(400).send('Arquivo não especificado.');
    
    const zipPath = path.join(__dirname, '..', 'output', filename);
    if (!fs.existsSync(zipPath)) {
        return res.status(404).send('Arquivo ZIP não encontrado ou expirado.');
    }

    res.download(zipPath, filename, (err) => {
        // Opção: deletar o ZIP após baixar para não acumular lixo
        if (!err) {
            setTimeout(() => {
                if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
                // remove do objeto global de jobs
                jobs.delete(req.params.jobId);
            }, 10000);
        }
    });
});

/**
 * GET /api/agents/available
 * Retorna lista de agentes habilitados para o usuário atual
 */
router.get('/available', verifyToken, (req, res) => {
    try {
        // Parse enabled_agents se for string
        let enabledAgents = req.user.enabled_agents;

        if (typeof enabledAgents === 'string') {
            enabledAgents = JSON.parse(enabledAgents);
        }

        // Default para rb_podcast se não houver configuração
        if (!enabledAgents || !Array.isArray(enabledAgents)) {
            enabledAgents = ['rb_podcast'];
        }

        // Admins têm acesso a tudo
        if (req.user.role === 'admin') {
            enabledAgents = ['rb_podcast'];
        }

        res.json({ enabled_agents: enabledAgents });
    } catch (error) {
        console.error('Erro ao obter agentes disponíveis:', error);
        res.status(500).json({ error: 'Erro ao obter agentes disponíveis' });
    }
});

module.exports = router;
