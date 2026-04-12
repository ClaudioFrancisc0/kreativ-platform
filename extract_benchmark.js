const { execSync } = require('child_process');
const path = require('path');
const ffmpeg = path.join(__dirname, 'node_modules', '@ffmpeg-installer', 'win32-x64', 'ffmpeg.exe');
execSync(`"${ffmpeg}" -y -i assets/"Reels Animado_podcast_896_02_legendado.mp4" -vf "select='between(n,20,120)'" -vsync 0 assets/benchmark_frames_text/frame_%03d.png`, {stdio: 'inherit'});
