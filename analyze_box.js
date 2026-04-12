const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const framesDir = path.join(__dirname, 'benchmark_frames_30fps');
const xStart = 0;
const xEnd = 600;
const yStart = 300;
const yEnd = 800; // scan a larger square to track it even when it drops

async function analyzeFrames() {
    let boxPositions = [];
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');

    for (let i = 1; i <= 231; i++) {
        const frameFile = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
        if (!fs.existsSync(frameFile)) continue;

        const img = await loadImage(frameFile);
        ctx.clearRect(0, 0, 1080, 1920);
        ctx.drawImage(img, 0, 0);

        let foundX = -1;
        let foundY = -1;
        
        // scanning line by line
        const imgData = ctx.getImageData(xStart, yStart, xEnd - xStart, yEnd - yStart);
        const data = imgData.data;
        const width = imgData.width;
        const height = imgData.height;
        
        // Find the top-left most yellow pixel
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const idx = (y * width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                
                if (r > 200 && g > 200 && b < 100) {
                    foundX = x + xStart;
                    foundY = y + yStart;
                    break;
                }
            }
            if (foundX !== -1) break;
        }

        if (foundX !== -1) {
            boxPositions.push({ frame: i, x: foundX, y: foundY });
        }
    }

    console.log(JSON.stringify(boxPositions));
}

analyzeFrames().catch(console.error);
