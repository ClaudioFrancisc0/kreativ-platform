// Encontra o centro e raio da área transparente (círculo da foto) no PNG template
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

(async () => {
    const templateName = process.argv[2] || 'CapaPodcast_1080x1080';
    const img = await loadImage(path.join(__dirname, 'assets', `${templateName}.png`));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let transparentCount = 0;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const a = data[i + 3];
            // Alpha < 30 = área transparente (onde a foto deve aparecer)
            if (a < 30) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                transparentCount++;
            }
        }
    }

    if (transparentCount === 0) {
        console.log('Nenhuma área transparente encontrada!');
    } else {
        const w = maxX - minX;
        const h = maxY - minY;
        const cx = Math.round(minX + w / 2);
        const cy = Math.round(minY + h / 2);
        const radius = Math.round(Math.min(w, h) / 2);

        console.log(`\nÁrea transparente (círculo da foto) em: ${templateName}`);
        console.log(`  Bounding box: left=${minX}, top=${minY}, right=${maxX}, bottom=${maxY}`);
        console.log(`  Width=${w}, Height=${h}`);
        console.log(`  → cx=${cx}, cy=${cy}, radius=${radius}`);
        console.log(`  Pixels transparentes: ${transparentCount}`);
    }
})();
