const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ffmpegPath = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
const camaPath = path.join(__dirname, 'assets', 'cama_sem_mic.mp4');

// extrair frames de queda: 110, 115, 120, 130
// Frame = 110 -> 110/30 = 3.666s
// Frame = 115 -> 115/30 = 3.833s
// Frame = 120 -> 120/30 = 4.0s
// Frame = 130 -> 130/30 = 4.33s

execSync(`"${ffmpegPath}" -i "${camaPath}" -ss 00:00:03.666 -vframes 1 frame_110.png -y`, { stdio: 'inherit' });
execSync(`"${ffmpegPath}" -i "${camaPath}" -ss 00:00:03.833 -vframes 1 frame_115.png -y`, { stdio: 'inherit' });
execSync(`"${ffmpegPath}" -i "${camaPath}" -ss 00:00:04.000 -vframes 1 frame_120.png -y`, { stdio: 'inherit' });
execSync(`"${ffmpegPath}" -i "${camaPath}" -ss 00:00:04.333 -vframes 1 frame_130.png -y`, { stdio: 'inherit' });

console.log("Frames extraidos. Analisando...")
