import type Phaser from "phaser";
import type { BranchId, GuardianId } from "../types";

/**
 * Arte dos Guardiões recortada das tabelas de upgrade (`public/assets/guardians/<id>/<variante>/`).
 *
 * Cada Guardião tem cinco variantes visuais: `base` e uma por upgrade de cada ramo. Cada variante tem
 * cinco imagens: `idle`, `attack`, `projectile` (a coluna "Habilidade" da tabela), `impact` e `portrait`.
 * As imagens de um mesmo Guardião preservam a posição e a proporção da célula da tabela, então uma única
 * escala por Guardião mantém o tamanho relativo entre variantes (a base pequena cresce com os upgrades).
 */
export type ArtKind = "idle" | "attack" | "projectile" | "impact" | "portrait";
export const ART_KINDS: readonly ArtKind[] = ["idle", "attack", "projectile", "impact", "portrait"];

/** Como a imagem `projectile` (a "Habilidade") é exibida quando o Guardião ataca. */
export type AbilityStyle =
  | "projectile" // projétil físico que voa até o alvo (Camarão)
  | "beam" // esticada do Guardião até o alvo (raio, jato, tentáculo)
  | "burst" // surge sobre o alvo e some
  | "ring"; // surge centrada no Guardião, do tamanho do alcance (pulso, giro, aura)

export interface ArtVariant {
  /** Nome da pasta em `public/assets/guardians/<id>/`. */
  folder: string;
  ability: AbilityStyle;
}

export interface GuardianArtProfile {
  /** Escala aplicada a idle/attack no mundo. As tabelas têm células de ~165px; 0.72 dá criaturas de 50 a 80px. */
  scale: number;
  /** Escala do projétil físico ou dos efeitos `burst`. */
  effectScale: number;
  base: ArtVariant;
  branches: Record<BranchId, [ArtVariant, ArtVariant]>;
}

export const GUARDIAN_ART: Record<GuardianId, GuardianArtProfile> = {
  "pistol-shrimp": {
    scale: 0.72,
    effectScale: 0.4,
    base: { folder: "base", ability: "projectile" },
    branches: {
      a: [
        { folder: "perfuracao-1", ability: "projectile" },
        { folder: "perfuracao-2", ability: "projectile" },
      ],
      b: [
        { folder: "impacto-1", ability: "projectile" },
        { folder: "impacto-2", ability: "projectile" },
      ],
    },
  },
  jellyfish: {
    scale: 0.72,
    effectScale: 0.55,
    base: { folder: "base", ability: "beam" },
    branches: {
      a: [
        { folder: "eletrico-1", ability: "beam" },
        // O anel elétrico vira o desenho do Campo Elétrico; a descarga usa o raio do nível anterior.
        { folder: "eletrico-2", ability: "ring" },
      ],
      b: [
        { folder: "controle-1", ability: "beam" },
        { folder: "controle-2", ability: "burst" },
      ],
    },
  },
  pufferfish: {
    scale: 0.72,
    effectScale: 0.55,
    base: { folder: "base", ability: "ring" },
    branches: {
      a: [
        { folder: "perfuracao-1", ability: "ring" },
        { folder: "perfuracao-2", ability: "ring" },
      ],
      b: [
        { folder: "pulso-1", ability: "ring" },
        { folder: "pulso-2", ability: "ring" },
      ],
    },
  },
  "reef-crab": {
    scale: 0.72,
    effectScale: 0.55,
    base: { folder: "base", ability: "burst" },
    branches: {
      a: [
        { folder: "quebra-casco-1", ability: "burst" },
        { folder: "quebra-casco-2", ability: "burst" },
      ],
      b: [
        { folder: "area-1", ability: "ring" },
        { folder: "area-2", ability: "ring" },
      ],
    },
  },
  "ink-octopus": {
    scale: 0.72,
    effectScale: 0.55,
    base: { folder: "base", ability: "beam" },
    branches: {
      a: [
        { folder: "debuff-1", ability: "beam" },
        // O redemoinho de tinta vira o desenho da Nuvem de Tinta; o jato usa o nível anterior.
        { folder: "debuff-2", ability: "ring" },
      ],
      b: [
        { folder: "buff-1", ability: "ring" },
        { folder: "buff-2", ability: "ring" },
      ],
    },
  },
};

export interface ArtProgress {
  branchId: BranchId | null;
  upgradeLevel: number;
}

/** Variante visual para um estado de upgrade: `base` até o primeiro upgrade, depois a do ramo/nível. */
export function artVariant(guardianId: GuardianId, progress: ArtProgress): ArtVariant {
  const profile = GUARDIAN_ART[guardianId];
  if (!progress.branchId || progress.upgradeLevel <= 0) return profile.base;
  const steps = profile.branches[progress.branchId];
  return steps[Math.min(steps.length, Math.floor(progress.upgradeLevel)) - 1];
}

/** Variante do passo anterior (para efeitos que reaproveitam o desenho do nível de baixo). */
export function previousArtVariant(guardianId: GuardianId, progress: ArtProgress): ArtVariant {
  return artVariant(guardianId, { branchId: progress.branchId, upgradeLevel: progress.upgradeLevel - 1 });
}

export function artTextureKey(guardianId: GuardianId, variant: ArtVariant, kind: ArtKind): string {
  return `${guardianId}-${variant.folder}-${kind}`;
}

/** Chave a partir do nome da pasta da variante (o HUD recebe só a pasta no snapshot). */
export function artTextureKeyForFolder(guardianId: GuardianId, folder: string, kind: ArtKind): string {
  return `${guardianId}-${folder}-${kind}`;
}

export function artTextureFor(guardianId: GuardianId, progress: ArtProgress, kind: ArtKind): string {
  return artTextureKey(guardianId, artVariant(guardianId, progress), kind);
}

export function artPath(guardianId: GuardianId, variant: ArtVariant, kind: ArtKind): string {
  return `assets/guardians/${guardianId}/${variant.folder}/${kind}.png`;
}

export function allArtVariants(guardianId: GuardianId): ArtVariant[] {
  const profile = GUARDIAN_ART[guardianId];
  return [profile.base, ...profile.branches.a, ...profile.branches.b];
}

/** Todas as imagens registradas: uma entrada por Guardião × variante × tipo. */
export const GUARDIAN_ART_ASSETS: ReadonlyArray<{ key: string; path: string }> = (
  Object.keys(GUARDIAN_ART) as GuardianId[]
).flatMap((guardianId) =>
  allArtVariants(guardianId).flatMap((variant) =>
    ART_KINDS.map((kind) => ({ key: artTextureKey(guardianId, variant, kind), path: artPath(guardianId, variant, kind) })),
  ),
);

export function preloadGuardianArt(scene: Phaser.Scene): void {
  GUARDIAN_ART_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
}

/** A arte está disponível quando ao menos o idle da base carregou. */
export function hasGuardianArt(scene: Phaser.Scene, guardianId: GuardianId): boolean {
  return scene.textures.exists(artTextureKey(guardianId, GUARDIAN_ART[guardianId].base, "idle"));
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const boundsCache = new Map<string, PixelBounds>();

/**
 * Retângulo dos pixels visíveis (alpha > 50%) de uma textura, em pixels da imagem. As imagens das células
 * têm bastante área transparente em volta da criatura; isso permite enquadrar ícones e cards.
 * Imagem vazia ou sem canvas 2D: devolve o quadro inteiro.
 */
export function solidBounds(scene: Phaser.Scene, key: string): PixelBounds | null {
  const cached = boundsCache.get(key);
  if (cached) return cached;
  if (!scene.textures.exists(key)) return null;
  const frame = scene.textures.getFrame(key);
  const full: PixelBounds = { x: 0, y: 0, width: frame.width, height: frame.height };
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  if (!context) return full;
  context.drawImage(
    frame.source.image as CanvasImageSource,
    frame.cutX,
    frame.cutY,
    frame.width,
    frame.height,
    0,
    0,
    frame.width,
    frame.height,
  );
  const data = context.getImageData(0, 0, frame.width, frame.height).data;
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      if (data[(y * frame.width + x) * 4 + 3] > 128) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bounds = maxX < 0 ? full : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  boundsCache.set(key, bounds);
  return bounds;
}
