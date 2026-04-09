const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');

const FPS = 30;
const DURATION_INTRO_SEC = 1.5;
const TOTAL_FRAMES = FPS * DURATION_INTRO_SEC;

const CANVAS_W = 1080;
const CANVAS_H = 1920;

// Exemplo de easing simples (easeOutCubic)
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

// Emula um blur tosco no canvas. Para mais intensidade, desenhamos com baixa opacidade multiplas vezes offsetadas.
function drawImageWithBlur(ctx, image, x, y, w, h, blurAmount) {
    if (blurAmount <= 0.1) {
        ctx.drawImage(image, x, y, w, h);
        return;
    }
    // Implementacao manual de motion blur esférico leve (radial-like):
    // Desenharemos a imagem repetidas vezes mudando a opacidade em passadas.
    // Usar o ctx.filter puramente Node-Canvas as vezes falha ou engasga a CPU, 
    // mas a versao nativa do Canvas 3.x de fato interpreta "blur(Xpx)"? Se o seu anterior n funcionou, faremos offsets.
    
    // Fallback nativo:
    ctx.filter = `blur(${Math.floor(blurAmount)}px)`;
    ctx.drawImage(image, x, y, w, h);
    ctx.filter = 'none';

    // Para forçar o peso, se o blur amount for gigante, metemos uma opacidade e dobramos o traçado:
    if (blurAmount > 10) {
        ctx.globalAlpha = 0.5;
        ctx.filter = `blur(${Math.floor(blurAmount/2)}px)`;
        ctx.drawImage(image, x - blurAmount/4, y - blurAmount/4, w + blurAmount/2, h + blurAmount/2);
        ctx.globalAlpha = 1.0;
        ctx.filter = 'none';
    }
}

async function renderFrame(frameNumber, photoImg, outputDir) {
    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx = canvas.getContext('2d');

    // Progresso de 0 a 1
    let t = frameNumber / TOTAL_FRAMES;
    if (t > 1) t = 1;

    let easedT = easeOutCubic(t);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ====== 1. FOTO DO CONVIDADO (O "Ataque da Roda") ======
    // O raio original final desejado é 380px.
    const finalRadius = 380; 
    
    // O raio inicial DEVE ocupar toda a tela. (1920 / 2) = 960!
    // Para nao ver cantos pretos, o raio inicial pode bater uns ~1200.
    const startRadius = 1300; 
    
    // O Radius (Tamanho do buraco da máscara visível) cai de 1300 pra 380
    const currentMaskRadius = startRadius - ((startRadius - finalRadius) * easedT);

    // O Scale da imagem DESABA junto do início para dar ideia de superzoom!
    const startScale = 4.0; 
    const finalScale = 1.0;
    const currentScale = startScale - ((startScale - finalScale) * easedT);

    // E o Blur despenca dramaticamente. Max Blur: 100px.
    const maxBlur = 120;
    const currentBlur = Math.max(0, maxBlur - (maxBlur * easedT));

    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    const tempCanvas = createCanvas(CANVAS_W, CANVAS_H);
    const tCtx = tempCanvas.getContext('2d');

    // Máscara limitadora
    tCtx.beginPath();
    tCtx.arc(cx, cy, currentMaskRadius, 0, Math.PI * 2); 
    tCtx.clip();
    
    // O buraco base q abrigará a foto dentro do template
    const baseW = finalRadius * 2; // 760
    const baseH = finalRadius * 2; // 760
    const photoAspect = photoImg.width / photoImg.height;
    
    let drawW, drawH;
    // O tamanho nativo de encaixe na bolinha 380 (cobre a parte menor)
    if (photoAspect > 1) { // Larga
        drawH = baseH * currentScale;
        drawW = drawH * photoAspect;
    } else { // Alta
        drawW = baseW * currentScale;
        drawH = drawW / photoAspect;
    }

    const drawX = cx - (drawW / 2);
    const drawY = cy - (drawH / 2);

    if (currentBlur > 0.1) {
        drawImageWithBlur(tCtx, photoImg, drawX, drawY, drawW, drawH, currentBlur);
    } else {
        tCtx.drawImage(photoImg, drawX, drawY, drawW, drawH);
    }

    ctx.drawImage(tempCanvas, 0, 0);

    const outFileName = path.join(outputDir, `frame_${String(frameNumber).padStart(3, '0')}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outFileName, buffer);
    console.log(`Frame ${frameNumber}/${TOTAL_FRAMES} > MaskRadius: ${Math.floor(currentMaskRadius)}px | ImgScale: ${currentScale.toFixed(2)}x | Blur: ${Math.floor(currentBlur)}px`);
}

async function runTest() {
    const outputDir = path.join(__dirname, 'tmp_frames');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    } else {
        fs.readdirSync(outputDir).forEach(f => fs.rmSync(path.join(outputDir, f)));
    }

    console.log('🖼️ Carregando assets...');
    const photoImg = await loadImage(path.join(__dirname, 'assets', 'foto.jpg'));

    console.log(`🎬 Renderizando ${TOTAL_FRAMES} frames da foto...`);
    for (let f = 1; f <= TOTAL_FRAMES; f++) {
        await renderFrame(f, photoImg, outputDir);
    }

    console.log('🎥 Gerando o Vídeo Sandbox MP4 usando FFmpeg e fundo Cama...');
    const ffPath = ffmpeg.path;
    const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');
    const outFile = path.join(__dirname, 'output_teste.mp4');

    if (fs.existsSync(outFile)) {
        fs.rmSync(outFile);
    }

    // O FFmpeg pega a entrada de Vídeo Cama (-i cama),
    // Pega a numeração de imagens (-i frame_%03d) em 30fps iterados,
    // Como os pngs param no frame 45 (1.5s), a gente congela esse ultimo frame sobre a cama até ela acabar!
    // Usaremos -filter_complex: 
    // [1:v] format=rgba, fade=in:st=0:d=0.2:alpha=1 [ov]; ... overlay.
    // E claro, o hold/congelamento estendido da imagem overlay ao tempo q as outras acabam (loop).
    // O comando abaixo apenas renderiza OS PRIMEIROS 2 a 3 SEGUNDOS para avaliarmos fisicamente se a matemática ficou bonita de ponta a ponta.

    const cmd = `"${ffPath}" -y \
        -i "${camaPath}" \
        -framerate ${FPS} -i "${outputDir}/frame_%03d.png" \
        -filter_complex "[0:v][1:v]overlay=x=0:y=0:eof_action=pass[out]" \
        -map "[out]" -t 3 -c:v libx264 -pix_fmt yuv420p "${outFile}"`;

    try {
        console.log("🛠️ Invocando Comando:\n" + cmd);
        execSync(cmd, { stdio: 'inherit' });
        console.log(`\n✅ Sucesso! Abra ${outFile} no Finder para aprovar o movimento.`);
    } catch (e) {
        console.error('❌ Erro renderizando ffmpeg!', e.message);
    }
}

runTest();
