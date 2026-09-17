import type Phaser from "phaser";
import type { BranchId, GuardianId } from "../types";

/**
 * Arte dos Guardiões por forma (`public/assets/guardians/<pasta>/<variante>/`).
 *
 * Cada Guardião tem cinco variantes visuais: `base` e uma por upgrade de cada ramo. Cada variante tem
 * até cinco imagens: `idle`, `attack`, `projectile` (a coluna "Habilidade" da tabela), `impact` e `portrait`.
 * As imagens de um mesmo Guardião preservam a posição e a proporção da célula da tabela, então uma única
 * escala por Guardião mantém o tamanho relativo entre variantes (a base pequena cresce com os upgrades).
 *
 * As formas são persistentes: a imagem só troca quando o jogador compra o upgrade; o idle nunca alterna
 * entre variantes.
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
  /** Nome da pasta em `public/assets/guardians/<pasta do Guardião>/`. */
  folder: string;
  ability: AbilityStyle;
  /**
   * A Habilidade desta variante usa o desenho do Impacto.
   *
   * É o caso do Caçador da Corrente: a prancha dele traz uma mira como "habilidade" e uma explosão de
   * espinhos como "impacto", e as duas saem no mesmo instante — a mira em cima da explosão virava
   * sujeira. Uma imagem só diz a mesma coisa com metade do ruído.
   */
  abilityFromImpact?: boolean;
  /**
   * A arte de Habilidade e de Impacto fica RESERVADA para a habilidade periódica: o golpe básico não
   * desenha nenhuma das duas, só o tranco vetorial.
   *
   * É o caso da Tartaruga no ramo Correnteza. O golpe dela sai a cada 1,5s e a habilidade — a onda que
   * empurra a fila — a cada 9s; com a mesma arte nos dois, o anel piscava o tempo todo e o momento que
   * importava sumia no meio. Agora a imagem só aparece quando a onda acontece de verdade.
   */
  artOnlyOnAbility?: boolean;
}

export interface GuardianArtProfile {
  /** Escala aplicada a idle/attack no mundo. As tabelas têm células de ~165px; 0.72 dá criaturas de 50 a 80px. */
  scale: number;
  /** Escala do projétil físico ou dos efeitos `burst`. */
  effectScale: number;
  base: ArtVariant;
  branches: Record<BranchId, [ArtVariant, ArtVariant]>;
  /** Pasta do Guardião em `public/assets/guardians/` (padrão: o próprio id). */
  assetFolder?: string;
  /** Nome do arquivo da coluna "Habilidade" (padrão `projectile`; os novos usam `ability`). */
  abilityFile?: string;
  /**
   * Troca os papéis de "Habilidade" e "Impacto". O Golfinho veio com as duas colunas invertidas na
   * prancha: o que estava como impacto é o pulso, e o que estava como habilidade é o respingo no alvo.
   */
  swapAbilityAndImpact?: boolean;
  /** `false` quando a variante não tem `portrait.png` (o card do HUD fica oculto). */
  hasPortrait?: boolean;
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
  // Novos Guardiões: pastas exatamente como na especificação; arquivos idle/attack/ability/impact/portrait
  // (recortes de `scripts/slice-neon-sheet.py`).
  // Tubarão e Tartaruga são corpo a corpo: nada aqui vira projétil. A "Habilidade" deles é exibida como
  // `ring` (centrada no Guardião) ou `burst` (no ponto do golpe), nunca voando até o alvo.
  shark: {
    scale: 0.72,
    effectScale: 0.55,
    assetFolder: "tubarao",
    abilityFile: "ability",
    // O redemoinho da base gira sob o Tubarão; os rastros do Frenesi e a mira do Alfa surgem no alvo.
    base: { folder: "base", ability: "ring" },
    branches: {
      a: [
        { folder: "frenesi_1", ability: "burst" },
        { folder: "frenesi_2", ability: "burst" },
      ],
      b: [
        { folder: "alfa_1", ability: "burst" },
        { folder: "alfa_2", ability: "burst" },
      ],
    },
  },
  "sea-turtle": {
    scale: 0.72,
    effectScale: 0.55,
    assetFolder: "tartaruga",
    abilityFile: "ability",
    // Todas as habilidades da Tartaruga são anéis de água em volta dela (a base já mostra a tartaruga no
    // meio do anel), então nenhuma variante usa `burst` no alvo.
    base: { folder: "base", ability: "ring" },
    branches: {
      a: [
        { folder: "casco_1", ability: "ring" },
        { folder: "casco_2", ability: "ring" },
      ],
      b: [
        { folder: "corrente_1", ability: "ring", artOnlyOnAbility: true },
        { folder: "corrente_2", ability: "ring", artOnlyOnAbility: true },
      ],
    },
  },
  stonefish: {
    // Menor que os outros: ele mora na BORDA da correnteza e não pode competir com a rota. A 0,72 o
    // monte de pedra cobria a faixa que ele deveria estar só espreitando.
    scale: 0.62,
    effectScale: 0.55,
    assetFolder: "peixe_pedra",
    abilityFile: "ability",
    // `attack` = espinhos abertos; `ability`/`impact` = o bote. O repouso não usa `idle`: quem está
    // camuflado ou recarregando vira a pedra de `STONEFISH_HIDDEN_KEY`.
    base: { folder: "base", ability: "ring" },
    branches: {
      a: [
        { folder: "veneno_1", ability: "ring" },
        { folder: "veneno_2", ability: "ring" },
      ],
      b: [
        { folder: "emboscada_1", ability: "ring" },
        { folder: "emboscada_2", ability: "ring", abilityFromImpact: true },
      ],
    },
  },
  dolphin: {
    scale: 0.72,
    effectScale: 0.55,
    assetFolder: "golfinho",
    abilityFile: "ability",
    swapAbilityAndImpact: true,
    base: { folder: "base", ability: "ring" },
    branches: {
      a: [
        { folder: "coro_1", ability: "ring" },
        { folder: "coro_2", ability: "ring" },
      ],
      b: [
        { folder: "sonar_1", ability: "ring" },
        { folder: "sonar_2", ability: "ring" },
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

/** Pasta do Guardião em `public/assets/guardians/`. */
export function artFolder(guardianId: GuardianId): string {
  return GUARDIAN_ART[guardianId].assetFolder ?? guardianId;
}

/** Nome do arquivo (sem extensão) de um tipo de imagem para este Guardião. */
export function artFileName(guardianId: GuardianId, kind: ArtKind): string {
  const profile = GUARDIAN_ART[guardianId];
  const abilityFile = profile.abilityFile ?? "projectile";
  // A troca vale para os DOIS lados de uma vez: senão as duas chaves apontariam para o mesmo arquivo.
  if (profile.swapAbilityAndImpact) {
    if (kind === "projectile") return "impact";
    if (kind === "impact") return abilityFile;
  }
  if (kind === "projectile") return abilityFile;
  return kind;
}

/** Tipos de imagem que este Guardião possui. */
export function artKindsFor(guardianId: GuardianId): ArtKind[] {
  const profile = GUARDIAN_ART[guardianId];
  return ART_KINDS.filter((kind) => kind !== "portrait" || profile.hasPortrait !== false);
}

export function artPath(guardianId: GuardianId, variant: ArtVariant, kind: ArtKind): string {
  return `assets/guardians/${artFolder(guardianId)}/${variant.folder}/${artFileName(guardianId, kind)}.png`;
}

/**
 * A pedra em que o Peixe-Pedra se transforma enquanto está camuflado ou se recuperando do bote.
 *
 * É UMA imagem para as cinco variantes, e é o ponto: camuflado, ele não deve parecer um Peixe-Pedra
 * evoluído nem um Peixe-Pedra base — deve parecer pedra. Antes disso o jogo mostrava o peixe
 * translúcido, que dizia "ele sumiu" com a silhueta de um peixe ainda na tela.
 */
export const STONEFISH_HIDDEN_KEY = "stonefish-oculto";
export const STONEFISH_HIDDEN_PATH = "assets/guardians/peixe_pedra/oculto.png";

export function allArtVariants(guardianId: GuardianId): ArtVariant[] {
  const profile = GUARDIAN_ART[guardianId];
  return [profile.base, ...profile.branches.a, ...profile.branches.b];
}

/** Todas as imagens registradas: uma entrada por Guardião × variante × tipo. */
export const GUARDIAN_ART_ASSETS: ReadonlyArray<{ key: string; path: string; guardianId: GuardianId }> = (
  Object.keys(GUARDIAN_ART) as GuardianId[]
).flatMap((guardianId) =>
  allArtVariants(guardianId).flatMap((variant) =>
    artKindsFor(guardianId).map((kind) => ({ key: artTextureKey(guardianId, variant, kind), path: artPath(guardianId, variant, kind), guardianId })),
  ),
);

export function preloadGuardianArt(scene: Phaser.Scene): void {
  GUARDIAN_ART_ASSETS.forEach(({ key, path }) => scene.load.image(key, path));
  if (!scene.textures.exists(STONEFISH_HIDDEN_KEY)) scene.load.image(STONEFISH_HIDDEN_KEY, STONEFISH_HIDDEN_PATH);
}

/**
 * Só as formas base dos nove Guardiões (item 45). É o que o menu, as cartas e o fantasma de
 * posicionamento precisam; as formas evoluídas entram quando a fase abre, pelo esquadrão escolhido.
 */
export const GUARDIAN_BASE_ART_ASSETS: ReadonlyArray<{ key: string; path: string; guardianId: GuardianId }> = [
  ...GUARDIAN_ART_ASSETS.filter(({ guardianId, key }) => key.startsWith(`${guardianId}-${GUARDIAN_ART[guardianId].base.folder}-`)),
  // A pedra do Peixe-Pedra entra no boot e não na dieta por esquadrão: ela é o REPOUSO das cinco
  // variantes, então já faz falta na forma base. São 14 KB — não é ela que pesa na abertura.
  { key: STONEFISH_HIDDEN_KEY, path: STONEFISH_HIDDEN_PATH, guardianId: "stonefish" as GuardianId },
];

/** Imagens das variantes evoluídas de um esquadrão: o que falta depois da dieta do boot. */
export function guardianUpgradeArtAssets(guardianIds: readonly GuardianId[]): ReadonlyArray<{ key: string; path: string }> {
  const wanted = new Set(guardianIds);
  const baseKeys = new Set(GUARDIAN_BASE_ART_ASSETS.map((asset) => asset.key));
  return GUARDIAN_ART_ASSETS.filter((asset) => wanted.has(asset.guardianId) && !baseKeys.has(asset.key));
}

/** Carrega as formas evoluídas do esquadrão desta partida. */
export function preloadGuardianUpgradeArt(scene: Phaser.Scene, guardianIds: readonly GuardianId[]): void {
  guardianUpgradeArtAssets(guardianIds).forEach(({ key, path }) => {
    if (!scene.textures.exists(key)) scene.load.image(key, path);
  });
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

/**
 * Encaixa a arte de uma criatura numa caixa: `solidBounds` acha os pixels visíveis e o recorte mantém
 * o quadro inteiro, então o deslocamento centraliza só a parte que aparece. As células das tabelas de
 * arte têm bastante área transparente em volta; sem isto, Guardiões diferentes saem com tamanhos
 * visuais incoerentes. Usado pelo HUD da partida e pelo hub.
 */
export function fitImageToBox(
  scene: Phaser.Scene,
  image: Phaser.GameObjects.Image,
  key: string,
  centerX: number,
  centerY: number,
  boxWidth: number,
  boxHeight: number,
): void {
  const bounds = solidBounds(scene, key);
  const frame = scene.textures.getFrame(key);
  const scale = bounds ? Math.min(boxWidth / bounds.width, boxHeight / bounds.height) : Math.min(boxWidth / frame.width, boxHeight / frame.height);
  const offsetX = bounds ? (bounds.x + bounds.width / 2 - frame.width / 2) * scale : 0;
  const offsetY = bounds ? (bounds.y + bounds.height / 2 - frame.height / 2) * scale : 0;
  image.setTexture(key);
  if (bounds) image.setCrop(bounds.x, bounds.y, bounds.width, bounds.height);
  else image.setCrop();
  image.setScale(scale).setPosition(centerX - offsetX, centerY - offsetY);
}
