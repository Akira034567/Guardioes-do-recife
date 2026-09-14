import type Phaser from "phaser";

/**
 * Pictogramas do HUD da partida. Mesma ideia dos SVG das telas em HTML (`ui/dom/icons.ts`), mas
 * pintados em canvas 2D e virados textura, porque dentro do canvas do jogo não existe SVG inline.
 *
 * Todo desenho acontece numa caixa de 24×24; `hudIcon` escala para o tamanho pedido. Nada de emoji:
 * o glifo muda de desenho e de cor a cada sistema operacional, e o HUD depende das cores.
 */

type Ctx = CanvasRenderingContext2D;

export type HudIconName =
  | "pearl"
  | "waves"
  | "heart"
  | "hourglass"
  | "pause"
  | "play"
  | "forward"
  | "expand"
  | "sound"
  | "muted"
  | "trident"
  | "blade"
  | "target"
  | "cadence"
  | "refresh"
  | "map"
  | "skull"
  | "lock"
  | "check"
  | "shell";

function stroke(ctx: Ctx, path: string, color: string, width = 2): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(path));
}

function fill(ctx: Ctx, path: string, color: string): void {
  ctx.fillStyle = color;
  ctx.fill(new Path2D(path));
}

/** Uma crista de onda na altura `y`; empilhadas formam o símbolo do Recife. */
const crest = (y: number): string => `M2.4 ${y}q3.4 -3.6 6.8 0t6.8 0t6.8 0`;

const ART: Record<HudIconName, (ctx: Ctx, color: string) => void> = {
  /** Pérola: a moeda da partida. Cor própria — o dourado é a leitura mais rápida do HUD. */
  pearl: (ctx) => {
    const body = ctx.createLinearGradient(4, 3, 20, 21);
    body.addColorStop(0, "#ffe9a8");
    body.addColorStop(0.55, "#ffc247");
    body.addColorStop(1, "#d98a24");
    ctx.beginPath();
    ctx.arc(12, 12, 9.2, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, 12, 6.2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 248, 214, 0.8)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(9, 8.8, 2.6, 1.7, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.fill();
  },

  /** Três cristas: o Recife, as ondas e a sondagem. */
  waves: (ctx, color) => {
    ctx.globalAlpha = 1;
    stroke(ctx, crest(7.5), color, 2.4);
    ctx.globalAlpha = 0.78;
    stroke(ctx, crest(13), color, 2.4);
    ctx.globalAlpha = 0.52;
    stroke(ctx, crest(18.5), color, 2.4);
    ctx.globalAlpha = 1;
  },

  /**
   * Coração: as vidas do Recife. Era um alfinete de mapa, que dizia "aqui" e não "quanto falta" — o
   * número ao lado conta vidas, e vida se lê em coração em qualquer jogo. Mesmo desenho do
   * `ICONS.heart` das telas em HTML, para os dois lugares contarem a mesma coisa do mesmo jeito.
   */
  heart: (ctx, color) => {
    fill(ctx, "M12 20.8S3.8 15.3 3.8 9.6A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.2 2.7c0 5.7-8.2 11.2-8.2 11.2z", color);
    // Brilho curto no alto à esquerda: dá volume ao coração sem virar um segundo ícone.
    ctx.globalAlpha = 0.75;
    stroke(ctx, "M8.4 8.8a2.4 2.4 0 0 1 2-1.2", "#ffffff", 1.5);
    ctx.globalAlpha = 1;
  },

  /** Ampulheta: o tempo até a próxima onda. */
  hourglass: (ctx, color) => {
    fill(ctx, "M7.4 4.6h9.2c0 3.6-4.6 4.6-4.6 7.4s4.6 3.8 4.6 7.4H7.4c0-3.6 4.6-4.6 4.6-7.4S7.4 8.2 7.4 4.6z", `${color}33`);
    stroke(ctx, "M6.4 3.4h11.2M6.4 20.6h11.2", color, 2.2);
    stroke(ctx, "M7.6 3.4c0 3.8 4.4 4.8 4.4 8.6s-4.4 4.8-4.4 8.6M16.4 3.4c0 3.8-4.4 4.8-4.4 8.6s4.4 4.8 4.4 8.6", color, 2.2);
    fill(ctx, "M9.4 17.4c0-2 5.2-2 5.2 0l.8 2.2H8.6z", color);
  },

  pause: (ctx, color) => {
    fill(ctx, "M7.6 4.4h3.2a1 1 0 0 1 1 1v13.2a1 1 0 0 1-1 1H7.6a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1z", color);
    fill(ctx, "M13.2 4.4h3.2a1 1 0 0 1 1 1v13.2a1 1 0 0 1-1 1h-3.2a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1z", color);
  },

  play: (ctx, color) => fill(ctx, "M7.4 4.6 19.4 12 7.4 19.4z", color),

  /** Duplo triângulo: chamar a próxima onda. */
  forward: (ctx, color) => {
    fill(ctx, "M3.4 5.4 12 12l-8.6 6.6z", color);
    fill(ctx, "M11.4 5.4 20 12l-8.6 6.6z", color);
  },

  /** Quatro cantos: tela cheia. */
  expand: (ctx, color) =>
    stroke(ctx, "M4 9V4.8a.8.8 0 0 1 .8-.8H9M15 4h4.2a.8.8 0 0 1 .8.8V9M20 15v4.2a.8.8 0 0 1-.8.8H15M9 20H4.8a.8.8 0 0 1-.8-.8V15", color, 2.4),

  sound: (ctx, color) => {
    fill(ctx, "M4.6 9.4h3.2L12.8 5v14l-5-4.4H4.6a.8.8 0 0 1-.8-.8v-3.6a.8.8 0 0 1 .8-.8z", color);
    stroke(ctx, "M15.8 9.2a4 4 0 0 1 0 5.6M18.4 6.6a7.6 7.6 0 0 1 0 10.8", color, 2);
  },

  muted: (ctx, color) => {
    fill(ctx, "M4.6 9.4h3.2L12.8 5v14l-5-4.4H4.6a.8.8 0 0 1-.8-.8v-3.6a.8.8 0 0 1 .8-.8z", color);
    stroke(ctx, "M16 9.6 21 14.6M21 9.6 16 14.6", color, 2.2);
  },

  /** Tridente: o cabeçalho do esquadrão. */
  trident: (ctx, color) => {
    stroke(ctx, "M12 3.2v17.6M5.4 6.4v3.2a6.6 6.6 0 0 0 13.2 0V6.4M5.4 6.4 3.6 8.6M18.6 6.4l1.8 2.2M9.6 18.8h4.8", color, 1.9);
  },

  /** Lâmina: o dano. */
  blade: (ctx, color) => {
    fill(ctx, "M20.8 3.2v3.4L11.4 16l-3.4-3.4L17.4 3.2z", color);
    stroke(ctx, "M9.2 14.4 4.6 19M3.2 17.4 6.6 20.8", color, 2.2);
  },

  /** Alvo concêntrico: o alcance. */
  target: (ctx, color) => {
    stroke(ctx, "M12 3.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8z", color, 1.9);
    stroke(ctx, "M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", color, 1.9);
    ctx.beginPath();
    ctx.arc(12, 12, 1.4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  },

  /** Cronômetro: a cadência de ataque. */
  cadence: (ctx, color) => {
    stroke(ctx, "M12 6a7.4 7.4 0 1 1 0 14.8A7.4 7.4 0 0 1 12 6z", color, 1.9);
    stroke(ctx, "M12 9.4v4.2l2.8 1.8M9.4 2.8h5.2M12 2.8V6", color, 1.9);
  },

  /** Seta em círculo: reiniciar. */
  refresh: (ctx, color) => {
    stroke(ctx, "M20 12a8 8 0 1 1-2.6-5.9", color, 2.2);
    fill(ctx, "M20.6 3.2v5.2h-5.2z", color);
  },

  /** Mapa dobrado: a lista de fases. */
  map: (ctx, color) => {
    stroke(ctx, "M9 4.4 3.6 6.6v13l5.4-2.2 6 2.2 5.4-2.2v-13L15 6.6z", color, 1.9);
    stroke(ctx, "M9 4.4v13.2M15 6.6v13.2", color, 1.9);
  },

  skull: (ctx, color) => {
    fill(ctx, "M12 2.8c-4.6 0-7.6 3-7.6 7.2 0 2.6 1.1 4.1 2.2 5 .5.4.8 1 .8 1.7v1.5c0 1.1.9 2 2 2h5.2c1.1 0 2-.9 2-2v-1.5c0-.7.3-1.3.8-1.7 1.1-.9 2.2-2.4 2.2-5 0-4.2-3-7.2-7.6-7.2z", color);
    ctx.fillStyle = "#12111a";
    ctx.beginPath();
    ctx.arc(9.1, 10.4, 2.1, 0, Math.PI * 2);
    ctx.arc(14.9, 10.4, 2.1, 0, Math.PI * 2);
    ctx.fill();
    fill(ctx, "M12 13.6l-1 2.2h2z", "#12111a");
  },

  lock: (ctx, color) => {
    fill(ctx, "M5.2 10.6h13.6a1.8 1.8 0 0 1 1.8 1.8v6.6a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8v-6.6a1.8 1.8 0 0 1 1.8-1.8z", color);
    stroke(ctx, "M8 10.6V7.8a4 4 0 0 1 8 0v2.8", color, 2);
  },

  check: (ctx, color) => stroke(ctx, "M4.6 12.6 9.6 17.6 19.4 6.8", color, 2.8),

  /** Concha: a moeda de fora da partida, usada no resumo. */
  shell: (ctx, color) => {
    fill(ctx, "M12 3.4c4.8 0 8.6 4 8.6 8.8 0 3.4-1.7 6.2-4 7.6H7.4c-2.3-1.4-4-4.2-4-7.6 0-4.8 3.8-8.8 8.6-8.8z", color);
    stroke(ctx, "M12 3.6v16.2M8.2 4.4 6.1 19.4M15.8 4.4l2.1 15", "rgba(4, 26, 43, 0.45)", 1.1);
  },
};

/**
 * Textura de um pictograma no tamanho e na cor pedidos. A chave carrega os três parâmetros, então
 * pedir o mesmo ícone duas vezes não repinta nada.
 */
export function hudIcon(scene: Phaser.Scene, name: HudIconName, size: number, color: string): string {
  const key = `hud-icon:${name}:${size}:${color}`;
  if (scene.textures.exists(key)) return key;
  const pad = 2;
  const side = Math.ceil(size) + pad * 2;
  const texture = scene.textures.createCanvas(key, side, side);
  if (!texture) return key;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, side, side);
  ctx.save();
  ctx.translate(pad, pad);
  ctx.scale(size / 24, size / 24);
  ART[name](ctx, color);
  ctx.restore();
  texture.refresh();
  return key;
}
