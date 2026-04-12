const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpegPath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');
const framesDir = path.join(__dirname, 'cama_frames');

if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

console.log("Extraindo frames reais da Cama (sem mic)...");
execSync(`"${ffmpegPath}" -y -i "${camaPath}" -r 30 "${framesDir}/frame_%03d.png"`, { stdio: 'inherit' });
console.log("Concluído!");
