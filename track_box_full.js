const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const framesDir = path.join(__dirname, 'benchmark_frames_30fps');

async function trackFullTimeline() {
    const canvas = createCanvas(1080, 1920);
    const ctx = canvas.getContext('2d');
    const positions = {};

    for (let i = 1; i <= 230; i++) {
        const frameFile = path.join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
        if (!fs.existsSync(frameFile)) continue;

        const img = await loadImage(frameFile);
        ctx.clearRect(0, 0, 1080, 1920);
        ctx.drawImage(img, 0, 0);

        // Scan full left side to find the yellow box
        const imgData = ctx.getImageData(0, 0, 600, 1920);
        const data = imgData.data;
        const width = imgData.width;
        const height = imgData.height;
        
        let minX = 9999, maxX = -1;
        let minY = 9999, maxY = -1;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const r = data[idx], g = data[idx+1], b = data[idx+2];
                // Using a very strict yellow filter to avoid the redemoinho artifacts
                if (r > 220 && g > 200 && b < 80) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX !== -1) {
            positions[i] = {
                cx: minX + (maxX - minX) / 2,
                cy: minY + (maxY - minY) / 2,
                minX, maxX, minY, maxY
            };
        }
    }
    
    fs.writeFileSync('box_tracking_full.json', JSON.stringify(positions, null, 2));
    console.log("Full tracking saved!");
}

trackFullTimeline().catch(console.error);
