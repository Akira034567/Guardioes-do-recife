import type Phaser from "phaser";

/**
 * Pele do HUD da partida: painéis de vidro e pictogramas desenhados em canvas 2D e guardados como
 * textura do Phaser.
 *
 * O `Graphics` do Phaser não faz degradê, brilho externo nem canto arredondado com borda dupla — e é
 * exatamente disso que o visual moderno depende. Como `textures.createCanvas` é síncrono, dá para
 * pintar tudo com a API do canvas no `create()` da cena e usar `add.image` normalmente. Cada textura
 * é cacheada pela chave derivada dos parâmetros, então repetir a mesma pílula não repinta nada.
 */

type Ctx = CanvasRenderingContext2D;

/** Folga em volta de cada painel para o brilho externo não ser cortado pela borda da textura. */
export const GLOW_PAD = 10;

export const HUD_FONT = {
  /** Textos de interface: mesma família das telas em HTML. */
  body: 'Inter, "Segoe UI", Roboto, Arial, sans-serif',
  /** Títulos e números fortes. */
  strong: '"Arial Black", Inter, "Segoe UI", Arial, sans-serif',
} as const;

export const HUD_COLORS = {
  text: "#eaf9ff",
  textSoft: "#93c6db",
  textDim: "#6c9db2",
  cyan: "#5fd8f7",
  cyanBright: "#a8efff",
  pearl: "#ffd977",
  danger: "#ff8792",
  success: "#6ef0b0",
  warn: "#ffc95f",
} as const;

export interface PanelStyle {
  radius?: number;
  /** Degradê vertical do preenchimento. */
  fill?: readonly [string, string];
  border?: string;
  /** Borda mais clara no topo, como vidro pegando luz de cima. */
  borderTop?: string;
  borderWidth?: number;
  /** Brilho externo na cor da borda. */
  glow?: string;
  glowBlur?: number;
  /** Brilho interno colado na borda (estado aceso). */
  innerGlow?: string;
  /** Faixa clara no topo de dentro. */
  sheen?: number;
  /** Linha acesa só na base (as barras do HUD usam para separar do mapa). */
  edgeBottom?: string;
  edgeTop?: string;
}

const DEFAULT_STYLE: Required<Pick<PanelStyle, "radius" | "fill" | "border" | "borderWidth" | "glow" | "glowBlur" | "sheen">> = {
  radius: 12,
  fill: ["rgba(12, 52, 80, 0.88)", "rgba(4, 21, 36, 0.92)"],
  border: "#2fb6e0",
  borderWidth: 2,
  glow: "rgba(79, 214, 255, 0.35)",
  glowBlur: 10,
  sheen: 0.1,
};

/** `roundRect` só chegou tarde ao Safari; o caminho manual mantém o HUD igual em qualquer navegador. */
function roundRectPath(ctx: Ctx, x: number, y: number, width: number, height: number, radius: number): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function canvasTexture(scene: Phaser.Scene, key: string, width: number, height: number): Ctx | null {
  if (scene.textures.exists(key)) return null;
  const texture = scene.textures.createCanvas(key, Math.ceil(width), Math.ceil(height));
  if (!texture) return null;
  const ctx = texture.getContext();
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

function finish(scene: Phaser.Scene, key: string): string {
  const texture = scene.textures.get(key);
  if (texture && "refresh" in texture) (texture as Phaser.Textures.CanvasTexture).refresh();
  return key;
}

/**
 * Painel de vidro: preenchimento em degradê, borda acesa, brilho externo e um realce no topo.
 * A imagem sai maior que o painel (`GLOW_PAD` de cada lado); como a folga é simétrica, basta
 * posicionar a imagem no centro do painel para ela cair no lugar certo.
 */
export function hudPanel(scene: Phaser.Scene, width: number, height: number, style: PanelStyle = {}): string {
  const key = `hud-panel:${width}x${height}:${JSON.stringify(style)}`;
  const ctx = canvasTexture(scene, key, width + GLOW_PAD * 2, height + GLOW_PAD * 2);
  if (!ctx) return key;

  const radius = style.radius ?? DEFAULT_STYLE.radius;
  const fill = style.fill ?? DEFAULT_STYLE.fill;
  const border = style.border ?? DEFAULT_STYLE.border;
  const borderWidth = style.borderWidth ?? DEFAULT_STYLE.borderWidth;
  const glow = style.glow ?? DEFAULT_STYLE.glow;
  const glowBlur = style.glowBlur ?? DEFAULT_STYLE.glowBlur;
  const sheen = style.sheen ?? DEFAULT_STYLE.sheen;
  const x = GLOW_PAD + borderWidth / 2;
  const y = GLOW_PAD + borderWidth / 2;
  const w = width - borderWidth;
  const h = height - borderWidth;

  const gradient = ctx.createLinearGradient(0, y, 0, y + h);
  gradient.addColorStop(0, fill[0]);
  gradient.addColorStop(1, fill[1]);
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Realce de vidro: uma faixa clara presa no topo de dentro.
  if (sheen > 0) {
    ctx.save();
    ctx.clip();
    const light = ctx.createLinearGradient(0, y, 0, y + Math.min(h * 0.55, 34));
    light.addColorStop(0, `rgba(186, 240, 255, ${sheen})`);
    light.addColorStop(1, "rgba(186, 240, 255, 0)");
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Brilho interno do estado aceso, desenhado por dentro do recorte para ficar colado na borda.
  if (style.innerGlow) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
    ctx.shadowColor = style.innerGlow;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = style.innerGlow;
    ctx.lineWidth = borderWidth + 1;
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.stroke();
    ctx.stroke();
    ctx.restore();
  }

  // Borda com brilho externo. O degradê deixa o topo mais claro que a base, como metal molhado.
  ctx.save();
  ctx.shadowColor = glow;
  ctx.shadowBlur = glowBlur;
  const stroke = ctx.createLinearGradient(0, y, 0, y + h);
  stroke.addColorStop(0, style.borderTop ?? border);
  stroke.addColorStop(1, border);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = borderWidth;
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.stroke();
  ctx.restore();

  // Linha acesa em uma das bordas: é o que separa as barras do HUD do mapa.
  if (style.edgeBottom) {
    ctx.save();
    ctx.shadowColor = style.edgeBottom;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = style.edgeBottom;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y + h - 1);
    ctx.lineTo(x + w - radius, y + h - 1);
    ctx.stroke();
    ctx.restore();
  }
  if (style.edgeTop) {
    ctx.save();
    ctx.shadowColor = style.edgeTop;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = style.edgeTop;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y + 1);
    ctx.lineTo(x + w - radius, y + 1);
    ctx.stroke();
    ctx.restore();
  }

  return finish(scene, key);
}

/** Área clicável exata de um painel: a imagem tem a folga do brilho, o retângulo de toque não. */
export function panelHitArea(width: number, height: number): { x: number; y: number; width: number; height: number } {
  return { x: GLOW_PAD, y: GLOW_PAD, width, height };
}

/** Barra fina de preenchimento (vida do chefe, progresso): cantos redondos e degradê na cor pedida. */
export function hudBar(scene: Phaser.Scene, width: number, height: number, from: string, to: string): string {
  const key = `hud-bar:${width}x${height}:${from}:${to}`;
  const ctx = canvasTexture(scene, key, width, height);
  if (!ctx) return key;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, from);
  gradient.addColorStop(1, to);
  roundRectPath(ctx, 0, 0, width, height, height / 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  return finish(scene, key);
}
