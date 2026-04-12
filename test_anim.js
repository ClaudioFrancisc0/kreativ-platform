const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const ASSETS = path.join(__dirname, 'assets');
try {
    registerFont(path.join(ASSETS, 'New-Highway-Semi-Bold.otf'), { family: 'New-Highway', weight: '600' });
    registerFont(path.join(ASSETS, 'New-Highway-Bold.otf'), { family: 'New-Highway-Bold' });
    registerFont(path.join(ASSETS, 'New-Highway-Regular.otf'), { family: 'New-Highway-Regular' });
    registerFont(path.join(ASSETS, 'New-Highway-Light.otf'), { family: 'New-Highway-Light' });
} catch (e) {
    console.error('Fonte não encontrada para o render!', e.message);
}

// Auxiliar para desenhar blocos de texto multilinha
function drawMultilineText(ctx, text, x, y, maxWidth, lineHeight, isAlignRight = false) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, currentY);
}

// Auxiliar para desenhar retângulo arredondado no Canvas
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

const FPS = 30;
// A foto agora é a FASE 1 da nossa arquitetura multifásica.
const PHOTO_TOTAL_FRAMES = 45; 
// O tempo do Pulo Geográfico (Inversão) flutuando "entre" os frames para micro-interpolação.
const SHIFT_START_FRAME = 103.5;
const SHIFT_END_FRAME = 124; // Ampliamos a janela de 12 para 19 frames letais.
const SHIFT_Y_AMOUNT = 80;

const CANVAS_W = 1080;
const CANVAS_H = 1920;

// Easing que começa lento (mais acentuado) e acelera (EaseInQuart)
function easeInQuart(t) {
    return t * t * t * t;
}

// Ease Out Cubic - Desacelera massivamente no final do trajeto 
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// O Cimento da Sincronia: Evoluímos do Cubic para o QUINTIC (Potência 5)!
// Essa curva EaseInOutQuint mantém a aceleração no "ventre" do movimento para 
// viajar junto com o redemoinho, mas espalma e esmaga absurdamente a frenagem 
// tornando o pouso final 500% mais lento que na versão anterior.
function standardEaseEase(t) {
    return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

// Matemática artesanal para "Foco Retardado" solicitada no benchmark final:
// Desvinculamos o motor de foco (blur) do motor de escala. Essa curva cria uma 'barriga'
// onde a lente do laboratório sofre para encontrar o foco inicial, ficando pesadamente 
// borrada por incríveis 70% da viagem, e mergulhando em nitidez apenas no terço final.
function delayedFocusEase(t) {
    return t < 0.7 ? 
        Math.pow(t / 0.7, 4) * 0.5 : // Aos 70% do vídeo ele ainda reteve 50% do nevoeiro!
        0.5 + (1 - Math.pow(1 - ((t - 0.7) / 0.3), 3)) * 0.5; // Nos 30% finais a lente desembaça o resto maciamente.
}

// Motor Kawase Blur (Upsampling Iterativo) puramente nativo em Javasript.
// Desvenda o mistério: a função 'ctx.filter' do seu Canvas de fato ignora comandos de blur devido aos 
// binários Cairo do Windows! Isso que deixava as v13 e v14 nítidas no centro.
// O algoritmo abaixo reduz a imagem à quase pó e usa iterativamente 4 passadas de micro offset
// enquanto cresce novamente. Isso gera um Gaussian sólido insano, zero pixels visíveis e sem ajuda de engine de placa!
function drawImageWithBlur(ctx, img, currentScale, currentMaskRadius, blurAmount, currentCenterY) {
    const CANVAS_W = 1080;
    const CANVAS_H = 1920;

    // Se estivermos no limite nítido final, não faz downsample.
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
    
    // O blur real é o nível de esmagamento base (shrinkFactor).
    // Dividir por 45! Como o blur saltou pra 1700, dividir por 35 gerou uma redução para o nível
    // de ~48x, o que passou da zona de risco que causou os 'macro blocos' originais.
    // Usando 45 de divisor, travamos o encolhimento num fator fisicamente saudável, eliminando 
    // completamente o craquelamento de forma industrial e suportando valores infinitos sem espumar.
    const shrinkFactor = Math.max(1, blurAmount / 45);
    
    let currentW = Math.max(2, Math.floor(CANVAS_W / shrinkFactor));
    let currentH = Math.max(2, Math.floor(CANVAS_H / shrinkFactor));
    
    let currentCanvas = createCanvas(currentW, currentH);
    let tCtx = currentCanvas.getContext('2d');
    tCtx.imageSmoothingEnabled = true;
    
    // Desenha o frame completo na escala reduzida para aplicar o blur no conjunto
    tCtx.save();
    tCtx.beginPath();
    tCtx.arc(currentW / 2, (currentCenterY / shrinkFactor), currentMaskRadius / shrinkFactor, 0, Math.PI * 2);
    tCtx.clip();
    
    const dw = img.width * currentScale / shrinkFactor;
    const dh = img.height * currentScale / shrinkFactor;
    tCtx.drawImage(img, (currentW/2) - (dw/2), (currentCenterY / shrinkFactor) - (dh/2), dw, dh);
    tCtx.restore();
    
    // Mip-Map Upstage:
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

async function renderFrame(frameNumber, guestImg, micImg, outputDir) {
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    // === FUNDO NATIVO OBRIGATÓRIO (CORREÇÃO DE DESYNC DE PISTA DO FFMPEG) ===
    // Ao invés de mandar o FFmpeg colocar o vídeo atrás do nosso canvas com `overlay`,
    // que causa dessincronizações fatais devido ao PTS e Variable Frame Rates (VFR) do mp4,
    // nós "queimamos" o frame exato do vídeo do qual o tracker extraiu a coordenada como 
    // a base do nosso Canvas. O Texto e a Cama agora são uma única malha inseparável!
    const bgFramePath = path.join(__dirname, 'cama_frames', `frame_${String(frameNumber).padStart(3, '0')}.png`);
    if (fs.existsSync(bgFramePath)) {
        const bgImg = await loadImage(bgFramePath);
        ctx.drawImage(bgImg, 0, 0);
    } else {
        console.warn(`Frame base faltando: ${bgFramePath}`);
    }

    // ====== FASE 1: DESENHO DA FOTO COM MÁSCARA E BLUR ======
    // O progresso da Fase 1 (Sobe apenas até chegar nos 45 frames)
    let t = frameNumber / PHOTO_TOTAL_FRAMES;
    if (t > 1) t = 1;

    let easedZoomT = standardEaseEase(t);
    let easedBlurT = delayedFocusEase(t);


    // ======== MOTOR GEOFÍSICO DO EIXO-Y (INVERSÃO DA CAMA) ========
    // Roda base:
    let currentCenterY = CANVAS_H / 2; // 960 base
    let yShiftOffset = 0;

    if (frameNumber > SHIFT_START_FRAME) {
        let shiftProg = Math.min(1, (frameNumber - SHIFT_START_FRAME) / (SHIFT_END_FRAME - SHIFT_START_FRAME));
        // A curvatura da gravidade da Cama parece Linear / Quadric no final
        let shiftEase = standardEaseEase(shiftProg); 
        yShiftOffset = SHIFT_Y_AMOUNT * shiftEase; 
        currentCenterY += yShiftOffset;
    }

    const startRadius = 2400; 
    const finalRadius = 270;
    const currentMaskRadius = startRadius - ((startRadius - finalRadius) * easedZoomT);
    
    // Calcula as escalas Inicial e Final para interpolarmos
    const startScale = (startRadius / finalRadius) * 1.02;
    // O diâmetro do Círculo final = finalRadius * 2 (540px). 
    // Precisamos que a imagem meça exatos 540 (ou 542 p/ dar 1px de segurança de borda) ao longo da largura.
    const finalScale = ((finalRadius * 2) + 2) / guestImg.width;
    
    const currentScale = startScale - ((startScale - finalScale) * easedZoomT);
    
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

    // ====== MÁQUINA DE ESTADOS GLOBAL (MOTOR PROGRESSIVO BASEADO NA CAMA) ======
    // Nós varremos o comportamento natural da Cama Amarela extraída do vídeo físico e usamos ela
    // para reger TODOS os textos (Número, Nome, Aspas) em total sincronia harmónica.
    const trackingData = require('./box_tracking_true.json');
    let hasData = trackingData[frameNumber.toString()];
    let prevData = trackingData[(frameNumber - 1).toString()] || hasData;

    // Load mock subtitles/waves
    const mediaData = require('./test_subtitle_data.json');

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
            let numExtraY = base_maxY - 27.5; 
            ctx.save();
            ctx.font = '600 36px "New-Highway"';
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            if (blurSteps > 0) {
                ctx.globalAlpha = 0.8 / blurSteps;
                for (let i = 0; i < blurSteps; i++) {
                    let f = (i / blurSteps) - 0.5;
                    ctx.fillStyle = '#006BFF';
                    ctx.fillText("896", numExtraX + blur_vx*f, numExtraY + blur_vy*f + 3);
                }
                ctx.globalAlpha = 0.5;
            }
            ctx.fillStyle = '#006BFF';
            ctx.fillText("896", numExtraX, numExtraY + 3);
            ctx.restore();
        }

        // COMPONENTE 2: GUEST NAME (Diagonal Ascendente Ligada)
        ctx.font = TEMPLATE.guestName.font;
        drawComponent([
            {txt: "João", dy: 0},
            {txt: "Kepler", dy: TEMPLATE.guestName.lh}
        ], 0, TEMPLATE.guestName, false, true);

        // COMPONENTE 3: TITLE (Assunto sem ponto na primeira linha)
        ctx.font = TEMPLATE.title.font;
        drawComponent([
            {txt: "Os negócios mudaram", dy: 0},
            {txt: "os princípios não.", dy: TEMPLATE.title.lh}
        ], 0, TEMPLATE.title, true, false);
        // COMPONENTE 4: ONDAS SONORAS E LEGENDAS!
        // FIXED POSITION AT BOTTOM, NO PARALLAX, WITH FADE IN
        let t_seconds = frameNumber / 30.0;
        
        ctx.save();
        
        // Fade in começa lá no frame 50 e vai até 100
        let fadeAlpha = Math.max(0, Math.min(1.0, (frameNumber - 50) / 40.0));
        ctx.globalAlpha = fadeAlpha;
        
        // 4.1 Audio Waves -> Posição Fixa no Rodapé e Centralizadas
        let waveY = 1522; // Subiu 8px p/ nivelar com o Podcast Logo
        
        let targetBars = 13;
        let barWidth = 5; // Barra mais fina
        let barSpacing = 12; // Gap
        let totalWaveWidth = targetBars * barSpacing;
        
        // Centralizando brutalmente no meio do eixo X (540)
        let waveX = 540 - (totalWaveWidth / 2) + (barWidth / 2);
        
        // Pega as amlitudes ou default
        let amps = mediaData.amplitudes[frameNumber] || mediaData.amplitudes[mediaData.amplitudes.length - 1] || new Array(targetBars).fill(0.1);
        
        for (let b = 0; b < amps.length; b++) {
            if (b >= targetBars) break;
            let bh = amps[b] * 75; // Mais altas
            ctx.fillStyle = '#FFFFFF';
            drawRoundedRect(ctx, waveX + b*barSpacing, waveY - bh/2, barWidth, bh, 3);
            ctx.fill();
        }

        // 4.2 Legendas Flutuantes Dinâmicas (Grudada no Círculo da Foto)
        // Descemos os 10px aprovados (target final = 1290). 
        // Como ela anda atrelada ao circulo da foto, seu Y nativo sofre o mesmo yShiftOffset
        let finalSubY = 1290;
        let subY = (finalSubY - SHIFT_Y_AMOUNT) + yShiftOffset; 

        let subX = 540; // centralizado
        let maxWidth = 750; // máx width para 2 linhas
        let fSize = 40; 
        
        ctx.font = `600 ${fSize}px "New-Highway"`;
        ctx.textBaseline = "top";
        ctx.textAlign = "center";
        
        let activeSubtitle = null;
        for (let i = 0; i < mediaData.subtitles.length; i++) {
            let s = mediaData.subtitles[i];
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
            ctx.fillStyle = '#006BFF';
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

        ctx.drawImage(micImg, cx_mic, cy_mic);
    }

    const outFileName = path.join(outputDir, `frame_${String(frameNumber).padStart(3, '0')}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outFileName, buffer);
    console.log(`[Timeline] Frame ${frameNumber} | Mask: ${Math.floor(currentMaskRadius)}px | Blur: ${Math.floor(currentBlur)}px | Mic(X,Y): ${Math.floor(cx_mic)}, ${Math.floor(cy_mic)}`);
}

async function runTest() {
    const outputDir = path.join(__dirname, 'tmp_frames');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    } else {
        fs.readdirSync(outputDir).forEach(f => fs.rmSync(path.join(outputDir, f)));
    }

    console.log('🖼️ Carregando assets...');
    const guestImg = await loadImage(path.join(__dirname, 'assets', 'foto.jpg'));
    const micImg = await loadImage('C:\\Users\\claud\\Desktop\\Kreativ\\RB_0037_Podcast Files\\layout\\layout PNGs\\microfone menor.png');

    const TEST_FRAMES = 230; // Aumentado para cobrir a letargia de velocidade (7.7s)
    console.log(`🎬 Renderizando ${TEST_FRAMES} frames da foto...`);
    for (let f = 1; f <= TEST_FRAMES; f++) {
        await renderFrame(f, guestImg, micImg, outputDir);
    }

    console.log('🎥 Gerando o Vídeo Sandbox MP4 usando FFmpeg e fundo Cama...');
    const ffPath = ffmpeg.path;
    const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');
    const destDir = 'C:\\Users\\claud\\Desktop\\Kreativ\\Artes_Geradas_Teste';
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const outFile = path.join(destDir, 'output_teste_v69.mp4');

    if (fs.existsSync(outFile)) {
        fs.rmSync(outFile);
    }

    // FFmpeg compila os frames que já estão fundidos organicamente com o background nativo!
    const cmd = `"${ffPath}" -y \
        -framerate ${FPS} -i "${outputDir}/frame_%03d.png" \
        -c:v libx264 -pix_fmt yuv420p "${outFile}"`;

    try {
        console.log("🛠️ Invocando Comando:\n" + cmd);
        execSync(cmd, { stdio: 'inherit' });
        console.log(`\n✅ Sucesso! Abra ${outFile} no Finder para aprovar o movimento.`);
    } catch (e) {
        console.error('❌ Erro renderizando ffmpeg!', e.message);
    }
}

runTest();
