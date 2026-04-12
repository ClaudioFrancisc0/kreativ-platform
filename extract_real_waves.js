const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const { execSync } = require('child_process');
const fs = require('fs');

const audioPath = 'C:\\Users\\claud\\Desktop\\Kreativ\\RB_0037_Podcast Files\\link\\Chamada_Podcast_896.mp3';
const rawPath = 'tmp_audio.raw';

if (fs.existsSync(rawPath)) {
    fs.rmSync(rawPath);
}

const ffPath = ffmpeg.path;

// Export audio to PCM Float 32-bit Little Endian, mono, 44100 Hz
const cmd = `"${ffPath}" -y -i "${audioPath}" -f f32le -ac 1 -ar 44100 "${rawPath}"`;
console.log("🛠️ Decodificando MP3 => RAW...");
execSync(cmd, { stdio: 'inherit' });
console.log("✅ RAW gerado com sucesso.");

// Now read the raw PCM file and map it to 30fps frames!
const rawBuffer = fs.readFileSync(rawPath);
// Each Float is 4 bytes. 44100 floats per second. 
// At 30 fps, a frame spans 44100 / 30 = 1470 floats.
// 1470 floats * 4 bytes = 5880 bytes per frame.

const bytesPerFrame = 5880;
const totalFrames = Math.floor(rawBuffer.length / bytesPerFrame);
const amplitudes = [];

// Base frequencies for our 13 visual bars to create fake spectrum but driven by real volume!
// These factors will ensure that bar[i] reacts more to certain peaks while hitting the 0 perfectly when audio is silent
const barFactors = [0.8, 1.2, 0.9, 1.5, 0.7, 1.8, 0.6, 1.3, 1.0, 1.6, 0.85, 1.4, 0.95];

let phase = 0;

for (let f = 0; f < totalFrames; f++) {
    // Read the chunk
    let offset = f * bytesPerFrame;
    let sumSquares = 0;
    
    // We only need an approximation, so reading every 4th float is fast
    let count = 0;
    for (let i = 0; i < bytesPerFrame; i += 16) { 
        if (offset + i + 4 <= rawBuffer.length) {
             let val = rawBuffer.readFloatLE(offset + i);
             sumSquares += val * val;
             count++;
        }
    }
    
    let rms = Math.sqrt(sumSquares / count);
    
    // Convert RMS to a highly scaled "peak" value [0..1]
    // Standard voice RMS is extremely low (0.05 ~ 0.20), so we boost it
    let peak = Math.min(1.0, rms * 8.0);
    
    // Create the 13 bars
    let bars = [];
    if (peak < 0.05) {
        // Absolute silence -> Flat baseline
        for(let b=0; b<13; b++) bars.push(0.05); // Fixed minimum height
    } else {
        // Someone is speaking -> Modulate the bars by the actual speech envelope!
        for(let b=0; b<13; b++) {
            // Incorporate a sine wave matching the bar factor to decouple the visuals uniquely
            let modulation = Math.sin(phase * barFactors[b]) * 0.3 + 0.7; // [0.4 .. 1.0]
            let val = peak * modulation * barFactors[b] * 0.8;
            bars.push(Math.max(0.05, Math.min(1.0, val)));
        }
    }
    
    amplitudes.push(bars);
    phase += 0.3;
}

// Update the JSON
const jsonPath = 'test_subtitle_data.json';
const data = JSON.parse(fs.readFileSync(jsonPath));
data.amplitudes = amplitudes;
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

console.log(`✅ Frequências Reais integradas. ${totalFrames} frames registrados no JSON!`);
