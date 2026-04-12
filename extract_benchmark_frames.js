const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpegPath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
const videoPath = 'C:\\Users\\claud\\Desktop\\Kreativ\\Artes_Geradas_Teste\\Reels Animado_podcast_896_02_legendado.mp4';
const outputDir = path.join(__dirname, 'benchmark_frames_30fps');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Extract the first 7.7 seconds at exactly 30 fps
console.log('Extraindo frames do benchmark...');
execSync(`"${ffmpegPath}" -i "${videoPath}" -t 7.7 -vf "fps=30" "${path.join(outputDir, 'frame_%03d.png')}" -y`, { stdio: 'inherit' });
console.log('Concluído.');
