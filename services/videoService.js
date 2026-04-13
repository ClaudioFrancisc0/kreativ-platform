const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { execSync } = require('child_process');
const { createCanvas, loadImage, registerFont } = require('canvas');

const ASSETS = path.join(__dirname, '..', 'assets');
try {
    registerFont(path.join(ASSETS, 'New-Highway-Light.otf'),          { family: 'New-Highway', weight: '300' });
    registerFont(path.join(ASSETS, 'New-Highway-Light-Italic.otf'),   { family: 'New-Highway', weight: '300', style: 'italic' });
    registerFont(path.join(ASSETS, 'New-Highway-Regular.otf'),        { family: 'New-Highway', weight: '400' });
    registerFont(path.join(ASSETS, 'New-Highway-Regular-Italic.otf'), { family: 'New-Highway', weight: '400', style: 'italic' });
    registerFont(path.join(ASSETS, 'New-Highway-Medium.otf'),         { family: 'New-Highway', weight: '500' });
    registerFont(path.join(ASSETS, 'New-Highway-Medium-Italic.otf'),  { family: 'New-Highway', weight: '500', style: 'italic' });
    registerFont(path.join(ASSETS, 'New-Highway-Semi-Bold.otf'),      { family: 'New-Highway', weight: '600' });
    registerFont(path.join(ASSETS, 'New-Highway-Semi-Bold-Italic.otf'),{ family: 'New-Highway', weight: '600', style: 'italic' });
    registerFont(path.join(ASSETS, 'New-Highway-Bold.otf'),           { family: 'New-Highway', weight: '700' });
    registerFont(path.join(ASSETS, 'New-Highway-Bold-Italic.otf'),    { family: 'New-Highway', weight: '700', style: 'italic' });
} catch(e) { console.error('Aviso: Fontes não encontradas para videoService'); }

const { drawTextInBox } = require('../generate_arts.js');let ffPath = 'ffmpeg';
try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    ffPath = ffmpegInstaller.path;
} catch (e) {
    console.log("Aviso: @ffmpeg-installer/ffmpeg não carregado. Módulo utilizará ffmpeg nativo do SO.");
}
const configService = require('./configService');
const dotenv = require('dotenv');

dotenv.config();

// Carregamento Lazy e DB-Driven (Agora Dinâmico e Seguro via Admin Panel)
async function getOpenAI() {
    let apiKey = await configService.getOpenAiApiKey();
    if (!apiKey) {
        apiKey = process.env.OPENAI_API_KEY; // Fallback nuvem
    }
    
    if (!apiKey) {
        throw new Error("Chave da API OpenAI não configurada. Defina no Painel Administrativo de Configurações.");
    }
    
    return new OpenAI({ apiKey });
}

// ==== FUNÇÕES AUXILIARES DE RENDER (Da Sandbox) ====
const FPS = 30;
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawStrokedText(ctx, text, x, y, strokeW, fill, stroke) {
    ctx.miterLimit = 2;
    ctx.lineWidth = strokeW;
    ctx.strokeStyle = stroke;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(text, x, y);
}

function standardEaseEase(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function delayedFocusEase(t) {
    let delay = 0.2;
    if (t < delay) return 0;
    let t2 = (t - delay) / (1.0 - delay);
    return Math.pow(Math.sin(t2 * Math.PI / 2), 1.5);
}

function drawGroup(ctx, elements, basex, text, applyBlur = false, forceLeft = false, maxTextWidth = 830) {
    for (let el of elements) {
        if (!el.str || el.str.trim() === '') continue;
        ctx.font = el.font;
        let finalx = basex + el.x;
        let finaly = el.y; // Base Y position computed per element relative to Box Y

        let content = text[el.str] || el.str;
        
        let textScale = 1.0;
        let w = ctx.measureText(content).width;

        // Truncamento Inteligente!
        if (el.class !== "guest_label") { 
             let maxW = el.class === "number" ? 280 : maxTextWidth; 
             if (w > maxW) {
                 textScale = maxW / w; 
             }
        }

        ctx.save();
        ctx.translate(finalx, finaly);
        ctx.scale(textScale, 1.0);
        
        if (applyBlur) {
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;
        }

        if (forceLeft) {
            ctx.textAlign = 'left';
        }

        if (el.stroke) {
            drawStrokedText(ctx, content, 0, 0, el.s_width, el.color, el.stroke_c);
        } else {
            ctx.fillStyle = el.color;
            ctx.fillText(content, 0, 0);
        }

        ctx.restore();
    }
}

function drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentBlur, currentCenterY) {
    const CANVAS_W = 1080;
    const CANVAS_H = 1920;
    const passes = Math.max(1, Math.floor(currentBlur / 60));
    
    let baseCanvas = createCanvas(CANVAS_W, CANVAS_H);
    let baseCtx = baseCanvas.getContext('2d');
    
    baseCtx.save();
    baseCtx.beginPath();
    baseCtx.arc(CANVAS_W / 2, currentCenterY, currentMaskRadius, 0, Math.PI * 2);
    baseCtx.clip();
    
    const dw = guestImg.width * currentScale;
    const dh = guestImg.height * currentScale;
    baseCtx.drawImage(guestImg, (CANVAS_W/2) - (dw/2), currentCenterY - (dh/2), dw, dh);
    baseCtx.restore();

    if (passes <= 1) {
        ctx.drawImage(baseCanvas, 0, 0);
        return;
    }

    let downCanvas = createCanvas(CANVAS_W / 4, CANVAS_H / 4);
    let downCtx = downCanvas.getContext('2d');
    downCtx.drawImage(baseCanvas, 0, 0, CANVAS_W, CANVAS_H, 0, 0, CANVAS_W / 4, CANVAS_H / 4);
    
    let currentCanvas = downCanvas;
    let currentW = CANVAS_W / 4;
    let currentH = CANVAS_H / 4;

    for (let i = 0; i < passes; i++) {
        let nextW = currentW;
        let nextH = currentH;
        let upCanvas = createCanvas(nextW, nextH);
        let uCtx = upCanvas.getContext('2d');
        
        let off = 2;
        uCtx.globalAlpha = 1.0;
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, 0, nextW, nextH);
        uCtx.globalAlpha = 0.5;
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, -off, 0, nextW + off, nextH);
        uCtx.globalAlpha = 0.333;
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, -off, nextW, nextH + off);
        uCtx.globalAlpha = 0.25;
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, off, off, nextW - off, nextH - off);
        
        currentW = nextW;
        currentH = nextH;
        currentCanvas = upCanvas;
    }
    
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1.0;
    ctx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, 0, CANVAS_W, CANVAS_H);
}

// ==== SERVIÇOS EXPORTADOS ====

/**
 * Fase 1: Extrai legendas reais localizadas no tempo (Whisper)
 */
async function extractWhisperData(audioFilePath) {
    if (!fs.existsSync(audioFilePath)) {
        throw new Error("Arquivo de áudio não encontrado " + audioFilePath);
    }
    
    const openaiClient = await getOpenAI();
    const transcription = await openaiClient.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"]
    });

    const phrases = transcription.segments.map(s => ({
        text: s.text.trim(),
        start: s.start,
        end: s.end
    }));

    return phrases;
}

/**
 * Fase 1: Extrair picos de frequência originais (PCM Local FFmpeg)
 */
function extractWaveData(audioFilePath) {
    return new Promise((resolve, reject) => {
        try {
            const absoluteAudioPath = path.resolve(audioFilePath);
            const rawPath = path.join(path.dirname(absoluteAudioPath), `tmp_audio_${Date.now()}.raw`);
            
            if (fs.existsSync(rawPath)) fs.rmSync(rawPath);

            const { execFile } = require('child_process');
            execFile(ffPath, ['-y', '-i', absoluteAudioPath, '-f', 'f32le', '-ac', '1', '-ar', '44100', rawPath], (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error("Erro no FFmpeg (Ondas): " + error.message + " | Detalhes: " + stderr));
                }

                try {
                    const rawBuffer = fs.readFileSync(rawPath);
                    if (rawBuffer.length < 5880) {
                        return reject(new Error(`O arquivo de áudio foi processado gerando 0 frames (vazio). Detalhes do Servidor: ${stderr.substring(0,250)}`));
                    }
                    
                    const bytesPerFrame = 5880; 
                    const totalFrames = Math.floor(rawBuffer.length / bytesPerFrame);
                    const amplitudes = [];

            const barFactors = [0.8, 1.2, 0.9, 1.5, 0.7, 1.8, 0.6, 1.3, 1.0, 1.6, 0.85, 1.4, 0.95];
            let phase = 0;

            for (let f = 0; f < totalFrames; f++) {
                let offset = f * bytesPerFrame;
                let sumSquares = 0;
                let count = 0;
                for (let i = 0; i < bytesPerFrame; i += 16) { 
                    if (offset + i + 4 <= rawBuffer.length) {
                         let val = rawBuffer.readFloatLE(offset + i);
                         sumSquares += val * val;
                         count++;
                    }
                }
                
                let rms = Math.sqrt(sumSquares / count);
                let peak = Math.min(1.0, rms * 8.0);
                
                let bars = [];
                if (peak < 0.05) {
                    for(let b=0; b<13; b++) bars.push(0.05); 
                } else {
                    for(let b=0; b<13; b++) {
                        let modulation = Math.sin(phase * barFactors[b]) * 0.3 + 0.7; 
                        let val = peak * modulation * barFactors[b] * 0.8;
                        bars.push(Math.max(0.05, Math.min(1.0, val)));
                    }
                }
                
                amplitudes.push(bars);
                phase += 0.3;
            }

                
                    if (fs.existsSync(rawPath)) fs.rmSync(rawPath); // Limpa resíduo
                    resolve(amplitudes);
                } catch (internalErr) {
                    reject(new Error("Erro ao processar as ondas de áudio: " + internalErr.message));
                }
            }); // end do exec callback

        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Fase 2: Gera o Vídeo Final com Legendados e PCM Acoplado
 */
async function generateAnimatedVideo(podcastData, photoPath, audioPath, subtitles, amplitudes, sessionFolder, statusCallback = () => {}) {
    const CWD = path.join(__dirname, '..'); // raiz do projeto
    const trackingDataPath = path.join(CWD, 'box_tracking_true.json');
    const trackingData = JSON.parse(fs.readFileSync(trackingDataPath));
    const maxTrackKey = Math.max(...Object.keys(trackingData).map(k => parseInt(k))).toString();
    const guestImg = await loadImage(photoPath);
    const micImgPath = path.join(CWD, 'assets', 'microfone.png');
    const micImg = fs.existsSync(micImgPath) ? await loadImage(micImgPath) : null;
    
    // Carega config baseada no calibrado em Story_1920x1080
    const tcfg = JSON.parse(fs.readFileSync(path.join(CWD, 'templates_config.json')))['Story_1920x1080'];

    const tmpFramesDir = path.join(sessionFolder, 'tmp_frames');
    if (!fs.existsSync(tmpFramesDir)) fs.mkdirSync(tmpFramesDir, { recursive: true });

    const totalFrames = amplitudes.length;
    statusCallback(`🎬 Rastreando ${totalFrames} frames...`);
    
    if (totalFrames === 0) {
        return Promise.reject(new Error(`O áudio processado retornou 0 frames PCM. Arquivo não legível. Path: ${audioPath}`));
    }

    const CANVAS_W = 1080;
    const CANVAS_H = 1920;
    
    // Controles físicos originais
    const SHIFT_START_FRAME = 103.5;
    const SHIFT_END_FRAME = 124; 
    const SHIFT_Y_AMOUNT = 80; 

    // Render loop real
    for (let frameNumber = 1; frameNumber <= totalFrames; frameNumber++) {
        const canvas = createCanvas(CANVAS_W, CANVAS_H);
        const ctx = canvas.getContext('2d');

        // Bounding fundo amarelo nativo
        let bgFrameKey = String(frameNumber).padStart(3, '0');
        let bgFramePath = path.join(CWD, 'cama_frames', `frame_${bgFrameKey}.png`);
        
        // Evita crash se a cama_frames não tiver frames o suficiente pro audio
        if (!fs.existsSync(bgFramePath)) {
            let maxBgKey = fs.existsSync(path.join(CWD, 'cama_frames', `frame_230.png`)) ? 230 : 230;
            bgFramePath = path.join(CWD, 'cama_frames', `frame_${String(maxBgKey).padStart(3, '0')}.png`);
        }
        
        if (fs.existsSync(bgFramePath)) {
            const bgImg = await loadImage(bgFramePath);
            ctx.drawImage(bgImg, 0, 0, CANVAS_W, CANVAS_H);
        } else {
            // Failsafe brutal: pinta de amarelo se der crash nos frames nativos
            ctx.fillStyle = '#dbf227';
            ctx.fillRect(0,0, CANVAS_W, CANVAS_H);
        }

        // Animação Photo (Círculo Central) a partir do TCFG
        let totalZoomFrames = 51; 
        if (frameNumber > 1 && frameNumber < 50) totalZoomFrames = 49;
        let t = 0;
        if (frameNumber >= 30) t = (frameNumber - 30) / totalZoomFrames;
        if (t > 1) t = 1;

        let easedZoomT = standardEaseEase(t);
        let easedBlurT = delayedFocusEase(t);

        let currentCenterY = tcfg.photoCircle.cy; 
        let yShiftOffset = 0;

        if (frameNumber > SHIFT_START_FRAME) {
            let shiftProg = Math.min(1, (frameNumber - SHIFT_START_FRAME) / (SHIFT_END_FRAME - SHIFT_START_FRAME));
            yShiftOffset = SHIFT_Y_AMOUNT * standardEaseEase(shiftProg); 
            currentCenterY += yShiftOffset;
        }

        const startRadius = 2400; 
        const finalRadius = tcfg.photoCircle.radius;
        const currentMaskRadius = startRadius - ((startRadius - finalRadius) * easedZoomT);
        const startScale = (startRadius / finalRadius) * 1.02;
        const finalScale = ((finalRadius * 2) + 2) / guestImg.width;
        const currentScale = startScale - ((startScale - finalScale) * easedZoomT);
        const maxBlur = 1700;
        const currentBlur = Math.max(0, maxBlur - (maxBlur * easedBlurT));

        if (currentBlur > 0.1) {
            drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentCenterY);
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.arc(tcfg.photoCircle.cx, currentCenterY, currentMaskRadius, 0, Math.PI * 2);
            ctx.clip();
            const dw = guestImg.width * currentScale;
            const dh = guestImg.height * currentScale;
            ctx.drawImage(guestImg, tcfg.photoCircle.cx - (dw/2), currentCenterY - (dh/2), dw, dh);
            ctx.restore();
        }

        // ====== INTEGRAÇÃO DE TEXTOS DA LAYER STATICA ======
        let hasData = trackingData[frameNumber.toString()] || trackingData[maxTrackKey];
        if (hasData) {
            // Number (Episode)
            let numStartFr = 63, numEndFr = 72;
            let opac_num = frameNumber <= numStartFr ? 0 : Math.min(1, (frameNumber - numStartFr) / (numEndFr - numStartFr));
            opac_num *= hasData.opacity;
            if (opac_num > 0 && tcfg.elements.number) {
                ctx.globalAlpha = opac_num;
                let cfgNum = { ...tcfg.elements.number, top: tcfg.elements.number.top + yShiftOffset };
                drawTextInBox(ctx, podcastData.number, cfgNum);
            }

            // Texts timing
            let txtStart = 78, txtEnd = 86;
            let opac_txt = frameNumber <= txtStart ? 0 : Math.min(1, (frameNumber - txtStart) / (txtEnd - txtStart));
            opac_txt *= hasData.opacity;

            // Guest Label
            if (opac_txt > 0 && tcfg.elements.guestLabel) {
                ctx.globalAlpha = opac_txt;
                let cfgLbl = { ...tcfg.elements.guestLabel };
                let cy_rest = cfgLbl.top + yShiftOffset;
                if (frameNumber < 100) {
                    let pct = Math.max(0, Math.min(1, (frameNumber - txtStart) / (txtEnd - txtStart)));
                    let cy_start = cy_rest + 40;
                    cfgLbl.top = cy_start + (cy_rest - cy_start) * standardEaseEase(pct);
                } else { cfgLbl.top = cy_rest; }
                drawTextInBox(ctx, podcastData.guestLabel, cfgLbl);
            }

            // Guest Name
            if (opac_txt > 0 && tcfg.elements.guestName) {
                ctx.globalAlpha = opac_txt;
                let cfgNm = { ...tcfg.elements.guestName };
                let cy_rest = cfgNm.top + yShiftOffset;
                if (frameNumber < 100) {
                    let pct = Math.max(0, Math.min(1, (frameNumber - txtStart) / (txtEnd - txtStart)));
                    let cy_start = cy_rest + 80;
                    cfgNm.top = cy_start + (cy_rest - cy_start) * standardEaseEase(pct);
                } else { cfgNm.top = cy_rest; }
                drawTextInBox(ctx, podcastData.guestName, cfgNm);
            }

            // Title
            let titleStart = 72, titleEnd = 80;
            let opac_title = frameNumber <= titleStart ? 0 : Math.min(1, (frameNumber - titleStart) / (titleEnd - titleStart));
            opac_title *= hasData.opacity;
            if (opac_title > 0 && tcfg.elements.title) {
                ctx.globalAlpha = opac_title;
                let cfgTit = { ...tcfg.elements.title };
                let cy_rest = cfgTit.top + yShiftOffset;
                if (frameNumber < 100) {
                    let pct = Math.max(0, Math.min(1, (frameNumber - titleStart) / (titleEnd - titleStart)));
                    let cy_start = cy_rest + 10;
                    cfgTit.top = cy_start + (cy_rest - cy_start) * standardEaseEase(pct);
                } else { cfgTit.top = cy_rest; }
                drawTextInBox(ctx, podcastData.title, cfgTit);
            }
        }

            // ================== AUDIO WAVES E LEGENDAS =================
            const AUDIO_DELAY = 1.5; 
            let t_seconds = (frameNumber / 30.0) - AUDIO_DELAY;
            
            ctx.save();
            let fadeAlpha = 1.0;
            let fs_start = 50, fs_end = 90;
            if (frameNumber < fs_start) fadeAlpha = 0.0;
            else if (frameNumber < fs_end) {
                fadeAlpha = (frameNumber - fs_start) / (fs_end - fs_start);
            }
            ctx.globalAlpha = fadeAlpha * hasData.opacity;

            // Audio Waves Estacionárias com Picos Reais
            let waveY = 1522; 
            let targetBars = 13;
            let barWidth = 3; 
            let barSpacing = 10; 
            let totalWaveWidth = targetBars * barSpacing;
            let waveX = 540 - (totalWaveWidth / 2) + (barWidth / 2);
            
            let audioFrame = Math.floor(frameNumber - (AUDIO_DELAY * 30));
            let amps = null;
            if (audioFrame >= 0 && audioFrame < amplitudes.length) {
                 amps = amplitudes[audioFrame];
            }
            if (!amps) amps = new Array(targetBars).fill(0.05);

            for (let b = 0; b < amps.length; b++) {
                if (b >= targetBars) break;
                let bh = amps[b] * 75; 
                ctx.fillStyle = '#FFFFFF';
                drawRoundedRect(ctx, waveX + b*barSpacing, waveY - bh/2, barWidth, Math.max(1, bh), 2);
                ctx.fill();
            }

            // Subtitles Whisper acopladas ao Círculo 
            let finalSubY = 1290;
            let currentSubYOffset = yShiftOffset;
            let subY = (finalSubY - SHIFT_Y_AMOUNT) + currentSubYOffset; 
            let subX = 540; 
            let maxWidth = 880; 
            let fSize = 25; 
            
            let activePhrase = subtitles.find(p => t_seconds >= p.start && t_seconds <= p.end);
            
            if (activePhrase && activePhrase.text) {
                ctx.font = `600 ${fSize}px 'Inter'`;
                let words = activePhrase.text.split(' ');
                
                let lines = [];
                let currentLine = words[0];
                for (let i = 1; i < words.length; i++) {
                    let testLine = currentLine + " " + words[i];
                    if (ctx.measureText(testLine).width > maxWidth) {
                        lines.push(currentLine);
                        currentLine = words[i];
                    } else {
                        currentLine = testLine;
                    }
                }
                lines.push(currentLine);
                
                // Redimensionando caixas e linhas
                let lineHeighSp = 32;
                let ptY_offset = -6;
                let boxHeight = 44; 
                if (lines.length === 2) {
                    ptY_offset = -20;
                    boxHeight = 74;
                } else if (lines.length >= 3) {
                    ptY_offset = -38;
                    boxHeight = 106;
                }
                
                let longestLineWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
                let boxWidth = longestLineWidth + 60; 

                ctx.fillStyle = '#006bff';
                drawRoundedRect(ctx, subX - boxWidth/2, subY + ptY_offset - 20, boxWidth, boxHeight, 15);
                ctx.fill();

                ctx.fillStyle = '#FFFFFF';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                
                let textStartY = subY + ptY_offset + (lines.length === 1 ? 2 : (lines.length === 2 ? 0 : -2));
                let lineCountY = textStartY;
                
                for (let textLine of lines) {
                    ctx.fillText(textLine, subX, lineCountY);
                    lineCountY += lineHeighSp; 
                }
            }

            ctx.restore();

            // Mic
            if (micImg) {
                let mic_restY = 1035; 
                let cx_mic = 170; 
                let cy_mic = mic_restY; 
                if (frameNumber < 100) {
                    let pct = Math.max(0, Math.min(1, (frameNumber - 76) / (85 - 76)));
                    let mic_startY = mic_restY + 25; 
                    let mic_startX = -150; 
                    cx_mic = mic_startX + (170 - mic_startX) * standardEaseEase(pct);
                    cy_mic = mic_startY + (mic_restY - mic_startY) * standardEaseEase(pct);
                }
                cy_mic += yShiftOffset;

                let micOpac = frameNumber <= 76 ? 0 : Math.min(1, (frameNumber - 76) / (85 - 76));
                ctx.globalAlpha = micOpac * hasData.opacity;
                const mScale = 0.5;
                ctx.drawImage(micImg, cx_mic - (micImg.width*mScale)/2, cy_mic - (micImg.height*mScale)/2, micImg.width*mScale, micImg.height*mScale);
            }
        }

        // Salvar Frame em formato PNG Stream Rápido (Conserva a Transparência Alfa sem estourar o limite da V8)
        const outName = `frame_${String(frameNumber).padStart(3, '0')}.png`;
        const outPath = path.join(tmpFramesDir, outName);
        
        await new Promise((res, rej) => {
            const out = fs.createWriteStream(outPath);
            const stream = canvas.createPNGStream({ compressionLevel: 2 });
            stream.pipe(out);
            out.on('finish', res);
            out.on('error', rej);
        });
        
        if (frameNumber % 15 === 0) {
            statusCallback(`🎬 Rastreando frame ${frameNumber}/${totalFrames}...`);
            await new Promise(r => setTimeout(r, 0)); // Respira para o Garbage Collector do V8 engine
        }
    }

    // Failsafe de diagnóstico para saber se os arquivos físicos realmente estão disco!
    const frameFiles = fs.readdirSync(tmpFramesDir).filter(f => f.endsWith('.png'));
    if (frameFiles.length === 0) {
        return Promise.reject(new Error(`Diagnóstico: A pasta tmp_frames continua vazia apesar de rodar o loop. Error writeFileSync.`));
    }

    statusCallback('🎥 Montando arquivo MP4 final...');
    
    return new Promise((resolve, reject) => {
        const rawNum = String(podcastData.number || '0000').replace(/\D/g, '');
        const epNumber = rawNum.padStart(4, '0');
        const outFileName = `Reels Animado_${epNumber}_legendado.mp4`;
        const outFile = path.resolve(path.join(sessionFolder, outFileName));
        const framesPattern = path.join(tmpFramesDir, 'frame_%03d.png');
        const absAudioPath = path.resolve(audioPath);
        
        const args = [
            '-loglevel', 'error', '-y',
            '-framerate', FPS.toString(),
            '-i', framesPattern,
            '-i', absAudioPath,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
            '-af', 'adelay=1500|1500', '-c:a', 'aac', '-shortest', outFile
        ];

        const { execFile } = require('child_process');
        execFile(ffPath, args, (error, stdout, stderr) => {
            if (error) {
                return reject(new Error("Erro ao montar ffmpeg: " + error.message + " | Detalhes: " + stderr));
            }
            
            try {
                // Clean up PNG frames
                if (fs.existsSync(tmpFramesDir)) fs.rmSync(tmpFramesDir, { recursive: true, force: true });
                resolve(outFileName);
            } catch (fsErr) {
                console.error("CleanUp tmpFrames error:", fsErr);
                resolve(outFileName); // Resolve mesmo assim pra não quebrar a entrega
            }
        });
    });
}

module.exports = {
    extractWhisperData,
    extractWaveData,
    generateAnimatedVideo
};
