// Encontra os bounds exatos da tag amarela (#FFD600 / amarelo) no PNG do CapaPodcast
const { createCanvas, loadImage } = require('canvas');
const path = require('path');

(async () => {
    const img = await loadImage(path.join(__dirname, 'assets', 'CapaPodcast_1080x1080.png'));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let count = 0;

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
    // Apenas top-left: x < 400, y < 200 (excluir ícone do microfone)
    if (a > 200 && r > 200 && g > 170 && b < 80 && x < 400 && y < 200) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                count++;
            }
        }
    }

    if (count === 0) {
        console.log('Nenhum pixel amarelo encontrado!');
    } else {
        console.log(`Tag Amarela encontrada!`);
        console.log(`  left:   ${minX}px`);
        console.log(`  top:    ${minY}px`);
        console.log(`  right:  ${maxX}px`);
        console.log(`  bottom: ${maxY}px`);
        console.log(`  width:  ${maxX - minX}px`);
        console.log(`  height: ${maxY - minY}px`);
        console.log(`  center: cx=${Math.round((minX+maxX)/2)}, cy=${Math.round((minY+maxY)/2)}`);
        console.log(`  pixels amarelos: ${count}`);
    }
})();
