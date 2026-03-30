# RB Podcast — Documentação de Layouts

Referência técnica do motor de geração de artes (`generate_arts.js`) e dos parâmetros calibrados de cada layout (`templates_config.json`).

---

## Motor de Geração (`generate_arts.js`)

### Pipeline de Renderização
Para cada layout, a ordem de draw é:
1. **Fundo azul** sólido (cor do template)
2. **Foto do convidado** — aplicada como clip circular (`photoCircle`)
3. **PNG template** (cama do layout) — sobrepõe o fundo e define elementos estáticos (ondas, ícone de microfone, box amarelo do episódio, aspas decorativas `"`)
4. **Elementos de texto** — desenhados por cima de tudo (`number`, `guestLabel`, `guestName`, `title`)

### Função `drawTextInBox`
Renderiza texto com **word-wrap automático** e **auto-scale** (reduz o `baselineSize` em 1pt até o texto caber no box).

**Parâmetros suportados:**
| Campo | Tipo | Descrição |
|---|---|---|
| `left`, `top` | px | Âncora superior-esquerda do box de texto |
| `width`, `height` | px | Dimensões máximas do box |
| `font` | string | Nome da fonte (ex: `new-highway-bold`) |
| `baselineSize` | px | Tamanho inicial da fonte (auto-reduz se necessário) |
| `color` | hex | Cor do texto |
| `align` | `left`\|`center`\|`right` | Alinhamento horizontal |
| `verticalAlign` | `middle` | Centraliza verticalmente no box |
| `uppercase` | bool | Converte texto para maiúsculas (`toUpperCase`) |
| `lineHeight` | float | Multiplicador do espaço entre linhas (ex: `1.5`) |
| `letterSpacing` | px | Espaçamento entre letras — renderizado **caractere-a-caractere** (node-canvas não suporta `ctx.letterSpacing`) |
| `letterSpacing` negativo | px | Achatamento/compressão horizontal das letras (kerning negativo) |
| `addQuotes` | bool | Adiciona `"` (aspas curvas fechar) colado ao final da última linha, **fora do alinhamento** — o texto se alinha sem contar a aspa, que "pendura" além da borda |

> **Nota crítica:** `ctx.letterSpacing` é ignorado pelo `node-canvas`. O espaçamento é implementado manualmente via loop de caracteres (`measureText` por letra).

---

## Configuração dos Layouts (`templates_config.json`)

Todos os valores de posição são em **pixels absolutos** no canvas de saída.

### Tipografia — Família `New Highway`
| Variante | Uso |
|---|---|
| `new-highway-light` | CONVIDADO: (label) |
| `new-highway-regular` | Assunto/Título |
| `new-highway-semibold` | Número do episódio |
| `new-highway-bold` | Nome do convidado |

---

### 1. `BannerOrbita_1920x1080` ✅ Aprovado
**Canvas:** 1920 × 1080 px (landscape)  
**Foto:** `cx=1435, cy=542, radius=412` (lado direito)

| Elemento | left | top | width | height | size | notas |
|---|---|---|---|---|---|---|
| `number` | 109 | 96 | 168 | 48 | 48px | center + middle, cor `#006BFF` |
| `guestLabel` | 79 | 258 | 260 | 45 | 42px | uppercase, letterSpacing 1.0 |
| `guestName` | 75 | 307 | 650 | 420 | 110px | lineHeight 0.98, letterSpacing -1.1 (compressão) |
| `title` | 80 | 725 | 809 | 130 | 40px | lineHeight 1.45, addQuotes |

---

### 2. `BannerSite_1440x780` ✅ Aprovado
**Canvas:** 1440 × 780 px (landscape)  
**Foto:** `cx=975, cy=397, radius=355`  
**Elementos de texto:** nenhum (gerados via outro mecanismo / sem `elements` configurados)

---

### 3. `CapaPodcast_1080x1080` ✅ Aprovado
**Canvas:** 1080 × 1080 px (quadrado)  
**Foto:** `cx=537, cy=551, radius=322` (centro)

| Elemento | left | top | width | height | size | notas |
|---|---|---|---|---|---|---|
| `number` | 76 | 76 | 201 | 74 | 40px | center + middle, cor `#006BFF` — coincide com box amarelo do PNG |
| `guestName` | 30 | 885 | 1020 | 140 | 108px | center, lineHeight 0.98, letterSpacing -1.0 |

> Não tem `guestLabel` nem `title` — layout minimalista (só número + nome).

---

### 4. `CapaReels_1920x1080` ✅ Aprovado
**Canvas:** 1080 × 1920 px (portrait 9:16 — Reels/TikTok)  
**Foto:** `cx=540, cy=950, radius=290` (centro-alto, menor)

| Elemento | left | top | width | height | size | notas |
|---|---|---|---|---|---|---|
| `number` | 74 | 463 | 141 | 52 | 29px | center + middle, cor `#024BE7` |
| `guestLabel` | 79 | 1316 | 300 | 42 | 34px | uppercase, letterSpacing 3 |
| `guestName` | 81 | 1366 | 440 | 200 | 78px | lineHeight 0.95, lado esquerdo |
| `title` | 520 | 1358 | 482 | 260 | 40px | align **right**, lineHeight 1.5, addQuotes (aspa pendura à direita do último char) |

> **Layout dividido:** nome à esquerda, título/assunto à direita. As `"` decorativas de abertura estão no PNG; a de fechamento é gerada pelo código fora da borda de alinhamento.

---

### 5. `Story_1920x1080` ✅ Aprovado
**Canvas:** 1080 × 1920 px (portrait 9:16 — Stories)  
**Foto:** `cx=540, cy=958, radius=375` (centro, círculo maior)

| Elemento | left | top | width | height | size | notas |
|---|---|---|---|---|---|---|
| `number` | 71 | 197 | 206 | 76 | 40px | center + middle, cor `#024BE7` — box amarelo confirmado por pixel scan |
| `guestLabel` | 71 | 1383 | 286 | 42 | 42px | uppercase, letterSpacing 3 |
| `guestName` | 71 | 1440 | 940 | 150 | 89px | lineHeight 0.95, largura total |
| `title` | 73 | 1640 | 653 | 200 | 44px | align left, lineHeight 1.5, addQuotes |

> **Layout empilhado:** todos elementos alinhados à esquerda. As `"` decorativas de abertura estão no PNG (~y=1560). O título começa em y=1640 (abaixo das aspas do PNG).

---

## Assets Necessários por Layout

Cada layout requer o arquivo PNG de template em `assets/{LayoutName}.png` e uma foto do convidado em `assets/foto.jpg`.

```
assets/
  BannerOrbita_1920x1080.png
  BannerSite_1440x780.png
  CapaPodcast_1080x1080.png
  CapaReels_1920x1080.png
  Story_1920x1080.png
  foto.jpg   ← foto do convidado (substituída a cada geração)
```

---

## Fontes Registradas

Fontes carregadas em `generate_arts.js` via `registerFont()`:

| Arquivo | Nome interno |
|---|---|
| `NewHighway-Light.otf` | `new-highway-light` |
| `NewHighway-Regular.otf` | `new-highway-regular` |
| `NewHighway-Semibold.otf` | `new-highway-semibold` |
| `NewHighway-Bold.otf` | `new-highway-bold` |

---

## Saída

Arquivos gerados em `output/`:
```
output/
  BannerOrbita_1920x1080_Generated.jpg
  BannerSite_1440x780_Generated.jpg
  CapaPodcast_1080x1080_Generated.jpg
  CapaReels_1920x1080_Generated.jpg
  Story_1920x1080_Generated.jpg
```

Qualidade JPEG: **95%**

---

## Como Gerar

```bash
# Gerar todos os layouts
node generate_arts.js

# Ferramentas de calibração (uso interno)
node find_photo_circle.js <LayoutName>   # detecta círculo transparente no PNG
node find_yellow_box.js <LayoutName>     # detecta box amarelo do episódio
```
