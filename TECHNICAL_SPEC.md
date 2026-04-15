# 🚀 Kreativ Platform - Especificação Técnica e Arquitetura (RB Podcast)

Este documento foi forjado para atuar como o **Mapeamento Cerebral Absoluto** da arquitetura do projeto. Qualquer IA (ou desenvolvedor) que ler este arquivo terá o contexto completo necessário para realizar manutenções, ajustes de layout ou upgrades nas rotinas de processamento de vídeo e imagem sem quebrar o ecossistema.

---

## 1. Visão Geral do Sistema
A Kreativ Platform é uma aplicação Node.js orientada a agentes inteligentes, sendo o agente atual focado no **RB Podcast**. A principal função do sistema é receber inputs (dados em texto, áudio brut e foto do convidado) e orquestrar uma pipeline complexa multimídia para renderizar:
1. **5 Mídias Estáticas** (Banners, Capas e Stories).
2. **1 Vídeo Animado (Reels/Shorts/TikTok)** com introdução, legendas dinâmicas, elementos geométricos rastreados e áudio equalizado/sincronizado.

**Stack Tecnológico:**
*   **Servidor:** Express.js (`server.js`) rodando nativamente ou em contêineres cloud (ex: Railway) na porta 3000.
*   **Renderização Gráfica 2D:** `canvas` (Node-Canvas) manipulando pixels frame a frame.
*   **Renderização de Vídeo:** `fluent-ffmpeg` / instâncias de `ffmpeg` (`@ffmpeg-installer/ffmpeg`) efetuando multiplexação áudio+vídeo em CFR (Constant Framerate).
*   **Transcrição de Áudio:** INTEGRAÇÃO OPENAI (Whisper) extraindo legendas milissegundo a milissegundo.

---

## 2. Estrutura de Diretórios e Dependências

```text
kreativ-platform/
├── server.js                 # Entrypoint principal (Express, Healthchecks, Rotas)
├── generate_arts.js          # Motor isolado de geração de artes Estáticas (PNGs/JPGs)
├── templates_config.json     # Banco de Dados geométricos (posições X, Y, fontes e larguras das artes)
├── box_tracking_true.json    # Dados brutos do After Effects (Tracking da cama amarela per/frame)
├── test_anim.js              # (Histórico) Prova de conceito original e matemática do Canvas v74
├── .env                      # Variáveis vitais (OPENAI_API_KEY, PORT)
├── assets/                   # Fontes (New-Highway-*), Vídeo Base (cama_sem_mic.mp4), Máscaras base
├── cama_frames/              # *Gerado dinamicamente no boot*. Frames fotográficos exatos da cama base
├── routes/                   # Controladores Express (users, agents, auth, admin)
└── services/
    ├── videoService.js       # O MOTOR CARDÍACO DO SISTEMA. Loop de renderização frame-a-frame de vídeo.
    ├── configService.js      # Gerenciamento de credenciais e API Keys
    └── ...
```

---

## 3. Lógica do Motor de Vídeo (`videoService.js`)

A renderização de vídeo abandonou sobreposições nativas do FFmpeg (`overlay`) devido a corrupções de timestamp e VFR (Variable Framerate). Em vez disso, o sistema utiliza **"Composição Nativa de Malha"**:

### O Ciclo Perfeito Sub-Pixel:
1. **Extração Nativada:** Se a pasta `cama_frames` não possuir ~320 frames da cama amarela base, o servidor invoca o FFmpeg oculto e "frita" o arquivo `assets/cama_sem_mic.mp4` em uma sequência exata de `.png`s a exatos 30fps.
2. **Loop de Render (**`for (let frameNumber = 1...`**):**
   *   O fundo base é costurado através do operador Módulo (`bgFrameIndex = ((frameNumber - 1) % 321) + 1`), garantindo que a cama base e suas partículas de luz voando no fundo fiquem em "Loop Infinito Perfeito" enquanto o vídeo durar 60 segundos ou mais.
3. **Animação Geocêntrica (Intro):**
   *   O círculo central revela a foto do convidado com uma mescla complexa.
   *   **Zoom Out Escalar:** Encolhe de um formidável `startRadius = 2400` para `finalRadius = 298`.
   *   **Kawase Blur:** O Desfoque Gaussiano web nativo quebra em Windows/Linux Server na biblioteca Canvas. Substituímos por um algoritmo iterativo "Kawase" (`drawImageWithBlur`), que encolhe a imagem em múltiplos sub-canvas em loop gerando desfoque hiper-realista.
4. **Sincronia do Tracking (The Yellow Box):**
   *   **Regra de Ouro:** Tudo que for texto NÃO PODE APARECER enquanto a caixa amarela não estiver na tela!
   *   Se `frameNumber < minKey` (a caixa ainda não entrou na tela no vídeo), as variáveis de texto somem (`hasData = undefined`) e abortam o desenho silenciosamente.
   *   Se `frameNumber > maxKey` (a caixa já entrou e firmou em repouso), as posições X e Y travam nas âncoras finais (`maxKey`), ancorando o texto até terminar o reels.

---

## 4. Especificação de Elementos (Tamanhos, Cores e Posições)

### Banners Estáticos (`templates_config.json`)
O sistema lê este JSON. Nunca gere quebras puras de matemática para custom text que já contém quebras da API.
*Fonte Global:* Escala da família **"New-Highway"** (Bold, Semi-Bold, Regular, Light).
*Regra de Quebra:* A função `drawTextInBox` inspeciona instâncias de `\n` na String. Se existirem, ela prioriza a quebra de linha humana forçada.
*   **Story_1920x1080:**
    *   *Number:* `x: 63`, `y: 191`, `size: 91px Bold`, `color: #3571FE`
    *   *GuestLabel ("Convidado:"):* `x: 58`, `y: 470`, `size: 26px Bold`, `color: #ffffff`
    *   *GuestName:* `x: 55`, `y: 508`, `w: 247`, `h: 220`, `size: 58px Bold`
    *   *Title:* `x: 1045` (origem direita para esquerda "right"), `y: 473`, `w: 290`, `h: 300`, `size: 32px Regular`, `color: #ffffff`.

*   **BannerOrbita_1920x1080:**
    *   *Title:* Tem alinhamento centralizado massivo no eixo X:522 y:867 e box de `w:609`, precisando de excelente balanceamento automático (`balancedWrap`) quando carece de `\n`.

### Vídeo Animado (`videoService.js`)
*(Medidas em coordenadas flutuantes nativas amarradas ao `box_tracking_true.json`)*
*   **Box de Assunto (Title):** Atrelado estritamente à âncora `right: 1022`, preenchendo um quadro flutuante de `w:482` movendo-se lateral e verticalmente via cálculos `dynY = block.top - bg_scrollY + yOffset` de paralaxe fotográfica simulada.
*   **Caixa do Número:** Crava precisamente em `numExtraX = base_maxX - 131.5` e `numExtraY = base_maxY - 29.5`. Fonte `36px New-Highway-Bold`. Usa cor `#3571FE` (Azul da paleta).
*   **Microfone Físico:** Recebe a mesma regra gravitacional base, ancorando-se fixo com offset `yShiftOffset` global de +80px gerado pela variável `standardEaseEase` no segundo 2 da animação.

---

## 5. Áudio e Conversão (FFmpeg)
Como o vídeo animado demora exatos 45 frames (1.5 segundos) de estagnamento apenas para a animação fantasma inicial do Kawase Blur:
*   O áudio é processado via comando FFmpeg final e empurrado linearmente `.af('adelay=1500|1500')`. Pular este Delay significa dessincronizar inteiramente a boca do speaker com as legendas criadas pela IA, visto que a IA cria as marcações de JSON Timestamp a partir do início `00:00:00:00` do áudio limpo, sem conhecimento visual dos 1.5s introductórios criados pelo JS.

---

## 6. Instruções para Alterações Futuras (Warning para IAs)
> [!WARNING]
> Nunca modifique arquivos centrais como `videoService.js` trocando bibliotecas nativas de desenho (`drawImageWithBlur`) por primitivas `ctx.filter = "blur"`, sob pretexto de "simplificar" o código. A primitiva do C++ Cairo suportada varia muito em sistemas serverless Linux e pode suprimir toda a camada ou gerar transparências fatais.

> [!IMPORTANT]
> Em hipótese alguma ignore os `.gitignore` em suas averiguações. Pastas volumosas como `cama_frames` e `assets` muitas vezes estão invisíveis no git, fazendo com que implementações locais perfeitíssimas deem `Crash` em Produção no Pipeline Railway ou AWS. Sempre crie Fallbacks em Runtime que instanciem os arquivos (executando FFmpeg oculto por exemplo) ou gerem pastas ausentes on the fly. 

**Resumo para debug express:**
1. Textos estáticos desalinhados? `templates_config.json`.
2. Texto estático não respeitando quebras? `generate_arts.js` > `drawTextInBox` (Cheque processamento do array `\n`).
3. Vídeo com elementos flutuando/soltos? Cheque a malha matemática `box_tracking_true.json` em `videoService.js` manipulando `frameNumber`. Sempre deixe `hasData = undefined` em frames antes d caiaxa entrar!
4. Vídeo sem fundo / fundo despareceu? Faltou chamar a extração `execFileSync` dos frames PNG para embutimento no Node Canvas. No `overlay` não use PTS manipulation com loop videos em ffmpeg!

Este arquivo será mantido na raiz do repositório como guia principal eterno.
