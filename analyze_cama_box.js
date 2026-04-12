const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegPath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');

const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');
const outFrame = path.join(__dirname, 'cama_frame_80.png');

console.log('Extraindo frame 80 (2.66s)...');
// 80 frames a 30fps = 2.666s
execSync(`"${ffmpegPath}" -i "${camaPath}" -ss 00:00:02.666 -vframes 1 "${outFrame}" -y`, { stdio: 'inherit' });
console.log('Extraído.');

const { createCanvas, loadImage } = require('canvas');

async function findBox() {
    const img = await loadImage(outFrame);
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, 1080, 1920).data;
    let minX = 9999, maxX = -1;
    let minY = 9999, maxY = -1;

    for (let y = 0; y < 1920; y++) {
        for (let x = 0; x < 500; x++) {
            const idx = (y * 1080 + x) * 4;
            const r = imgData[idx], g = imgData[idx+1], b = imgData[idx+2];
            // Amarelo característico (alto R, alto G, baixo B)
            if (r > 200 && g > 200 && b < 100) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    console.log(`Box amarelo encontrado em: X(${minX} a ${maxX}), Y(${minY} a ${maxY})`);
    
    // Coordenadas center:
    console.log(`Centro ideal do texto numérico: CX: ${minX + (maxX - minX)/2}, CY: ${minY + (maxY - minY)/2}`);
}

findBox().catch(console.error);
