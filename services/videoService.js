const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { execSync } = require('child_process');
const { createCanvas, loadImage, registerFont } = require('canvas');

const ASSETS = path.join(__dirname, '..', 'assets');
try {
    registerFont(path.join(ASSETS, 'New-Highway-Light.otf'), { family: 'New-Highway', weight: '300' });
    registerFont(path.join(ASSETS, 'New-Highway-Regular.otf'), { family: 'New-Highway', weight: '400' });
    registerFont(path.join(ASSETS, 'New-Highway-Bold.otf'), { family: 'New-Highway', weight: '700' });
    registerFont(path.join(ASSETS, 'New-Highway-Semi-Bold.otf'), { family: 'New-Highway', weight: '600' });
} catch (e) {
    console.error("Font error:", e);
}

let ffPath = 'ffmpeg';
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

function drawMultilineText(ctx, text, x, y, maxWidth, lineHeight, isAlignRight = false) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            if (isAlignRight) {
                let w = ctx.measureText(line).width;
                ctx.fillText(line, x - w, currentY);
            } else {
                ctx.fillText(line, x, currentY);
            }
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    if (isAlignRight) {
        let w = ctx.measureText(line).width;
        ctx.fillText(line, x - w, currentY);
    } else {
        ctx.fillText(line, x, currentY);
    }
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

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

// Motor Kawase Blur (Upsampling Iterativo)
function drawImageWithBlur(ctx, img, currentScale, currentMaskRadius, blurAmount, currentCenterY) {
    const CANVAS_W = 1080;
    const CANVAS_H = 1920;

    if (blurAmount < 1) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(CANVAS_W / 2, currentCenterY, currentMaskRadius, 0, Math.PI * 2);
        ctx.clip();
        
        let fw = img.width * currentScale;
        let fh = img.height * currentScale;
        let fx = (CANVAS_W / 2) - (fw / 2);
        let fy = currentCenterY - (fh / 2);
        
        ctx.drawImage(img, fx, fy, fw, fh);
        ctx.restore();
        return;
    }
    
    const shrinkFactor = Math.max(1, blurAmount / 45);
    let currentW = Math.max(2, Math.floor(CANVAS_W / shrinkFactor));
    let currentH = Math.max(2, Math.floor(CANVAS_H / shrinkFactor));
    
    let currentCanvas = createCanvas(currentW, currentH);
    let tCtx = currentCanvas.getContext('2d');
    tCtx.imageSmoothingEnabled = true;
    
    tCtx.save();
    tCtx.beginPath();
    tCtx.arc(currentW / 2, (currentCenterY / shrinkFactor), currentMaskRadius / shrinkFactor, 0, Math.PI * 2);
    tCtx.clip();
    
    const dw = img.width * currentScale / shrinkFactor;
    const dh = img.height * currentScale / shrinkFactor;
    tCtx.drawImage(img, (currentW/2) - (dw/2), (currentCenterY / shrinkFactor) - (dh/2), dw, dh);
    tCtx.restore();
    
    while (currentW < CANVAS_W && currentW < 800) {
        let nextW = Math.min(CANVAS_W, Math.floor(currentW * 1.5));
        let nextH = Math.min(CANVAS_H, Math.floor(currentH * 1.5));
        
        let upCanvas = createCanvas(nextW, nextH);
        let uCtx = upCanvas.getContext('2d');
        uCtx.imageSmoothingEnabled = true;

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

    // O Loop Dinâmico agora é nativo no FFmpeg via -stream_loop, então o node não rastreia.

    // Memory Pooling for Performance & OOM Prevention!
    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx = canvas.getContext('2d');
    
    const blurPools = {
        baseCanvas: createCanvas(CANVAS_W, CANVAS_H),
        baseCtx: createCanvas(CANVAS_W, CANVAS_H).getContext('2d'),
        downCanvas: createCanvas(CANVAS_W / 4, CANVAS_H / 4),
        downCtx: createCanvas(CANVAS_W / 4, CANVAS_H / 4).getContext('2d'),
        upCanvas1: createCanvas(CANVAS_W / 4, CANVAS_H / 4),
        upCtx1: createCanvas(CANVAS_W / 4, CANVAS_H / 4).getContext('2d'),
        upCanvas2: createCanvas(CANVAS_W / 4, CANVAS_H / 4),
        upCtx2: createCanvas(CANVAS_W / 4, CANVAS_H / 4).getContext('2d')
    };

    // We add +45 frames (1.5 seconds) to ensure the delayed audio finishes playing completely
    const totalVideoFrames = totalFrames + 45; 

    // Render loop real
    for (let frameNumber = 1; frameNumber <= totalVideoFrames; frameNumber++) {
        // Clear globally allocated ctx instead of redefining
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        // Fundo absolutamente transparente para viabilizar Overlay no FFmpeg final (sem os cama_frames locais ignorados pelo git)

        // Animação Photo (Círculo Central)
        let totalZoomFrames = 45; // 1.5 s
        let t = frameNumber / totalZoomFrames;
        if (t > 1) t = 1;

        let easedZoomT = standardEaseEase(t);

        let currentCenterY = 950; // Centralizado nativo default
        let yShiftOffset = 0;

        if (frameNumber > SHIFT_START_FRAME) {
            let shiftProg = Math.min(1, (frameNumber - SHIFT_START_FRAME) / (SHIFT_END_FRAME - SHIFT_START_FRAME));
            yShiftOffset = SHIFT_Y_AMOUNT * standardEaseEase(shiftProg); 
            currentCenterY += yShiftOffset;
        }

        const startRadius = 2400; 
        const finalRadius = 270;
        const currentMaskRadius = startRadius - ((startRadius - finalRadius) * easedZoomT);
        
        const startScale = (startRadius / finalRadius) * 1.02;
        const finalScale = ((finalRadius * 2) + 2) / guestImg.width;
        
        const currentScale = startScale - ((startScale - finalScale) * easedZoomT);
        
        let easedBlurT = delayedFocusEase(t);
        const maxBlur = 1700;
        const currentBlur = Math.max(0, maxBlur - (maxBlur * easedBlurT));

        if (currentBlur > 0.1) {
            drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentBlur, currentCenterY);
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.arc(CANVAS_W / 2, currentCenterY, currentMaskRadius, 0, Math.PI * 2);
            ctx.clip();
            const dw = guestImg.width * currentScale;
            const dh = guestImg.height * currentScale;
            ctx.drawImage(guestImg, (CANVAS_W/2) - (dw/2), currentCenterY - (dh/2), dw, dh);
            ctx.restore();
        }


        // V74 CORE RESTORED
        const rawNum = String(podcastData.number || '0000').replace(/\D/g, '');
        let hasData = trackingData[frameNumber.toString()];
        let prevData = trackingData[(frameNumber - 1).toString()] || hasData;
        
        if (!hasData) {
            let keys = Object.keys(trackingData).map(Number);
            let maxKey = Math.max(...keys);
            // Só fazemos fallback de tracking para segurar a posição APÓS a animação de entrada terminar.
            // Para frames antes da entrada (frameNumber < minKey), hasData continua indefinido e nada é desenhado,
            // garantindo o timing perfeito da cama.
            if (frameNumber > maxKey) {
                hasData = trackingData[maxKey.toString()];
                prevData = hasData;
            }
        }
    
    
    

    // Load mock subtitles/waves
    

    if (hasData) {
        // === MOTOR DE TRACKING BASE (DA CAMA) ===
        let base_maxX = hasData.maxX;
        let base_maxY = hasData.maxY;
        let p_maxX = prevData ? prevData.maxX : base_maxX;
        let p_maxY = prevData ? prevData.maxY : base_maxY;

        // O X vai de 0 (fora) até ~317 (repouso 1). Extraio o percentual t = 0.0 até 1.0!
        // Sabendo que 317 é o final do frame 80!
        let t_progress = Math.min(1.0, Math.max(0.0, (base_maxX - 80) / (317 - 80))); // 80 de margem inicial onde minX=0 ainda estava fora
        // Para uma precisão perfeita com a visualização do AE, como eles rodam juntos, vamos
        // abstrair um "distanciamento dinâmico": todo componente Textual entrará com um offset 
        // decrescente baseado nesse Tracking base_maxX!
        
        // A quina rastreada vai crescendo até chegar a 317 no Final do Repouso 1 (cravado F80).
        let slide_offset = Math.max(0, 317 - base_maxX); 
        
        // As posições de repouso configuradas lá no nosso templates_config.json (Reels / Story)
        const TEMPLATE = {
            guestName: { left: 69, top: 1474, width: 440, height: 150, font: '78px "New-Highway-Bold"', lh: 84 },
            title: { right: 1022, top: 1428, width: 482, height: 260, font: '44px "New-Highway-Regular"', lh: 63.8, align: "right" }
        };

        // Y shift de queda livre (a partir do repouso 1)
        // No repouso 1 (F80), maxY era 513. Se for maior que 515, é porque iniciou a queda.
        let fall_shiftY = Math.max(0, base_maxY - 513); 
        
        // A proporção fotográfica calculada: enquanto a Cama cai 1038px (1551-513), 
        // a câmera (BACKGROUND) scrolla apenas 912.5px! Este é um efeito Parallax/Pan do projeto nativo!
        let bg_scrollY = fall_shiftY * (912.5 / 1038.0);

        // Delta V puro em X e Y para calcularmos a severidade do Motion Blur
        let blur_vx = base_maxX - p_maxX;
        let blur_vy = base_maxY - p_maxY;
        let speed = Math.sqrt(blur_vx*blur_vx + blur_vy*blur_vy);
        let blurSteps = speed > 2 ? Math.min(24, Math.ceil(speed)) : 0;

        // Função de Injeção de Componente com Sub-Blur:
        const drawComponent = (textList, yOffset, block, isRightSide = false, isDiagonalAsc = false) => {
            if (t_progress <= 0) return; // Prevent early ghost apparition when sliding hasn't commenced
            
            ctx.save();
            ctx.textAlign = block.align || "left";
            ctx.textBaseline = "alphabetic"; 

            // Se for Right Side, o Slide Offset inverte (ele entra da extrema direita pra dentro)
            let anchorX = isRightSide ? block.right : block.left;
            let currentSlide = isRightSide ? slide_offset : -slide_offset;
            let dir_blur_vx = isRightSide ? -blur_vx : blur_vx;

            let dynX = anchorX + currentSlide;
            // ATENÇÃO: Os textos inferiores sobem ("- bg_scrollY") de acordo com o Pan fotográfico
            let dynY = block.top - bg_scrollY + yOffset;

            // Diagonal Slide para a entrada (se ativo) - começa mais abaixo (+Y) e chega no (0)
            if (isDiagonalAsc) {
                dynY += (slide_offset * 0.75); // Maior inclinação, vindo bem mais baixo
            }
            
            if (blurSteps > 0) {
                ctx.globalAlpha = 0.8 / blurSteps;
                for (let i = 0; i < blurSteps; i++) {
                    let f = (i / blurSteps) - 0.5;
                    ctx.fillStyle = '#FFFFFF'; 
                    textList.forEach(t => {
                        let subY = dynY + blur_vy*f + t.dy;
                        if(isDiagonalAsc) subY += (dir_blur_vx*f * -0.75);
                        drawMultilineText(ctx, t.txt, dynX + dir_blur_vx*f, subY, block.width, block.lh || 0);
                    });
                }
                ctx.globalAlpha = 0.5;
            } else {
                ctx.globalAlpha = 1.0;
            }
            ctx.fillStyle = '#FFFFFF'; 
            textList.forEach(t => {
                drawMultilineText(ctx, t.txt, dynX, dynY + t.dy, block.width, block.lh || 0);
            });
            ctx.restore();
        };

        // COMPONENTE 1: O NÚMERO
        {
            let numExtraX = base_maxX - 131.5;
            let numExtraY = base_maxY - 29.5; 
            ctx.save();
            ctx.font = '600 36px "New-Highway"';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = '#3571FE'; // Match parameter blue for video
            if (blurSteps > 0) {
                ctx.globalAlpha = 0.8 / blurSteps;
                for (let i = 0; i < blurSteps; i++) {
                    let f = (i / blurSteps) - 0.5;
                    ctx.fillText(rawNum, numExtraX + blur_vx*f, numExtraY + blur_vy*f + 1);
                }
                ctx.globalAlpha = 1.0;
            }
            ctx.fillText(rawNum, numExtraX, numExtraY + 1);
            
            ctx.restore();
        }

        // COMPONENTE 2: GUEST LABEL & GUEST NAME
        // O GuestLabel ("CONVIDADO:") está gravado fisicamente no mp4 cama_sem_mic.mp4
        
        ctx.font = '700 70px "New-Highway"';
        let guestNameStr = podcastData.guestName || "";
        let words = guestNameStr.split(" ");
        let lines = [];
        let currentLine = "";
        for (let i = 0; i < words.length; i++) {
            let testLine = currentLine + words[i] + " ";
            if (ctx.measureText(testLine.trim()).width > 440 && i > 0) {
                lines.push(currentLine.trim());
                currentLine = words[i] + " ";
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine.trim());
        
        // Ensure max 3 lines (though 440px width usually splits 3 words into max 3 lines anyway)
        if (lines.length > 3) lines = lines.slice(0, 3);
        
        let compLines = lines.map((l, idx) => ({ txt: l, dy: idx * 76 }));
        drawComponent(compLines, 0, { left: 54, top: 1474, width: 480, align: "left" }, false, true);
        
        // COMPONENTE 3: TITLE
        ctx.font = '400 36px "New-Highway"';
        let subj = (podcastData.title || "ASSUNTO AQUI").replace(/\.$/, "");
        let sWords = subj.split(" ");
        let linesTitle = null;
        let finalTitleString = sWords.join(" ");
        
        if (ctx.measureText(finalTitleString).width <= 482) {
            linesTitle = [finalTitleString];
        } else {
            let mid = Math.ceil(sWords.length / 2);
            let l1 = sWords.slice(0, mid).join(" ");
            let l2 = sWords.slice(mid).join(" ");
            if (ctx.measureText(l1).width <= 482 && ctx.measureText(l2).width <= 482) {
                linesTitle = [l1, l2];
            } else {
                let third = Math.ceil(sWords.length / 3);
                let l1_3 = sWords.slice(0, third).join(" ");
                let l2_3 = sWords.slice(third, third * 2).join(" ");
                let l3_3 = sWords.slice(third * 2).join(" ");
                if (ctx.measureText(l1_3).width <= 482 && 
                    ctx.measureText(l2_3).width <= 482 && 
                    ctx.measureText(l3_3).width <= 482) {
                    linesTitle = [l1_3, l2_3, l3_3].filter(l => l.length > 0);
                }
            }
        }
        
        if (!linesTitle) {
            linesTitle = [];
            let curLine = "";
            for (let i = 0; i < sWords.length; i++) {
                let testLine = curLine + sWords[i] + " ";
                if (ctx.measureText(testLine.trim()).width > 482 && i > 0) {
                    linesTitle.push(curLine.trim());
                    curLine = sWords[i] + " ";
                } else {
                    curLine = testLine;
                }
            }
            linesTitle.push(curLine.trim());
        }

        if (linesTitle.length > 3) linesTitle = linesTitle.slice(0, 3);
        if (linesTitle.length > 0) linesTitle[linesTitle.length - 1] += ".";

        let titleComps = linesTitle.map((l, idx) => ({ txt: l, dy: idx * 50 }));
        // Ajustamos para 1045 em vez de 1015 para ir mais para a direita conforme pedido!
        drawComponent(titleComps, 0, { right: 1045, top: 1428, width: 482, align: "right" }, true, false);

        // COMPONENTE 4: ONDAS SONORAS E LEGENDAS!
        // FIXED POSITION AT BOTTOM, NO PARALLAX, WITH FADE IN
        const AUDIO_DELAY = 1.5; // Audio start delayed by 1.5 seconds
        let t_seconds = (frameNumber / 30.0) - AUDIO_DELAY;
        
        ctx.save();
        
        // Fade in começa lá no frame 50 e vai até 100
        let fadeAlpha = Math.max(0, Math.min(1.0, (frameNumber - 50) / 40.0));
        ctx.globalAlpha = fadeAlpha;
        
        // 4.1 Audio Waves -> Posição Fixa no Rodapé e Centralizadas
        let waveY = 1522; // Subiu 8px p/ nivelar com o Podcast Logo
        
        let targetBars = 13;
        let barWidth = 3; // Mais fina ainda conforme solicitado
        let barSpacing = 10; // Reduz gap proporcionalmente
        let totalWaveWidth = targetBars * barSpacing;
        
        // Centralizando brutalmente no meio do eixo X (540)
        let waveX = 540 - (totalWaveWidth / 2) + (barWidth / 2);
        
        // Pega as amlitudes ou default
        let audioFrame = Math.floor(frameNumber - (AUDIO_DELAY * 30));
        let amps = null;
        if (audioFrame >= 0) {
             amps = amplitudes[audioFrame];
        }
        if (!amps) amps = amplitudes[amplitudes.length - 1] || new Array(targetBars).fill(0.1);
        
        for (let b = 0; b < amps.length; b++) {
            if (b >= targetBars) break;
            let bh = amps[b] * 75; // Mais altas
            ctx.fillStyle = '#FFFFFF';
            drawRoundedRect(ctx, waveX + b*barSpacing, waveY - bh/2, barWidth, bh, 3);
            ctx.fill();
        }

        // 4.2 Legendas Flutuantes Dinâmicas (Grudada no Círculo da Foto)
        // Descemos os 10px aprovados (target final = 1300). 
        // Como ela anda atrelada ao circulo da foto, seu Y nativo sofre o mesmo yShiftOffset
        let finalSubY = 1300;
        let subY = (finalSubY - SHIFT_Y_AMOUNT) + yShiftOffset; 

        let subX = 540; // centralizado
        let maxWidth = 750; // máx width para 2 linhas
        let fSize = 40; 
        
        ctx.font = `600 ${fSize}px "New-Highway"`;
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        
        let activeSubtitle = null;
        for (let i = 0; i < subtitles.length; i++) {
            let s = subtitles[i];
            if (t_seconds >= s.start && t_seconds <= s.end) {
                activeSubtitle = s.text;
                break;
            }
        }
        
        if (activeSubtitle) {
            let words = activeSubtitle.split(" ");
            let lines = [];
            let currentLine = "";
            let maxLineWidth = 0;
            
            for(let i = 0; i < words.length; i++) {
                let testLine = currentLine + words[i] + " ";
                let metrics = ctx.measureText(testLine);
                if(metrics.width > maxWidth && i > 0) {
                    lines.push(currentLine.trim());
                    currentLine = words[i] + " ";
                } else {
                    currentLine = testLine;
                }
            }
            lines.push(currentLine.trim());
            
            for(let l of lines) {
                let w = ctx.measureText(l).width;
                if(w > maxLineWidth) maxLineWidth = w;
            }
            
            let padX = 30;
            let padY = 20;
            let boxWidth = maxLineWidth + padX*2;
            let boxHeight = (lines.length * (fSize + 10)) + padY*2 - 10;
            
            // Fundo Azul
            ctx.fillStyle = '#3571FE';
            drawRoundedRect(ctx, subX - boxWidth/2, subY, boxWidth, boxHeight, 15);
            ctx.fill();
            
            // Texto Branco
            ctx.fillStyle = '#FFFFFF';
            let ly = subY + padY;
            for(let l of lines) {
                ctx.fillText(l, subX, ly);
                ly += fSize + 10;
            }
        }
        ctx.restore();
        
    }
    // ====== MÁQUINA DE ESTADOS DO MICROFONE ======
    // CANVAS TELA: Largura (X) = 1080 | Altura (Y) = 1920 (Centro absoluto: X=540, Y=960).

    // --> 1. POSIÇÃO INICIAL (Origem)
    // Fica invisível à esquerda. Y foi "subido" (Valor Y menor no Canvas).
    const posX_Start = -micImg.width; 
    const posY_Start = 1035; // Nascia no 1060, subimos 25px.
    
    // --> 2. POSIÇÃO DE POUSO (Aterrissagem sobre a foto)
    const posX_Pouso = 300; 
    const posY_Pouso = 1000; 
    
    // --> 3. POSIÇÃO FINAL (Recuo no Eixo X)
    const posX_Final = 170; // Mais para esquerda ainda (20px a menos)
    const posY_Final = 1000; 

    let cx_mic = posX_Start;
    let cy_mic = posY_Start;

    if (frameNumber >= 15) { 
        if (frameNumber <= 80) {
            // Fase 2: Entrada do Mic
            // Usamos easeOutCubic no lugar da curva nativa pra frear violentamente.
            // (Atrasado inicio em +15 frames, forçando uma velocidade muito maior pra cumprir o alvo no frame 80)
            let progress = (frameNumber - 15) / (80 - 15);
            let ease = easeOutCubic(progress); 
            cx_mic = posX_Start + (posX_Pouso - posX_Start) * ease;
            cy_mic = posY_Start + (posY_Pouso - posY_Start) * ease;
        } 
        else if (frameNumber <= 85) {
            // Fase 3: Hold ultra-precocce engordado em +15 frames de pura contemplação
            cx_mic = posX_Pouso;
            cy_mic = posY_Pouso;
        } 
        else if (frameNumber <= 145) {
            // Fase 4: O Recuo. Espalhamos o recuo denovo, diluindo-os para arrastar por 60 quadros
            // voltando a ficar bem devagar e engatilhando aos 3.5s.
            let progress = (frameNumber - 85) / (145 - 85);
            let ease = standardEaseEase(progress); 
            cx_mic = posX_Pouso + (posX_Final - posX_Pouso) * ease;
            cy_mic = posY_Pouso + (posY_Final - posY_Pouso) * ease;
        } 
        else {
            // Fase 5: Estático
            cx_mic = posX_Final;
            cy_mic = posY_Final;
        }
        
        // ALINHAMENTO GEOMÉTRICO EXTREMO: 
        // O Microfone amarra e desce "+80px" sofrendo os efeitos mortais da gravidade 
        // embutidos no yShiftOffset global para não descolar da Foto em movimento!
        cy_mic += yShiftOffset;

        if (micImg) {
            let micScale = 1.0;
            ctx.drawImage(micImg, cx_mic, cy_mic, micImg.width * micScale, micImg.height * micScale);
        }
    }

        const frameTitle = String(frameNumber).padStart(3, '0');
        
        const buf = canvas.toBuffer('image/png'); // Default compression, yields 50kb per frame safely
        fs.writeFileSync(path.join(tmpFramesDir, `frame_${frameTitle}.png`), buf);

        // Libera o EventLoop completamente e dá fôlego pro GC (Garbage Collector)
        await new Promise(r => setTimeout(r, 1));
        
        statusCallback(`🎬 Rastreando ${frameNumber} de ${totalVideoFrames} frames...`);
    }

        const rawNum = String(podcastData.number || '0000').replace(/\D/g, '');
        const epNumber = rawNum.padStart(4, '0');
        const outFileName = `Reels Animado_${epNumber}_legendado.mp4`;
        const outFile = path.resolve(path.join(sessionFolder, outFileName));
        
        const framesPattern = path.join(tmpFramesDir, 'frame_%03d.png');
        const absAudioPath = path.resolve(audioPath);
        
        const camaVideo = path.join(CWD, 'assets', 'cama_sem_mic.mp4');
        statusCallback(`🎬 Gerando Reels Animado_legendado...`);
        await new Promise(r => setTimeout(r, 400));
        
        const args = [
            '-loglevel', 'error', '-y',
            '-stream_loop', '-1', // Loop adaptável
            '-r', '30',           // Força CFR no input para zerar o atraso (desync frames do tracking!)
            '-i', camaVideo,      // [0] Background MP4 local
            '-framerate', FPS.toString(),
            '-start_number', '1', 
            '-i', framesPattern,  // [1] Overlay gerado (PNGs transparentes)
            '-i', absAudioPath,   // [2] Origem de áudio
            '-filter_complex', '[0:v][1:v]overlay=shortest=1[outv]',
            '-map', '[outv]',
            '-map', '2:a',
            '-c:v', 'libx264', '-preset', 'fast', '-pix_fmt', 'yuv420p',
            '-af', 'adelay=1500|1500', '-c:a', 'aac', '-shortest', outFile
        ];

        const { execFile } = require('child_process');
        return new Promise((resolve, reject) => {
            execFile(ffPath, args, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error("Erro ao montar ffmpeg: " + error.message + " | Detalhes: " + stderr));
                }
                try {
                    if (fs.existsSync(tmpFramesDir)) fs.rmSync(tmpFramesDir, { recursive: true, force: true });
                    resolve(outFileName);
                } catch (fsErr) {
                    console.error("CleanUp tmpFrames error:", fsErr);
                    resolve(outFileName);
                }
            });
        });
}

module.exports = {
    extractWhisperData,
    extractWaveData,
    generateAnimatedVideo
};
