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

// Easing que começa lento (mais acentuado) e acelera (EaseInQuart)
function easeInQuart(t) {
    return t * t * t * t;
}

// Física de "Pouso em Pluma" inspirada na Animação de UI/AfterEffects:
// A aceleração ocorre violentamente apenas nos primeiros 20% da animação.
// Nos 80% do tempo restante, a velocidade só freia, derrapando e perdendo inércia
// para criar aquela encostada macia e demorada lá no fundo.
function landingEase(t) {
    const inflection = 0.15; // Acelera absurdamente em apenas 15% do tempo!
    if (t < inflection) {
        let norm = t / inflection;
        return Math.pow(norm, 3) * 0.5; // Gasta logo 50% do trajeto nessa arrancada
    } else {
        let norm = (t - inflection) / (1 - inflection);
        // Nos 85% do vídeo finais, ele freia os 50% restantes usando POTÊNCIA 7 (Septic). 
        // Isso quer dizer que o último milímetro leva 10x mais tempo pra completar, flutuando como mágica!
        return 0.5 + (1 - Math.pow(1 - norm, 7)) * 0.5; 
    }
}

// Motor Kawase Blur (Upsampling Iterativo) puramente nativo em Javasript.
// Desvenda o mistério: a função 'ctx.filter' do seu Canvas de fato ignora comandos de blur devido aos 
// binários Cairo do Windows! Isso que deixava as v13 e v14 nítidas no centro.
// O algoritmo abaixo reduz a imagem à quase pó e usa iterativamente 4 passadas de micro offset
// enquanto cresce novamente. Isso gera um Gaussian sólido insano, zero pixels visíveis e sem ajuda de engine de placa!
function drawImageWithBlur(ctx, image, x, y, w, h, blurAmount) {
    if (blurAmount <= 1.0) {
        ctx.globalAlpha = 1.0;
        ctx.drawImage(image, x, y, w, h);
        return;
    }
    
    // O blur real é o nível de esmagamento (shrinkFactor).
    const shrinkFactor = Math.max(1, blurAmount / 18);
    
    let currentW = Math.max(2, Math.floor(w / shrinkFactor));
    let currentH = Math.max(2, Math.floor(h / shrinkFactor));
    
    let currentCanvas = createCanvas(currentW, currentH);
    let tCtx = currentCanvas.getContext('2d');
    tCtx.imageSmoothingEnabled = true;
    tCtx.drawImage(image, 0, 0, currentW, currentH);
    
    // Mip-Map Upstage:
    while (currentW < w && currentW < 800) {
        let nextW = Math.min(w, Math.floor(currentW * 1.5));
        let nextH = Math.min(h, Math.floor(currentH * 1.5));
        
        let upCanvas = createCanvas(nextW, nextH);
        let uCtx = upCanvas.getContext('2d');
        uCtx.imageSmoothingEnabled = true;

        // O SEGREDO DA OPACIDADE TOTAL: A matemática de Alpha do Canvas não soma 0.25 + 0.25! 
        // 4 camadas de 0.25 num canvas vazio resultam em uma imagem final 68% transparente! 
        // Para garantir 100% de IMPENETRABILIDADE, usamos a média algébrica perfeita:
        uCtx.globalAlpha = 1.0;
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, 0, nextW, nextH);
        
        uCtx.globalAlpha = 0.5; // (Mistura 50/50 com o fundo opaco)
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, -1, 0, nextW + 1, nextH);
        
        uCtx.globalAlpha = 0.333; // (Mistura 1/3 novo, 2/3 fundo opaco)
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, -1, nextW, nextH + 1);
        
        uCtx.globalAlpha = 0.25; // (Mistura 1/4 novo, 3/4 fundo opaco)
        uCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, 1, 1, nextW - 1, nextH - 1);
        
        currentW = nextW;
        currentH = nextH;
        currentCanvas = upCanvas;
    }
    
    // Desenha na tela master! Sedoso e totalmente denso!
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1.0;
    ctx.drawImage(currentCanvas, 0, 0, currentW, currentH, x, y, w, h);
}

async function renderFrame(frameNumber, photoImg, outputDir) {
    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx = canvas.getContext('2d');

    // Progresso de 0 a 1
    let t = frameNumber / TOTAL_FRAMES;
    if (t > 1) t = 1;

    // Calculamos o easing físico principal do Pouso (Ataque da Roda)
    // Alterado para focar num Pouso Longo (estilo "encostar" elemento lateral)
    let easedZoomT = landingEase(t);
    let easedBlurT = landingEase(t);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // ====== 1. FOTO DO CONVIDADO (O "Ataque da Roda") ======
    // Retornamos ao radius 300.
    const finalRadius = 300; 
    
    // O raio inicial DEVE ocupar toda a tela. (1920 / 2) = 960!
    // Para nao ver cantos pretos, o raio inicial pode bater uns ~1200.
    const startRadius = 1300; 
    
    // O Radius (Tamanho do buraco da máscara visível) cai de 1300 pra 300
    const currentMaskRadius = startRadius - ((startRadius - finalRadius) * easedZoomT);

    // O Scale precisa ser proporcional ao radius
    // Aumentamos o Scale inicial (de 0.5 para 2.5) a seu pedido para gerar 
    // um Crop muito mais fechado/aproximado durante a descida!
    const startScale = (startRadius / finalRadius) + 2.5; 
    const finalScale = 1.0;
    const currentScale = startScale - ((startScale - finalScale) * easedZoomT);

    // O borrão agora atinge o limite cósmico sugerido de 1000px!
    const maxBlur = 1000;
    const currentBlur = Math.max(0, maxBlur - (maxBlur * easedBlurT));

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

    const TEST_FRAMES = 90; // Gerar 3 segundos plenos de overlay
    console.log(`🎬 Renderizando ${TEST_FRAMES} frames da foto...`);
    for (let f = 1; f <= TEST_FRAMES; f++) {
        await renderFrame(f, photoImg, outputDir);
    }

    console.log('🎥 Gerando o Vídeo Sandbox MP4 usando FFmpeg e fundo Cama...');
    const ffPath = ffmpeg.path;
    const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');
    // Destino exato requisitado pelo usuário, usando v2 para evitar cache
    const destDir = 'C:\\Users\\claud\\Desktop\\Kreativ\\Artes_Geradas_Teste';
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const outFile = path.join(destDir, 'output_teste_v23.mp4');

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
        -filter_complex "[0:v][1:v]overlay=x=0:y=0[out]" \
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
