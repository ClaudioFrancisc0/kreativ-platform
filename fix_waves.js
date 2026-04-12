const fs = require('fs');

const data = JSON.parse(fs.readFileSync('test_subtitle_data.json'));

const amplitudes = [];
let phase = 0;
// We assign a set of fixed frequencies for the 13 bars so they bounce independently
const freqs = [1.1, 0.8, 1.4, 0.9, 1.3, 0.7, 1.5, 0.85, 1.2, 0.75, 1.35, 0.95, 1.05];

for (let f = 0; f <= 1000; f++) { 
    let t_sec = f / 30.0;
    
    let isActive = data.subtitles.some(p => t_sec >= p.start && t_sec <= p.end);
    
    let bars = [];
    for (let b = 0; b < 13; b++) {
        if (isActive) {
            let val = Math.random() * 0.15 + (Math.sin(phase * freqs[b]) * 0.4 + 0.4);
            bars.push(Math.max(0.1, Math.min(1.0, val)));
        } else {
            let val = Math.random() * 0.05 + 0.1;
            bars.push(Math.max(0.05, Math.min(0.2, val)));
        }
    }
    amplitudes.push(bars);
    phase += 0.2;
}

data.amplitudes = amplitudes;
fs.writeFileSync('test_subtitle_data.json', JSON.stringify(data, null, 2));
console.log("Waves updated.");
