# Eras: Crônicas da Interface

> Um jogo de plataforma em que **a história das interfaces é a mecânica**. Atravesse 70 anos de computação, de um osciloscópio de 1958 a uma interface "neon glass" de 2026, e a cada era mudam os gráficos, a física e as regras do jogo.

📖 **Leia o documento de conceito completo: [docs/CONCEITO.md](docs/CONCEITO.md)**, com a visão, a premissa, a fantasia do jogador, o significado de cada era e a filosofia de design.

---

## O conceito

A linha do tempo das interfaces se partiu. Para restaurá-la, o jogador percorre uma única fase contínua e viaja entre **10 eras da computação**. Trocar de era não muda só a aparência: muda **o que o personagem consegue fazer**.

- Em **1958** o pulo é rígido, linear, sem controle no ar, como um ponto num osciloscópio.
- Em **1977**, no terminal ASCII, paredes de `// comentário` deixam de existir: o código comentado não é executado.
- Em **1984** e **1995**, as janelas do sistema operacional são objetos físicos. Dá para arrastá-las com o mouse e usá-las como ponte.
- Em **1999**, o *Bullet Time* desacelera o mundo para passar por lasers.
- De **2005** a **2026** chegam o pulo duplo, o dash, o *coyote time* e o *squash & stretch* das interfaces modernas.

Cada obstáculo da fase foi desenhado para ser resolvido por **uma era específica**. O jogador aprende a história da interface **usando-a**.

### Pilares de design

1. **A era é a ferramenta.** Toda mecânica nasce de uma característica real da época (vetores, texto, janelas, 8/16 bits, Flash, flat design).
2. **Uma fase, muitas leituras.** O mesmo mapa é redesenhado por completo em cada era: texturas, fundo, HUD, fontes e sons.
3. **O sistema operacional faz parte do jogo.** Janelas e pop-ups em HTML ficam sobre o canvas e interagem com a física do Phaser.
4. **Progressão linear.** Artefatos de hardware desbloqueiam as eras na ordem em que os obstáculos aparecem.

---

## As 10 eras

| Tecla | Ano | Era | Mecânica destaque | HUD |
|:---:|:---:|---|---|---|
| `1` | 1958 | Tennis for Two | Pulo linear, sem controle no ar | Osciloscópio |
| `2` | 1977 | Terminal ASCII | Atravessa paredes `// comentário` | MS-DOS |
| `3` | 1984 | Macintosh 1-bit | Arrastar janelas | System 1 |
| `4` | 1986 | 8-Bit Arcade | Controle aéreo + pulo variável | Arcade 8-bit |
| `5` | 1991 | 16-Bit Parallax | Inércia + wall-jump | Arcade 16-bit |
| `6` | 1995 | Windows 95 | Arrastar janelas + fechar pop-ups | Barra de tarefas |
| `7` | 1999 | Cyber Y2K | Bullet Time (obstáculos a 40%) | Winamp |
| `8` | 2005 | Flash & Aero | Pulo duplo | Aero / Web 2.0 |
| `9` | 2013 | Flat Design | Dash + coyote time + jump buffer | Flat |
| `0` | 2026 | Neon Glass | Dash neon + squash & stretch | Glassmorphism |

As mecânicas se acumulam a partir de 1991. Por exemplo, 2013 mantém inércia, wall-jump e pulo duplo e acrescenta o dash.

---

## A fase

Uma única fase horizontal de 6400 × 2400 px, dividida em cinco setores:

| Setor | Desafio | Era para resolver |
|---|---|---|
| **1. Início** | Saltos básicos e um *firewall* feito de comentários | 1958 → 1977 |
| **2. Abismo** | Um vão largo demais para pular, e um pop-up "Erro Fatal 404" bloqueando o corredor | 1984 / 1995 (arrastar a janela como ponte, fechar o pop-up) |
| **3. Chaminé e lasers** | Subida vertical estreita, seguida de um corredor com 6 lasers pulsantes | 1991 (wall-jump) → 1999 (Bullet Time) |
| **4. Torre** | Mola elástica, plataformas altas e um túnel baixo sobre dois poços | 2005 (pulo duplo) → 2013/2026 (dash) |
| **5. Núcleo** | Alcançar o Núcleo 2026 e restaurar a linha do tempo | 2026 |

Checkpoints ao longo do caminho definem onde o jogador renasce ao morrer.

### Artefatos de hardware (progressão)

Cada artefato fica **antes** do obstáculo que exige a era que ele libera:

| Artefato | Libera |
|---|---|
| Válvula Termiônica | 1977 |
| Disquete 5¼" | 1984, 1986 |
| Mouse de Bola | 1991, 1995 |
| Cartucho 8-Bit | 1999 |
| CD-ROM | 2005 |
| GPU Neon | 2013, 2026 |

Tentar viajar para uma era ainda bloqueada mostra qual artefato falta.

---

## Controles

| Tecla | Ação |
|---|---|
| `←` `→` | mover |
| `Espaço` | pular (pulo duplo a partir de 2005) |
| `1` … `0` | viajar entre eras desbloqueadas |
| `Parede + Espaço` | wall-jump (1991+) |
| `Shift` | liga/desliga o Bullet Time (1999) |
| `X` / `K` / `Shift` | dash (2013+) |
| Mouse | arrastar janelas (1984 / 1995) e fechar pop-ups |
| `Esc` / `P` | pausar / continuar |

A barra da linha do tempo, na parte de baixo da tela, também troca de era com um clique e tem os botões **Pausar** e **Reiniciar**.

---

## Arquitetura

O jogo combina **Phaser 3** (mundo, física, renderização) com **React** (HUDs temáticos, janelas do SO, telas). As duas camadas conversam só por um barramento de eventos tipado.

```
                 ┌──────────────────────┐
  teclas 1..0 ──▶│     EraManager       │──▶ ERA_CHANGED / ERAS_UNLOCKED
                 │ era atual, desbloqueio│
                 └──────────┬───────────┘
                            │
                    ┌───────▼────────┐
                    │    EventBus    │  (contrato em src/core/types.ts)
                    └───┬────────┬───┘
                        │        │
     ┌──────────────────▼─┐    ┌─▼─────────────────────────┐
     │  Phaser (canvas)   │    │  React (DOM sobre o canvas)│
     │  MainLevelScene    │    │  HUD temático por era      │
     │  Player, lasers,   │◀──▶│  Janelas arrastáveis (SO)  │
     │  texturas por era  │    │  Título, pausa, vitória    │
     └────────────────────┘    └────────────────────────────┘
```

- **Janelas DOM viram colisores.** O React converte a posição de tela da janela em coordenadas do mundo e emite `WINDOWS_UPDATED`. A cena cria ou move um corpo físico estático no mesmo lugar.
- **Gráficos procedurais.** Todas as texturas de todas as eras são geradas em código (`src/game/pipelines/`), sem arquivos de imagem.
- **Som sintetizado.** Cada era tem seu timbre, gerado com Web Audio (`SoundSynthesizer.ts`).

### Estrutura

```
src/
  core/        contrato (types), EventBus, EraManager, SoundSynthesizer
  game/        Phaser: cena, jogador, layout da fase, renderização por era
  components/  React: HUDs por era, janelas do SO, timeline, telas
```

O layout da fase inteira (plataformas, perigos, lasers, artefatos, checkpoints, placas) está declarado em `src/game/level/LevelLayout.ts`.

---

## Como rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build de produção em dist/
```

**Stack:** Phaser 3 · React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Lucide.
