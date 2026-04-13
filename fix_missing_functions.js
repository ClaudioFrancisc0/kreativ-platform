const fs=require('fs'); 
let vs=fs.readFileSync('services/videoService.js', 'utf8'); 

let textHelper = `
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

// Insert at the top of the file before drawRoundedRect
let hook = 'function drawRoundedRect'; 
vs = vs.replace(hook, textHelper + '\n' + hook); 

// Strip the residual runTest function that leaked
let endIdx = vs.indexOf('async function runTest()'); 
if (endIdx !== -1) { 
    let tailStr = 'module.exports = {'; 
    let expIdx = vs.indexOf(tailStr); 
    if (expIdx !== -1) {
        let cleanVs = vs.substring(0, endIdx) + '\n' + vs.substring(expIdx); 
        fs.writeFileSync('services/videoService.js', cleanVs); 
        console.log("Successfully inserted missing functions and removed runTest!");
    } else {
        fs.writeFileSync('services/videoService.js', vs); 
    }
} else { 
    fs.writeFileSync('services/videoService.js', vs); 
    console.log("Inserted missing functions, runTest already absent.");
}
