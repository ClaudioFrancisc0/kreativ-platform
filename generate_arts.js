const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, 'assets');

// === NEW HIGHWAY — todas as 10 variantes ===
registerFont(path.join(ASSETS, 'New-Highway-Light.otf'),          { family: 'New-Highway', weight: '300' });
registerFont(path.join(ASSETS, 'New-Highway-Light-Italic.otf'),   { family: 'New-Highway', weight: '300', style: 'italic' });
registerFont(path.join(ASSETS, 'New-Highway-Regular.otf'),        { family: 'New-Highway', weight: '400' });
registerFont(path.join(ASSETS, 'New-Highway-Regular-Italic.otf'), { family: 'New-Highway', weight: '400', style: 'italic' });
registerFont(path.join(ASSETS, 'New-Highway-Medium.otf'),         { family: 'New-Highway', weight: '500' });
registerFont(path.join(ASSETS, 'New-Highway-Medium-Italic.otf'),  { family: 'New-Highway', weight: '500', style: 'italic' });
registerFont(path.join(ASSETS, 'New-Highway-Semi-Bold.otf'),      { family: 'New-Highway', weight: '600' });
registerFont(path.join(ASSETS, 'New-Highway-Semi-Bold-Italic.otf'),{ family: 'New-Highway', weight: '600', style: 'italic' });
registerFont(path.join(ASSETS, 'New-Highway-Bold.otf'),           { family: 'New-Highway', weight: '700' });
registerFont(path.join(ASSETS, 'New-Highway-Bold-Italic.otf'),    { family: 'New-Highway', weight: '700', style: 'italic' });

// Mapeia font keys para CSS font string
function fontToCss(fontKey, size) {
    const map = {
        'new-highway-light':          `300 ${size}px "New-Highway"`,
        'new-highway-light-italic':   `300 italic ${size}px "New-Highway"`,
        'new-highway-regular':        `400 ${size}px "New-Highway"`,
        'new-highway-regular-italic': `400 italic ${size}px "New-Highway"`,
        'new-highway-medium':         `500 ${size}px "New-Highway"`,
        'new-highway-medium-italic':  `500 italic ${size}px "New-Highway"`,
        'new-highway-semibold':       `600 ${size}px "New-Highway"`,
        'new-highway-semibold-italic':`600 italic ${size}px "New-Highway"`,
        'new-highway-bold':           `700 ${size}px "New-Highway"`,
        'new-highway-bold-italic':    `700 italic ${size}px "New-Highway"`,
    };
    const key = (fontKey || 'new-highway-regular').toLowerCase();
    return map[key] || `400 ${size}px "New-Highway"`;
}

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'templates_config.json'), 'utf-8'));



// Mede largura de texto considerando letter-spacing manual
function measureWithSpacing(ctx, text, spacing) {
    if (!spacing) return ctx.measureText(text).width;
    let w = 0;
    for (const c of text) w += ctx.measureText(c).width + spacing;
    return text.length > 0 ? w - spacing : 0;
}

function drawTextInBox(ctx, text, boxConfig) {
    const { left, top, width, height, font, baselineSize, color, uppercase, addQuotes, align, letterSpacing, verticalAlign, lineHeight } = boxConfig;

    let finalString = text;
    if (uppercase) finalString = finalString.toUpperCase();
    // addQuotes: NÃO inclui " no wrapping — é desenhado separadamente após a última linha

    const spacing = letterSpacing || 0;
    const alignDir = align || 'left';
    const lh = lineHeight || 1.0;
    let currentSize = baselineSize;
    let textHeight = currentSize * lh;
    let lines = [];

    while (currentSize >= 12) {
        ctx.font = fontToCss(font, currentSize);
        const words = finalString.split(' ');
        let currentLine = '';
        lines = [];

        for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + words[i] + ' ';
            const testWidth = measureWithSpacing(ctx, testLine.trimEnd(), spacing);
            if (testWidth > width && i > 0) {
                lines.push(currentLine.trim());
                currentLine = words[i] + ' ';
            } else {
                currentLine = testLine;
            }
        }
        lines.push(currentLine.trim());

        textHeight = currentSize * lh;
        if (lines.length * textHeight <= height) break;
        currentSize -= 1;
    }

    ctx.fillStyle = color || '#FFFFFF';
    ctx.textBaseline = 'top';

    // Desenha uma linha com ou sem letter-spacing manual
    function drawLine(line, y) {
        const lineW = measureWithSpacing(ctx, line, spacing);
        let startX;
        if (alignDir === 'right')       startX = left + width - lineW;
        else if (alignDir === 'center') startX = left + (width - lineW) / 2;
        else                            startX = left;

        if (!spacing) {
            ctx.textAlign = 'left';
            ctx.fillText(line, startX, y);
        } else {
            ctx.textAlign = 'left';
            let cx = startX;
            for (const c of line) {
                ctx.fillText(c, cx, y);
                cx += ctx.measureText(c).width + spacing;
            }
        }
    }

    if (verticalAlign === 'middle' && lines.length === 1) {
        ctx.textBaseline = 'middle';
        const lineW = measureWithSpacing(ctx, lines[0], spacing);
        let startX;
        if (alignDir === 'right')       startX = left + width - lineW;
        else if (alignDir === 'center') startX = left + (width - lineW) / 2;
        else                            startX = left;
        if (!spacing) {
            ctx.textAlign = 'left';
            ctx.fillText(lines[0], startX, top + height / 2);
        } else {
            ctx.textAlign = 'left';
            let cx = startX;
            for (const c of lines[0]) {
                ctx.fillText(c, cx, top + height / 2);
                cx += ctx.measureText(c).width + spacing;
            }
        }
    } else {
        ctx.textBaseline = 'top';
        const totalTextHeight = lines.length * textHeight;
        let startY = top;
        if (verticalAlign === 'middle') startY = top + (height - totalTextHeight) / 2;
        lines.forEach((line, index) => {
            drawLine(line, startY + index * textHeight);
        });

        // Desenha " colado após o fim da última linha (fora do alinhamento)
        if (addQuotes && lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            const lastY = startY + (lines.length - 1) * textHeight;
            const lastLineW = measureWithSpacing(ctx, lastLine, spacing);
            const endX = alignDir === 'right'  ? left + width :
                         alignDir === 'center' ? left + (width + lastLineW) / 2 :
                                                 left + lastLineW;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText('\u201d', endX, lastY);
        }
    }
}

async function generateAllLayouts(podcastData, photoBufferOrPath, outputDir, onProgress) {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    // Suporta passar o buffer da imagem ao invés do caminho completo se necessário
    const photo = await loadImage(photoBufferOrPath);

    for (const templateName of Object.keys(config)) {
        if (onProgress) onProgress('Processando ' + templateName);
        console.log('Montando: ' + templateName);
        const tmpl = config[templateName];
        const canvas = createCanvas(tmpl.width, tmpl.height);
        const ctx = canvas.getContext('2d');

        let templateImg;
        try {
            templateImg = await loadImage(path.join(ASSETS, templateName + '.png'));
        } catch (e) {
            console.log('[Aviso] PNG nao encontrado: ' + templateName);
            continue;
        }

        // Fundo azul (cor real do template, amostrada via pixel #006BFF)
        ctx.fillStyle = '#006BFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Foto centrada no circulo real da mascara
        const circle = tmpl.photoCircle;
        if (circle) {
            const { cx, cy, radius } = circle;
            const scale = Math.max((radius * 2 + 4) / photo.width, (radius * 2 + 4) / photo.height);
            const pw = photo.width * scale;
            const ph = photo.height * scale;
            ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
        } else {
            const scale = Math.max(canvas.width / photo.width, canvas.height / photo.height);
            const pw = photo.width * scale;
            const ph = photo.height * scale;
            ctx.drawImage(photo, (canvas.width - pw) / 2, (canvas.height - ph) / 2, pw, ph);
        }

        // Overlay/mascara do layout
        ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

        // Textos dinamicos
        for (const [key, boxCfg] of Object.entries(tmpl.elements || {})) {
            const textToDraw = podcastData[key];
            if (textToDraw) drawTextInBox(ctx, textToDraw, boxCfg);
        }

        const outPath = path.join(outputDir, templateName + '_Generated.jpg');
        await new Promise((resolve, reject) => {
            const out = fs.createWriteStream(outPath);
            canvas.createJPEGStream({ quality: 0.95 }).pipe(out);
            out.on('finish', () => { console.log('[OK] ' + templateName); resolve(); });
            out.on('error', reject);
        });
    }
    console.log('\nArtes concluídas em: ' + outputDir);
}

// Mantém suporte para teste local standalone rodando `node generate_arts.js`
if (require.main === module) {
    const testData = {
        number: "N° 900",
        guestLabel: "Convidado:",
        guestName: "Juliano Cezar",
        title: "As novas tendências do mercado imobiliário"
    };
    generateAllLayouts(testData, path.join(__dirname, 'assets', 'foto.jpg'), path.join(__dirname, 'output'))
        .then(() => console.log('Teste concluído.'))
        .catch(console.error);
}

module.exports = { generateAllLayouts };
