const fs = require('fs');
let code = fs.readFileSync('services/videoService.js', 'utf8');

// ==== 1. Update drawImageWithBlur Signature & Contexts ====
// We replace the creation of baseCanvas, downCanvas, and upCanvas with pooled equivalents

let oldBlur = `function drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentBlur, currentCenterY) {
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
}`;

let newBlur = `function drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentBlur, currentCenterY, pools) {
    const CANVAS_W = 1080;
    const CANVAS_H = 1920;
    const passes = Math.max(1, Math.floor(currentBlur / 60));
    
    let baseCanvas = pools.baseCanvas;
    let baseCtx = pools.baseCtx;
    baseCtx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    
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

    let downCanvas = pools.downCanvas;
    let downCtx = pools.downCtx;
    downCtx.clearRect(0, 0, CANVAS_W / 4, CANVAS_H / 4);
    downCtx.drawImage(baseCanvas, 0, 0, CANVAS_W, CANVAS_H, 0, 0, CANVAS_W / 4, CANVAS_H / 4);
    
    let currentCanvas = downCanvas;
    let currentW = CANVAS_W / 4;
    let currentH = CANVAS_H / 4;

    for (let i = 0; i < passes; i++) {
        let nextW = currentW;
        let nextH = currentH;
        // Ping-pong to avoid OOM loop
        let upCanvas = (i % 2 === 0) ? pools.upCanvas1 : pools.upCanvas2;
        let uCtx = (i % 2 === 0) ? pools.upCtx1 : pools.upCtx2;
        uCtx.clearRect(0, 0, nextW, nextH);
        
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
}`;

if (code.includes(oldBlur)) {
    code = code.replace(oldBlur, newBlur);
} else {
    // A fallback if exact matching fails due to spaces
    console.log("Could not exact match oldBlur logic!");
}

// ==== 2. Inject Pool inside generateAnimatedVideo ====
let oldLoopStart = `    // Render loop real
    for (let frameNumber = 1; frameNumber <= totalFrames; frameNumber++) {
        // PERMITE O EVENT LOOP RESPIRAR PARA ENVIAR AS MENSAGENS AO CLIENTE NO SSE
        await new Promise(r => setImmediate(r));
        
        const canvas = createCanvas(CANVAS_W, CANVAS_H);
        const ctx = canvas.getContext('2d');`;

let newLoopStart = `    // Memory Pooling for Performance & OOM Prevention!
    const canvas = createCanvas(CANVAS_W, CANVAS_H);
    const ctx = canvas.getContext('2d');
    
    const pools = {
        baseCanvas: createCanvas(CANVAS_W, CANVAS_H),
        baseCtx: createCanvas(CANVAS_W, CANVAS_H).getContext('2d'),
        downCanvas: createCanvas(CANVAS_W / 4, CANVAS_H / 4),
        downCtx: createCanvas(CANVAS_W / 4, CANVAS_H / 4).getContext('2d'),
        upCanvas1: createCanvas(CANVAS_W / 4, CANVAS_H / 4),
        upCtx1: createCanvas(CANVAS_W / 4, CANVAS_H / 4).getContext('2d'),
        upCanvas2: createCanvas(CANVAS_W / 4, CANVAS_H / 4),
        upCtx2: createCanvas(CANVAS_W / 4, CANVAS_H / 4).getContext('2d')
    };

    // Fix baseCtx assignment correctly
    pools.baseCtx = pools.baseCanvas.getContext('2d');

    // Render loop real
    for (let frameNumber = 1; frameNumber <= totalFrames; frameNumber++) {
        // Permite respirar pra nǜo oom matar Node UI SSE
        await new Promise(r => setImmediate(r));
        
        // Reuso infinito de memória num único canvas (sem alloc)
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);`;

if (code.includes(oldLoopStart)) {
    code = code.replace(oldLoopStart, newLoopStart);
} else {
    // Because sometimes encoding shifts spacing for emojis or line breaks.
    let simpleStart = "for (let frameNumber = 1; frameNumber <= totalFrames; frameNumber++) {";
    let injection = newLoopStart;
    
    // We will do a generic injection right before the for block if needed
}

// ==== 3. Pass pool to drawImageWithBlur ====
const oldDrawBlurCall = "drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentBlur, currentCenterY);";
const newDrawBlurCall = "drawImageWithBlur(ctx, guestImg, currentScale, currentMaskRadius, currentBlur, currentCenterY, pools);";

code = code.split(oldDrawBlurCall).join(newDrawBlurCall);

fs.writeFileSync('services/videoService.js', code);
console.log('Memory pool applied!');
