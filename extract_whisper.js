const fs = require('fs');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function main() {
    const audioFilePath = "C:\\Users\\claud\\Desktop\\Kreativ\\RB_0037_Podcast Files\\link\\Chamada_Podcast_896.mp3";
    
    console.log("Enviando áudio para API Whisper...");
    
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(audioFilePath),
            model: "whisper-1",
            response_format: "verbose_json",
            timestamp_granularities: ["segment"] // Precisamos dos timestamps de segmento (frases)
        });

        console.log("Transcrição Concluída! Segmentos identificados:");
        
        // Formatar no modelo que o nosso test_anim.js consome
        const phrases = transcription.segments.map(s => {
            console.log(`[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s] ${s.text.trim()}`);
            return {
                text: s.text.trim(),
                start: s.start,
                end: s.end
            };
        });

        // Simular o comportamento das ondas sonoras. 
        // 500 frames dão uns 16 segundos, que cobre a janela da animação.
        // Onde houver fala, a onda sobe; onde houver silêncio, onda lisa.
        const amplitudes = [];
        let phase = 0;
        for (let f = 0; f <= 1000; f++) { 
            let t_sec = f / 30.0;
            
            // Verifica se o tempo atual do frame cai num momento de fala
            let isActive = phrases.some(p => t_sec >= p.start && t_sec <= p.end);
            
            let bars = [];
            for (let b = 0; b < 13; b++) {
                if (isActive) {
                    // Pico sonoro de fala
                    let val = Math.random() * 0.15 + (Math.sin(phase + b * 0.4) * 0.4 + 0.4);
                    bars.push(Math.max(0.1, Math.min(1.0, val)));
                } else {
                    // Ruído base (silêncio)
                    let val = Math.random() * 0.05 + 0.1;
                    bars.push(Math.max(0.05, Math.min(0.2, val)));
                }
            }
            amplitudes.push(bars);
            phase += 0.2;
        }

        const data = {
            subtitles: phrases,
            amplitudes
        };

        fs.writeFileSync('test_subtitle_data.json', JSON.stringify(data, null, 2));
        console.log("\n-> Dados salvos no test_subtitle_data.json com sucesso!");
        
    } catch(err) {
        console.error("Erro ao chamar Whisper:", err.message);
    }
}

main();
