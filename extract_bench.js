const { execSync } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const cmd = `"${ffmpegPath}" -y -i "C:/Users/claud/Desktop/Kreativ/RB_0037_Podcast Files/view/Reels Animado_podcast_896_02_legendado.mp4" -ss 00:00:15 -vframes 1 benchmark_frame_15s.png`;
console.log("Running:", cmd);
try {
    execSync(cmd, { stdio: 'inherit' });
    console.log("Success");
} catch (e) {}
