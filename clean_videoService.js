const fs = require('fs');
let code = fs.readFileSync('services/videoService.js', 'utf8');

// 1. Inject missing helpers
const missingHelpers = `
function drawMultilineText(ctx, text, x, y, maxWidth, lineHeight, isAlignRight = false) {
    const words = text.split(' ');
    let line = '';
    let currentY = y;
    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            if (isAlignRight) {
                let w = ctx.measureText(line).width;
                ctx.fillText(line, x - w, currentY);
            } else {
                ctx.fillText(line, x, currentY);
            }
            line = words[n] + ' ';
            currentY += lineHeight;
        } else {
            line = testLine;
        }
    }
    if (isAlignRight) {
        let w = ctx.measureText(line).width;
        ctx.fillText(line, x - w, currentY);
    } else {
        ctx.fillText(line, x, currentY);
    }
}

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
`;

if (!code.includes('function drawMultilineText')) {
    code = code.replace('function drawRoundedRect', missingHelpers + '\nfunction drawRoundedRect');
}

// 2. Erase the leaked renderFrame and runTest blocks
// Find the exact anchor points
const anchorStart = 'cy_mic += yShiftOffset;\n\n        ctx.drawImage(micImg, cx_mic, cy_mic);\n    }';
const idxStart = code.lastIndexOf(anchorStart);

if (idxStart !== -1) {
    const endAnchor = '        // Salva o frame transparente nativo';
    const idxEnd = code.indexOf(endAnchor, idxStart);
    if (idxEnd !== -1) {
        code = code.substring(0, idxStart + anchorStart.length) + '\n\n' + code.substring(idxEnd);
    }
}

fs.writeFileSync('services/videoService.js', code);
console.log('Cleaned file!');
