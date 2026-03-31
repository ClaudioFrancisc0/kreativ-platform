# Resumo da Sessão e Hand-Off para o Próximo Agente

Este arquivo foi criado para que o próximo Agente Inteligente, ao assumir a conversa em outro computador, tenha todo o contexto exato de onde paramos e o que precisamos fazer em seguida.

## 🛠️ O que foi feito até agora (Concluído)

1. **Reestruturação Nativa (Nixpacks):** Atualizamos o `nixpacks.toml` incluindo nativamente as bibliotecas Linux `cairo`, `pango`, `libjpeg`, `giflib`, `librsvg` e `pixman` para que a biblioteca gráfica `canvas` compile e funcione perfeitamente no servidor final (Railway).
2. **Exceção no `PROJECT_CONTEXT.md`:** A regra "NO LOCAL TESTING" ganhou uma ressalva oficial. Agora, scripts gráficos standalone (como `generate_arts.js` ou testadores de `ffmpeg`) PODEM ser iterados localmente no console para calibragem de pixels.
3. **Refatoração do Motor Canvas:** Alteramos o antigo arquivo fechado `generate_arts.js` para ser um módulo que exporta a função assíncrona `generateAllLayouts`, aceitando dicionários com os dados do podcast e suportando buffers dinâmicos (evitando escrita de discos rígidos em `/assets`). Além disso, o motor avisa seu progresso.
4. **Endpoint Express Full-Stack:** Adicionamos as bibliotecas `multer` (para forms) e `archiver` (para zips) e criamos a engrenagem de geração em `/routes/agents.js`.
5. **Barra de Progresso (Polling Job):** A rota backend não segura a conexão para evitar *timeout*. Ao dar POST em `/api/agents/rb_podcast/generate`, o sistema fornece um `jobId` UUID, inicia o processamento dos JPGs e das máscaras da foto em _background_, e permite que o frontend faça *polling* (`setInterval`) de um em um segundo no painel `/status/:jobId` para animar a **barra de progresso**. Quando o array termina e os JPGs mudam para o ZIP final (com nome dinâmico `RB_XXX_Podcast_View.zip`), o browser recebe a URL e baixa instantaneamente, fechando a etapa.

## ⛔ Onde Paramos (BLOQUEIO ATUAL)

Chegamos na última fase do RB Podcast, que é o gerador do **Reels Animado MP4**.
Descobrimos que a animação original vinha de projetos do After Effects (`.aep` / `.prproj`).
**Limitação Técnica da Nuvem:** A nossa máquina Linux no Railway (e NodeJS) não roda pacotes da Adobe.

**✅ Solução Aprovada (Opção 1): Motor FFmpeg + Cama.**
Entramos num acordo em que o usuário (Cláudio) irá extrair o vídeo original do After Effects como um `.mp4` "cama" — totalmente limpo e em loop, **sem** textos, **sem** foto presencial e **sem** a curva das ondas de áudio desenhadas.
Assim, nós apenas "salpicaremos" a foto circular e os textos em cima deste vídeo usando `ffmpeg` de trás pra frente no servidor.

### 👉 O que o Próximo Agente deve fazer:

1. **Receber o Arquivo "Cama" e Referências:** Peça ao usuário (se ele já não enviou) o arquivo de vídeo do fundo congelado, bem como a referência perfeita ("Benchmark") para você analisar e ver em quais locais em (X,Y) o Texto, a Foto e o Audiograma/Ondas precisam aparecer;
2. **Criar o `generate_video.js` Local:** Construa um script igualzinho ao das imagens. Ele vai receber o arquivo bruto `foto.jpg / cortado`, o `audio.mp3` e o texto do episódio. E injetar tudo na Cama usando **FFmpeg filters** (para sobrepor fotos no vídeo, text-outline, fade ins e etc);
3. **Testar e Calibrar o Visual:** Exporte o resultado diversas vezes batendo com a tela do benchmark, testando o `letter-spacing` e os enquadramentos, salvando tudo na pasta `/Artes_Geradas_Teste` como manda a regra do `task.md`;
4. **Refatorar para Produção:** Quando a saída ficar perfeita (fase 2 validada), engate a função `generateVideoLayout()` dentro da nossa máquina mestre no `routes/agents.js`, adicione o novo arquivo criado à compilação do `archiver` Zip que construímos hoje para o usuário, e suba tudo na Railway!

Boa sorte! Estamos a um passo de deixar todo o pipeline mágico 100% autônomo. ☁️🚀
