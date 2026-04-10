const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const destDir = 'C:\\Users\\claud\\Desktop\\Kreativ\\Artes_Geradas_Teste';
const ffmpeg = require('@ffmpeg-installer/ffmpeg').path;

console.log("Extracting frame 1 from v12...");
execSync(`"${ffmpeg}" -y -i "${path.join(destDir, 'output_teste_v12.mp4')}" -vframes 1 "${path.join(__dirname, 'v12_frame1.png')}"`);

console.log("Extracting frame 1 from v13...");
execSync(`"${ffmpeg}" -y -i "${path.join(destDir, 'output_teste_v13.mp4')}" -vframes 1 "${path.join(__dirname, 'v13_frame1.png')}"`);

console.log("Done.");
