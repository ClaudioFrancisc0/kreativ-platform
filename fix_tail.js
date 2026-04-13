const fs=require('fs'); 
let c=fs.readFileSync('services/videoService.js', 'utf8'); 
let tail_idx = c.indexOf('const { execFile }'); 
let head = c.substring(0, tail_idx); 
let tail = `const { execFile } = require('child_process');
        return new Promise((resolve, reject) => {
            execFile(ffPath, args, (error, stdout, stderr) => {
                if (error) {
                    return reject(new Error("Erro ao montar ffmpeg: " + error.message + " | Detalhes: " + stderr));
                }
                try {
                    if (fs.existsSync(tmpFramesDir)) fs.rmSync(tmpFramesDir, { recursive: true, force: true });
                    resolve(outFileName);
                } catch (fsErr) {
                    console.error("CleanUp tmpFrames error:", fsErr);
                    resolve(outFileName);
                }
            });
        });
}

module.exports = {
    extractWhisperData,
    extractWaveData,
    generateAnimatedVideo
};
`; 
fs.writeFileSync('services/videoService.js', head + tail);
