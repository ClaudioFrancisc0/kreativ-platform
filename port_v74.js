const fs = require('fs');

const testAnim = fs.readFileSync('test_anim.js', 'utf8');
const lines = testAnim.split('\n');

const startLine = 240; 
const endLine = 548;  

// Read test_anim.js Phase 2
let v74Code = lines.slice(startLine - 1, endLine).join('\n');

v74Code = v74Code.replace("const mediaData = require('./test_subtitle_data.json');", "");
v74Code = v74Code.replace(/mediaData\.amplitudes/g, "amplitudes");
v74Code = v74Code.replace(/mediaData\.subtitles/g, "subtitles");

v74Code = v74Code.replace(/"896"/g, "rawNum");

let nameLogic = `
        let nameSplit = (podcastData.guestName || "CONVIDADO").split(" ");
        let firstName = nameSplit[0] || "";
        let lastName = nameSplit.slice(1).join(" ") || "";
        drawComponent([
            {txt: firstName, dy: 0},
            {txt: lastName, dy: Math.floor(TEMPLATE.guestName.lh)}
        ], 0, TEMPLATE.guestName, false, true);
`;
v74Code = v74Code.replace(/drawComponent\(.*João.*?TEMPLATE\.guestName\.lh.*?false,\s*true\);/gms, nameLogic);

let titleLogic = `
        let subj = (podcastData.subject || "ASSUNTO AQUI").replace(/\\.$/, "");
        let sWords = subj.split(" ");
        let mid = Math.ceil(sWords.length / 2);
        let titleLine1 = sWords.slice(0, mid).join(" ");
        let titleLine2 = sWords.slice(mid).join(" ");
        if(titleLine2.length > 0) titleLine2 += ".";
        drawComponent([
            {txt: titleLine1, dy: 0},
            {txt: titleLine2, dy: Math.floor(TEMPLATE.title.lh)}
        ], 0, TEMPLATE.title, true, false);
`;
v74Code = v74Code.replace(/drawComponent\(.*Os.*neg.*TEMPLATE\.title\.lh.*?true,\s*false\);/gms, titleLogic);

const vs = fs.readFileSync('services/videoService.js', 'utf8');
const vsLines = vs.split('\n');

let vsStart = -1;
let vsEnd = -1;

for(let i=0; i<vsLines.length; i++) {
    if (vsLines[i].includes('// Recupera Data')) {
        vsStart = i;
    }
    if (vsLines[i].includes('const framesPattern = path.join(tmpFramesDir, \'frame_%03d.png\');')) {
        vsEnd = i;
    }
}

if (vsStart !== -1 && vsEnd !== -1) {
    let extraVars = `
        // V74 CORE RESTORED
        const rawNum = String(podcastData.number || '0000').replace(/\\D/g, '');
        const trackingDataPathReal = path.join(CWD, 'box_tracking_true.json');
        const trackingDataRoot = JSON.parse(fs.readFileSync(trackingDataPathReal));
        let hasData = trackingDataRoot[frameNumber.toString()];
        let prevData = trackingDataRoot[(frameNumber - 1).toString()] || hasData;
        if (!hasData) {
            let maxTKey = Math.max(...Object.keys(trackingDataRoot).map(k => parseInt(k)));
            hasData = trackingDataRoot[maxTKey.toString()];
        }
`;

    v74Code = v74Code.replace(/const trackingData = require\('\.\/box_tracking_true\.json'\);/, "");
    v74Code = v74Code.replace(/let hasData.*?;/, "");
    v74Code = v74Code.replace(/let prevData.*?;/, "");

    const newVs = vsLines.slice(0, vsStart).join('\n') + '\n' + extraVars + v74Code + '\n' + `
        // Salva o frame transparente nativo
        const frameTitle = String(frameNumber).padStart(3, '0');
        const buf = canvas.toBuffer('image/png', { compressionLevel: 0, filters: canvas.PNG_FILTER_NONE });
        fs.writeFileSync(path.join(tmpFramesDir, \`frame_\${frameTitle}.png\`), buf);
    }
\n` + vsLines.slice(vsEnd).join('\n');

    fs.writeFileSync('services/videoService.js', newVs);
    console.log("videoService.js patched successfully with v74 directly!");
} else {
    console.log("Insertion points not found.");
}
