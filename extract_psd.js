const fs = require('fs');
const path = require('path');
const { readPsd } = require('ag-psd');

const dirPath = 'C:\\Users\\claud\\Desktop\\RB_0037_Podcast\\RB_0037_Podcast\\layout\\layout PSDs';

try {
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.psd'));
    
    for (const file of files) {
        console.log(`\n========================================`);
        console.log(`Lendo Arquivo: ${file}`);
        console.log(`========================================`);
        
        const psdPath = path.join(dirPath, file);
        const buffer = fs.readFileSync(psdPath);
        const psd = readPsd(buffer, { skipLayerImageData: true, skipCompositeImageData: true });
        
        console.log(`Dimensão Real: ${psd.width}x${psd.height}`);
        
        function logLayers(layers, indent = '') {
            if (!layers) return;
            
            for (const layer of layers) {
                // Ignore empty or structural hidden layers, but keep text layers
                if (layer.text) {
                    console.log(`\n${indent}-> [TEXT LAYER] "${layer.name}"`);
                    console.log(`${indent}   Box (Esquerda, Cima): (${layer.left}, ${layer.top})`);
                    console.log(`${indent}   Box (Direita, Baixo): (${layer.right}, ${layer.bottom})`);
                    console.log(`${indent}   Tamanho do Box Máximo: ${layer.right - layer.left} (Largura) x ${layer.bottom - layer.top} (Altura)`);
                    console.log(`${indent}   Texto no PSD: "${layer.text.text.substring(0, 50).replace(/\r/g, ' ')}"`);
                    
                    if (layer.text.style) {
                         const styleStr = Object.entries(layer.text.style)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' | ');
                         console.log(`${indent}   Fonte/Tamanho Base: ${layer.text.style.font?.name || 'Varia'}, Size: ${layer.text.style.fontSize}`);
                    }
                }
                
                if (layer.children && layer.children.length > 0) {
                    logLayers(layer.children, indent + '  ');
                }
            }
        }
        
        logLayers(psd.children);
    }
} catch (error) {
    console.error('Erro geral:', error);
}
