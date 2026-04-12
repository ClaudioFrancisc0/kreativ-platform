const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function findConvidadoY(imgPath) {
    const img = await loadImage(imgPath);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, 1080, 1920).data;
    
    // We scan the left side of the screen roughly around X=50 to X=150
    // "CONVIDADO:" is white.
    let sumY = 0, count = 0;
    
    for(let y = 0; y < 1920; y++) {
        for(let x = 60; x < 150; x++) {
            let idx = (y * 1080 + x) * 4;
            let r = data[idx];
            let g = data[idx+1];
            let b = data[idx+2];
            // Brighter than grey
            if(r > 200 && g > 200 && b > 200) {
                sumY += y;
                count++;
            }
        }
    }
    if (count === 0) return 0;
    return sumY / count;
}

async function run() {
    let y1 = await findConvidadoY('./cama_frames/frame_080.png');
    let y2 = await findConvidadoY('./cama_frames/frame_150.png');
    console.log(`Frame 80 (Em baixo): ${y1}`);
    console.log(`Frame 150 (Em cima): ${y2}`);
    console.log(`SUBIU: ${y1 - y2} pixels!`);
}
run();
