const fs = require('fs');

const phrases = [
    { text: "Este é um teste de uma linha rápida.", start: 1.0, end: 3.5 },
    { text: "E aqui conectamos duas linhas exatas para testar a altura total.", start: 3.5, end: 7.0 },
    { text: "Finalizando com uma linha.", start: 7.0, end: 8.5 }
];

// Generate sound waves for 230 frames (13 barras apenas)
const amplitudes = [];
let phase = 0;
for (let f = 0; f <= 230; f++) {
    let bars = [];
    for (let b = 0; b < 13; b++) {
        let val = Math.random() * 0.15 + (Math.sin(phase + b * 0.4) * 0.3 + 0.3);
        bars.push(Math.max(0.1, Math.min(1.0, val)));
    }
    amplitudes.push(bars);
    phase += 0.2;
}

const data = {
    subtitles: phrases,
    amplitudes
};

fs.writeFileSync('test_subtitle_data.json', JSON.stringify(data, null, 2));
console.log("Mock data bloqueada gerada.");
