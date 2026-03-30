const { readPsd } = require('ag-psd');
const fs = require('fs');
const path = require('path');

const PSD_DIR = 'C:/Users/claud/Desktop/RB_0037_Podcast Files/layout/layout PSDs';
const OUTPUT_FILE = 'psd_extract_results.json';

const results = {};

function ptToPx(pt) { return pt * 96 / 72; }

function extractLayers(layers, collected = []) {
    if (!layers) return collected;
    for (const layer of layers) {
        if (layer.text) {
            const tb = layer.text;
            const style = (tb.styleRuns && tb.styleRuns[0] && tb.styleRuns[0].style) || {};
            const fontSize = style.fontSize ? ptToPx(style.fontSize) : null;
            const fontName = style.font ? style.font.name : null;
            collected.push({
                name: layer.name,
                text: tb.text,
                left: layer.left,
                top: layer.top,
                right: layer.right,
                bottom: layer.bottom,
                width: (layer.right || 0) - (layer.left || 0),
                height: (layer.bottom || 0) - (layer.top || 0),
                fontName,
                fontSize: fontSize ? Math.round(fontSize * 100) / 100 : null,
                color: style.fillColor ? style.fillColor : null,
                justification: tb.paragraphStyle ? tb.paragraphStyle.justification : null,
            });
        }
        if (layer.children) extractLayers(layer.children, collected);
    }
    return collected;
}

const psdFiles = fs.readdirSync(PSD_DIR).filter(f => f.endsWith('.psd'));

for (const file of psdFiles) {
    console.log('Lendo: ' + file);
    const buf = fs.readFileSync(path.join(PSD_DIR, file));
    const psd = readPsd(buf, { skipCompositeImageData: true, skipLayerImageData: true });
    const layers = extractLayers(psd.children);
    results[file.replace('.psd', '')] = {
        dimensions: { width: psd.width, height: psd.height },
        textLayers: layers
    };
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
console.log('\nSalvo em ' + OUTPUT_FILE);
