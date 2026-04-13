const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const ffmpegPath = ffmpegInstaller.path;
const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');
const framesDir = path.join(__dirname, 'cama_frames');

if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
}

console.log("Extraindo frames reais da Cama (sem mic)... Este processo é necessário apenas na compilação do servidor.");
try {
    execFileSync(ffmpegPath, ['-y', '-i', camaPath, '-r', '30', path.join(framesDir, 'frame_%03d.png')], { stdio: 'inherit' });
    console.log("Concluído! Frames da cama criados no servidor e prontos para renderização.");
} catch (e) {
    console.error("Aviso crítico: não foi possível extrair a cama frame a frame. O FFmpeg falhou.", e);
}
