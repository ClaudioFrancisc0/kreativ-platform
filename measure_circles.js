const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs');

async function measureCircle(file) {
    const img = await loadImage(file);
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    let minX = img.width, maxX = 0, minY = img.height, maxY = 0, found = false;
    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
            const alpha = data[(y * img.width + x) * 4 + 3];
            if (alpha < 128) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                found = true;
            }
        }
    }
    if (!found) return { name: path.basename(file), error: 'No transparent pixels found' };
    const cx = Math.round((minX + maxX) / 2);
    const cy = Math.round((minY + maxY) / 2);
    const radius = Math.round(Math.max(maxX - minX, maxY - minY) / 2);
    return { name: path.basename(file), cx, cy, radius, minX, minY, maxX, maxY, imgW: img.width, imgH: img.height };
}

const d = 'C:/Users/claud/.gemini/antigravity/scratch/kreativ-platform/assets/';
const names = ['BannerOrbita_1920x1080','BannerSite_1440x780','CapaPodcast_1080x1080','CapaReels_1920x1080','Story_1920x1080'];

Promise.all(names.map(n => measureCircle(d + n + '.png')))
    .then(results => {
        const out = JSON.stringify(results, null, 2);
        fs.writeFileSync('circle_measurements.json', out);
        console.log('Salvo em circle_measurements.json');
        console.log(out);
    })
    .catch(e => console.error(e));
