const { createCanvas, loadImage } = require('canvas');
const path = require('path');

(async () => {
    const img = await loadImage(path.join('assets', 'BannerOrbita_1920x1080.png'));
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Amostra varios pontos do fundo azul (longe de elementos visuais)
    const samples = [
        { x: 300, y: 500 },
        { x: 200, y: 600 },
        { x: 400, y: 200 },
        { x: 100, y: 800 },
        { x: 500, y: 700 },
    ];
    samples.forEach(({ x, y }) => {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        const hex = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
        console.log(`Pixel (${x},${y}): rgb(${r},${g},${b}) = ${hex}`);
    });
})();
