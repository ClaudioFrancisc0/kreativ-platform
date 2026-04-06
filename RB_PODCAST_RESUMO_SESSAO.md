# Resumo da Sessão e Hand-Off para o Próximo Agente

Este arquivo foi criado para que o próximo Agente Inteligente, ao assumir a conversa em outro computador, tenha todo o contexto exato de onde paramos e o que precisamos fazer em seguida.

## 🛠️ O que foi feito até agora (Concluído)

1. **Reestruturação Nativa (Nixpacks):** Atualizamos o `nixpacks.toml` incluindo nativamente as bibliotecas Linux `cairo`, `pango`, `libjpeg`, `giflib`, `librsvg` e `pixman` para que a biblioteca gráfica `canvas` compile e funcione perfeitamente no servidor final (Railway).
2. **Exceção no `PROJECT_CONTEXT.md`:** A regra "NO LOCAL TESTING" ganhou uma ressalva oficial. Agora, scripts gráficos standalone (como `generate_arts.js` ou testadores de `ffmpeg`) PODEM ser iterados localmente no console para calibragem de pixels.
3. **Refatoração do Motor Canvas:** Alteramos o antigo arquivo fechado `generate_arts.js` para ser um módulo que exporta a função assíncrona `generateAllLayouts`, aceitando dicionários com os dados do podcast e suportando buffers dinâmicos (evitando escrita de discos rígidos em `/assets`). Além disso, o motor avisa seu progresso.
4. **Endpoint Express Full-Stack:** Adicionamos as bibliotecas `multer` (para forms) e `archiver` (para zips) e criamos a engrenagem de geração em `/routes/agents.js`.
5. **Barra de Progresso (Polling Job):** A rota backend não segura a conexão para evitar *timeout*. Ao dar POST em `/api/agents/rb_podcast/generate`, o sistema processa JPGs e máscaras via _background_, fornecendo *polling* no painel `/status/:jobId` para animar a barra. Quando as imagens mudam para o ZIP final (`RB_XXX_Podcast_View.zip`), o browser baixa instantaneamente. Tudo já com *push* na nuvem da Railway!

## ⛔ Onde Paramos (BLOQUEIOS E PRÓXIMA FASE)

Chegamos na última fase do RB Podcast, que é o gerador do **Reels Animado MP4**.
A nossa máquina Linux no Railway não roda projetos originais da Adobe (AE), portanto nós migramos o workflow para um **Motor Híbrido**. Para o *benchmark*, o usuário enviou o vídeo de referência do episódio 37 (`Reels Animado_podcast_896_02_legendado.mp4`), confirmando que queremos um "Fly-In" fluido das fotos da abertura que param estáticos acompanhados das legendas e onda sonora.

A estratégia Híbrida será: O Node Canvas gera PNGs frame-a-frame suavizados de entrada; e o FFmpeg usa o filtro `showwaves` para colocar o audigrama animado e as legendas `.srt`, em cima de um arquivo de "Vídeo Cama".

### 👉 O que o Próximo Agente deve fazer (Quando Retomarem o Chat):

Paramos exatamente aqui hoje porque existem **dois pré-requisitos pendentes** para que a engrenagem de Vídeo seja codificada:

1. **O Arquivo de Cama Faltante:** O usuário da Kreativ ainda não possui o MP4 "Cama Limpo" do After Effects. Antes de testar qualquer FFmpeg filter, aguarde-o fornecer o vídeo vazio rodando apenas o fundo num ciclo looping e meça suas proporções.
2. **Nova Pipeline de Interface de Rever/Transcrever Áudio (Inteligência Artificial):** Como as legendas não virão em formato .srt prontas na mão do usuário, acordamos em criar uma Feature extra no frontend. Precisaremos:
    - **Fase A:** No formulário da UI, quando subir a entrevista da pessoa, o servidor usará uma ponte (ex: requisição web para API do Whisper/OpenAI) para gerar a transcrição do áudio enviado.
    - **Fase B:** Adicionar no Frontend `public/agents/rb_podcast.html` um painel/modal que mostre a "Caixa de Texto Editável" juntamente com um Player de Áudio incorporado para o usuário escutar as falas, ler as legendas extraídas e corrigir palavras erradas/apontar quebras manuais na revisão humana.
    - **Fase C:** Após a aprovação e clique por parte do usuário neste widget, essa String corrigida vai oficialmente para o backend Node criar o `.srt` e o motor gráfico empacotar tudo no `ffmpeg` que expele o vídeo MP4 final.

**Siga essas Tasks rigidamente quando o usuário te entregar os arquivos base. Sucesso na continuidade e programação das rotas de Transcrição de Áudio! ☁️🚀**
