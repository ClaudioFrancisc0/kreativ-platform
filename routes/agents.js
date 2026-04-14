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

const { extractWhisperData, extractWaveData, generateAnimatedVideo } = require('../services/videoService');

/**
 * POST /api/agents/rb_podcast/analyze
 * Fase 1: Recebe arquivos, chama Whisper e aguarda aprovação manual.
 */
router.post('/rb_podcast/analyze', verifyToken, upload.fields([{ name: 'audioFile' }, { name: 'photoFile' }]), async (req, res) => {
    try {
        const { number, gender, name, subject } = req.body;
        
        if (!req.files || !req.files['photoFile']) {
            return res.status(400).json({ error: 'Foto não enviada.' });
        }
        if (!req.files['audioFile']) {
            return res.status(400).json({ error: 'Áudio MP3 não enviado.' });
        }
        
        const photoFile = req.files['photoFile'][0];
        const audioFile = req.files['audioFile'][0];

        // O Whisper (OpenAI) exige que o arquivo possua a extensão no nome para entender o formato
        const photoExt = path.extname(photoFile.originalname) || '.png';
        const photoNewPath = photoFile.path + photoExt;
        
        const audioExt = path.extname(audioFile.originalname) || '.mp3';
        const audioNewPath = audioFile.path + audioExt;

        fs.renameSync(photoFile.path, photoNewPath);
        fs.renameSync(audioFile.path, audioNewPath);

        const numberFormatted = String(number).padStart(4, '0');

        const podcastData = {
            number: "Nº " + numberFormatted,
            guestLabel: gender === 'F' ? 'Convidada:' : 'Convidado:',
            guestName: name,
            title: subject
        };

        const jobId = Date.now().toString();
        
        jobs.set(jobId, { 
            status: 'analyzing', 
            message: 'Iniciando extração do áudio (Whisper)...', 
            subtitles: null,
            downloadUrl: null,
            // Guardamos os inputs na memória
            podcastData,
            photoPath: photoNewPath,
            audioPath: audioNewPath,
            numberRaw: numberFormatted
        });

        // Retorna o jobId de rastreio imediatamente
        res.json({ jobId });

        // Background: OpenAI e PCM
        (async () => {
            try {
                const job = jobs.get(jobId);
                
                // 1. Whisper API
                const subtitles = await extractWhisperData(job.audioPath);
                job.message = 'Mapeando picos de áudio PCM...';
                
                // 2. Extração PCM
                const amplitudes = await extractWaveData(job.audioPath);
                
                // Ponto de parada!
                job.status = 'review_pending';
                job.message = 'Aguardando aprovação das legendas.';
                job.subtitles = subtitles;
                job.amplitudes = amplitudes;
                
            } catch (bgErr) {
                console.error("Erro na Análise Background:", bgErr);
                if (jobs.has(jobId)) {
                    jobs.get(jobId).status = 'error';
                    jobs.get(jobId).message = 'Erro ao processar as mídias: ' + bgErr.message;
                }
            }
        })();

    } catch (err) {
        console.error('Erro no POST /analyze:', err);
        if (!res.headersSent) res.status(500).json({ error: 'Erro interno ao iniciar a análise.' });
    }
});

/**
 * POST /api/agents/rb_podcast/render
 * Fase 2: Recebe legendas corrigidas e manda renderizar tudo.
 */
router.post('/rb_podcast/render', verifyToken, express.json(), async (req, res) => {
    try {
        const { jobId, finalSubtitles } = req.body;
        const job = jobs.get(jobId);
        
        if (!job) return res.status(404).json({ error: 'Sessão não encontrada ou expirada.' });
        if (job.status !== 'review_pending') return res.status(400).json({ error: 'Job não está pronto para renderização.' });

        job.status = 'processing';
        job.message = 'Gerando Mídias Estáticas...';
        
        res.json({ success: true });

        (async () => {
            const sessionFolder = path.join(__dirname, '..', 'output', `session_${jobId}`);
            const zipFilename = `RB_${job.numberRaw}_Podcast_View.zip`;
            const zipFilePath = path.join(__dirname, '..', 'output', zipFilename);
            
            if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

            try {
                // Delay artificial estendido para a interface conseguir 'printar' a mensagem raiz
                await new Promise(r => setTimeout(r, 2400));

                // 1. JPGs Estáticos
                await generateAllLayouts(job.podcastData, job.photoPath, sessionFolder, (msg) => {
                    job.message = msg;
                });

                // 2. Vídeo MP4 Massivo
                job.message = 'Iniciando Motor Geométrico do Vídeo...';
                await generateAnimatedVideo(job.podcastData, job.photoPath, job.audioPath, finalSubtitles, job.amplitudes, sessionFolder, (msg) => {
                    job.message = msg;
                });

                job.message = 'Compactando arquivos...';
                
                // Delay artificial para que o front-end tenha tempo de buscar a mensagem via polling
                await new Promise(r => setTimeout(r, 800));

                // 3. Empacota tudo
                const outputZip = fs.createWriteStream(zipFilePath);
                const archive = archiver('zip', { zlib: { level: 9 } });

                archive.on('error', (err) => { throw err; });
                
                outputZip.on('close', () => {
                    job.status = 'done';
                    job.message = 'Sucesso Total!';
                    job.downloadUrl = `/api/agents/rb_podcast/download/${jobId}?file=${encodeURIComponent(zipFilename)}`;

                    // Cleanup temporários
                    setTimeout(() => {
                        try {
                            if (fs.existsSync(sessionFolder)) fs.rmSync(sessionFolder, { recursive: true, force: true });
                            if (fs.existsSync(job.photoPath)) fs.unlinkSync(job.photoPath);
                            if (fs.existsSync(job.audioPath)) fs.unlinkSync(job.audioPath);
                        } catch (e) {
                            console.error("Cleanup erro:", e);
                        }
                    }, 10000); // Dá 10 segs por precaução
                });

                archive.pipe(outputZip);
                archive.directory(sessionFolder, false);
                await archive.finalize();

            } catch (renderErr) {
                console.error("Erro na Renderização:", renderErr);
                job.status = 'error';
                job.message = 'Erro catastrófico no motor de vídeo: ' + renderErr.message;
            }
        })();

    } catch (err) {
        console.error("Erro POST /render:", err);
        res.status(500).json({ error: 'Falha server.' });
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
        return res.status(404).send(`
        <html>
            <body style="font-family: sans-serif; text-align: center; margin-top: 100px; background: #0f111a; color: #fff;">
                <h2 style="color: #0d6efd;">Arquivo indisponível</h2>
                <p style="color: #adb5bd; max-width: 400px; margin: 0 auto; line-height: 1.5;">O pacote já foi baixado ou expirou. Por questões de segurança e limite de armazenamento na nuvem, os arquivos gerados são apagados do servidor da Kreativ imedidatamente após o download.</p>
                <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px; background: #0d6efd; color: white; border: none; border-radius: 5px; cursor: pointer;">Fechar Aba</button>
            </body>
        </html>
        `);
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
