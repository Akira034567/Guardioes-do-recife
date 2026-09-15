import { MASTERY_MAX_LEVEL } from "../../data/mastery";

/**
 * Progressão permanente do jogador (item 37). Nunca mistura com o estado de uma partida: o motor
 * (`core/match`) não conhece este documento, e este documento só recebe resultados no fim da partida.
 */
export const SAVE_VERSION = 5;

export type Stars = 0 | 1 | 2 | 3;

export interface LevelRecord {
  stars: Stars;
  /** Objetivos já cumpridos em qualquer tentativa (OR entre partidas; nunca regride). */
  objectives: boolean[];
  completions: number;
  best: { livesLost: number; durationMs: number; guardiansUsed: number; difficulty: string } | null;
  /**
   * Dificuldades em que esta fase já foi VENCIDA pelo menos uma vez. Nunca regride (item 4).
   *
   * Fica no registro da fase, e não numa lista global, porque é um fato SOBRE a fase: sanitiza com
   * o mesmo `registry.levelIds` e some junto quando a fase sai do catálogo.
   */
  clearedDifficulties: string[];
}

export interface PlayerSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedEffects: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  /** Reforça o contraste das telas de menu (bordas e fundos mais sólidos). */
  highContrast: boolean;
  uiScale: "small" | "normal" | "large";
}

export interface GuardianCareer {
  matches: number;
  kills: number;
  damage: number;
  placements: number;
  upgrades: number;
}

/** Teto de peças no Recife: vale na carga E em toda gravação, não só no plantio. */
export const MAX_PLACED_DECORATIONS = 160;

/** Uma decoração plantada no Recife. Coordenadas em % da área (0–100), como `data/regions.ts`. */
export interface PlacedDecoration {
  /** Id da instância, único no save. Sai de um contador (`d1`, `d2`, …), nunca de sorteio. */
  instanceId: string;
  /** Id do catálogo (`DecorationDefinition.id`). */
  defId: string;
  x: number;
  y: number;
  /** Graus, -180..180. */
  rotation: number;
  /** Multiplicador sobre o tamanho do catálogo. */
  scale: number;
  /** Espelha na horizontal: variedade visual sem arte nova. */
  flip: boolean;
  /** Slot do layout que ancorou a peça; null = posição livre (editor futuro). */
  slotId: string | null;
}

/**
 * O hub "Meu Recife". Guarda só o que NÃO dá para derivar do resto do progresso: o que o jogador
 * possui e onde está plantado. Quais peças estão LIBERADAS é sempre derivado (`core/reef/growth`),
 * para o save nunca discordar da regra.
 */
export interface ReefState {
  /** Decorações que o jogador possui (concedidas pelo crescimento hoje, compradas amanhã). */
  owned: string[];
  placed: PlacedDecoration[];
  nextInstanceId: number;
  /** Já concedidas automaticamente: impede reoferecer o que o jogador removeu de propósito. */
  granted: string[];
  /** Canteiros que o crescimento já preencheu uma vez. Esvaziar um é decisão do jogador. */
  servedSlots: string[];
  /** Último estágio que o jogador viu, para anunciar "o Recife cresceu" uma vez só. */
  lastSeenStage: number;
  /** Guardiões escolhidos para nadar no hub; vazio = todos os desbloqueados. */
  residents: string[];
}

/**
 * Um Recife vazio NOVO a cada chamada. Nunca exporte um objeto pronto para ser espalhado: um spread
 * raso compartilharia os arrays entre todos os perfis, e um save passaria a mexer no outro.
 */
export function emptyReef(): ReefState {
  return { owned: [], placed: [], nextInstanceId: 1, granted: [], servedSlots: [], lastSeenStage: 0, residents: [] };
}

export interface PlayerProgress {
  saveVersion: typeof SAVE_VERSION;
  profileId: string;
  createdAt: string;
  updatedAt: string;
  currency: { shells: number; lifetimeShells: number };
  unlockedGuardians: string[];
  completedLevels: string[];
  levelStars: Record<string, LevelRecord>;
  achievements: Record<string, { progress: number; unlockedAt: string | null; claimed: boolean }>;
  enemyDiscovery: Record<string, { firstSeenLevelId: string; seenAt: string; kills: number }>;
  storyProgress: { seen: string[] };
  tutorial: { completedSteps: string[]; done: boolean; skipped: boolean };
  settings: PlayerSettings;
  guardianStats: Record<string, GuardianCareer>;
  lastLoadout: string[];
  lastDifficulty: string;
  /**
   * Maestria permanente por Guardião: quantos nós (0 a 5) já foram comprados com Conchas. Só o nível
   * é gravado — o que cada nó faz vive em `data/mastery.ts`, então rebalancear a árvore não invalida
   * nenhum save. Guardião ausente = nível 0.
   */
  mastery: Record<string, number>;
  challenges: { completed: string[]; progress: Record<string, number>; lastSeenRotation: string | null };
  /** Segredos achados nos mapas e Encontros concluídos (desbloqueio narrativo dos Guardiões). */
  discoveredSecrets: string[];
  completedEncounters: string[];
  /** Guardiões desbloqueados ainda não apresentados ao jogador. */
  pendingUnlockReveals: string[];
  totals: { matches: number; victories: number; defeats: number; kills: number; playTimeMs: number; wavesCleared: number };
  /** Hub "Meu Recife": o que está plantado e quem mora lá. O crescimento em si é derivado. */
  reef: ReefState;
}

/** Ids válidos para descartar lixo de saves antigos ou de conteúdo removido. */
export interface SanitizeRegistry {
  levelIds: readonly string[];
  guardianIds: readonly string[];
  enemyIds: readonly string[];
  /** Guardiões liberados em um perfil novo. */
  defaultUnlockedGuardians: readonly string[];
  /** Ids do catálogo de decoração; ausente = sem filtro (testes e ferramentas headless). */
  decorationIds?: readonly string[];
  /** Ids de dificuldade válidos; ausente = sem filtro (testes e ferramentas headless). */
  difficultyIds?: readonly string[];
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  muted: false,
  reducedEffects: false,
  screenShake: true,
  damageNumbers: true,
  highContrast: false,
  uiScale: "normal",
};

export function createDefaultProgress(registry: SanitizeRegistry, now: Date): PlayerProgress {
  const stamp = now.toISOString();
  return {
    saveVersion: SAVE_VERSION,
    profileId: "local",
    createdAt: stamp,
    updatedAt: stamp,
    currency: { shells: 0, lifetimeShells: 0 },
    unlockedGuardians: [...registry.defaultUnlockedGuardians],
    completedLevels: [],
    levelStars: {},
    achievements: {},
    enemyDiscovery: {},
    storyProgress: { seen: [] },
    tutorial: { completedSteps: [], done: false, skipped: false },
    settings: { ...DEFAULT_SETTINGS },
    guardianStats: {},
    lastLoadout: [],
    lastDifficulty: "normal",
    mastery: {},
    challenges: { completed: [], progress: {}, lastSeenRotation: null },
    discoveredSecrets: [],
    completedEncounters: [],
    pendingUnlockReveals: [],
    totals: { matches: 0, victories: 0, defeats: 0, kills: 0, playTimeMs: 0, wavesCleared: 0 },
    // Perfil novo começa com o Recife vazio; `reconcileReef` planta na primeira visita ao hub.
    reef: emptyReef(),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const stringList = (value: unknown, allowed?: readonly string[]): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (allowed && !allowed.includes(item)) continue;
    unique.add(item);
  }
  return [...unique];
};
const finite = (value: unknown, fallback: number, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === "boolean" ? value : fallback);
const text = (value: unknown, fallback: string): string => (typeof value === "string" && value.length > 0 ? value : fallback);

function sanitizeLevelRecord(value: unknown, registry: SanitizeRegistry): LevelRecord | null {
  if (!isRecord(value)) return null;
  const objectives = Array.isArray(value.objectives) ? value.objectives.map((flag) => flag === true) : [];
  const stars = Math.max(0, Math.min(3, Math.floor(finite(value.stars, objectives.filter(Boolean).length)))) as Stars;
  const best = isRecord(value.best)
    ? {
        livesLost: finite(value.best.livesLost, 0, 0),
        durationMs: finite(value.best.durationMs, 0, 0),
        guardiansUsed: finite(value.best.guardiansUsed, 0, 0),
        difficulty: text(value.best.difficulty, "normal"),
      }
    : null;
  const clearedDifficulties = Array.isArray(value.clearedDifficulties)
    ? [...new Set(value.clearedDifficulties.filter((id): id is string => typeof id === "string" && (registry.difficultyIds?.includes(id) ?? true)))]
    : [];
  return { stars, objectives, completions: Math.floor(finite(value.completions, 0, 0)), best, clearedDifficulties };
}

/**
 * Funde um documento qualquer com os padrões, campo a campo: chaves desconhecidas somem, ids fora do
 * registro são descartados e tipos inválidos voltam ao padrão. Serve para saves antigos, corrompidos e
 * para versões futuras com campos a mais.
 */
export function sanitizeProgress(raw: unknown, registry: SanitizeRegistry, now: Date): PlayerProgress {
  const base = createDefaultProgress(registry, now);
  if (!isRecord(raw)) return base;
  const levelStars: Record<string, LevelRecord> = {};
  if (isRecord(raw.levelStars)) {
    for (const [levelId, record] of Object.entries(raw.levelStars)) {
      if (!registry.levelIds.includes(levelId)) continue;
      const clean = sanitizeLevelRecord(record, registry);
      if (clean) levelStars[levelId] = clean;
    }
  }
  const guardianStats: Record<string, GuardianCareer> = {};
  if (isRecord(raw.guardianStats)) {
    for (const [guardianId, career] of Object.entries(raw.guardianStats)) {
      if (!registry.guardianIds.includes(guardianId) || !isRecord(career)) continue;
      guardianStats[guardianId] = {
        matches: finite(career.matches, 0, 0),
        kills: finite(career.kills, 0, 0),
        damage: finite(career.damage, 0, 0),
        placements: finite(career.placements, 0, 0),
        upgrades: finite(career.upgrades, 0, 0),
      };
    }
  }
  const enemyDiscovery: PlayerProgress["enemyDiscovery"] = {};
  if (isRecord(raw.enemyDiscovery)) {
    for (const [enemyId, entry] of Object.entries(raw.enemyDiscovery)) {
      if (!registry.enemyIds.includes(enemyId) || !isRecord(entry)) continue;
      enemyDiscovery[enemyId] = {
        firstSeenLevelId: text(entry.firstSeenLevelId, ""),
        seenAt: text(entry.seenAt, base.createdAt),
        kills: finite(entry.kills, 0, 0),
      };
    }
  }
  const achievements: PlayerProgress["achievements"] = {};
  if (isRecord(raw.achievements)) {
    for (const [id, entry] of Object.entries(raw.achievements)) {
      if (!isRecord(entry)) continue;
      achievements[id] = {
        progress: finite(entry.progress, 0, 0),
        unlockedAt: typeof entry.unlockedAt === "string" ? entry.unlockedAt : null,
        claimed: bool(entry.claimed, false),
      };
    }
  }
  // Recife: instância com id repetido, `defId` fora do catálogo ou número inválido não entra.
  const rawReef = isRecord(raw.reef) ? raw.reef : {};
  const reefPlaced: PlacedDecoration[] = [];
  const seenInstances = new Set<string>();
  let maxInstance = 0;
  if (Array.isArray(rawReef.placed)) {
    for (const entry of rawReef.placed) {
      if (reefPlaced.length >= MAX_PLACED_DECORATIONS) break;
      if (!isRecord(entry)) continue;
      const defId = text(entry.defId, "");
      if (defId.length === 0) continue;
      if (registry.decorationIds && !registry.decorationIds.includes(defId)) continue;
      const instanceId = text(entry.instanceId, "");
      if (instanceId.length === 0 || seenInstances.has(instanceId)) continue;
      seenInstances.add(instanceId);
      const numeric = Number.parseInt(instanceId.replace(/\D+/g, ""), 10);
      if (Number.isFinite(numeric)) maxInstance = Math.max(maxInstance, numeric);
      reefPlaced.push({
        instanceId,
        defId,
        x: finite(entry.x, 50, 0, 100),
        y: finite(entry.y, 50, 0, 100),
        rotation: finite(entry.rotation, 0, -180, 180),
        scale: finite(entry.scale, 1, 0.25, 4),
        flip: bool(entry.flip, false),
        slotId: typeof entry.slotId === "string" && entry.slotId.length > 0 ? entry.slotId : null,
      });
    }
  }
  // Invariante que se conserta sozinha: o que está plantado sempre pertence ao jogador.
  const reefOwned = new Set([...stringList(rawReef.owned, registry.decorationIds), ...reefPlaced.map((item) => item.defId)]);

  // Maestria: só Guardiões do registro, nível inteiro entre 0 e o teto da árvore.
  const mastery: Record<string, number> = {};
  if (isRecord(raw.mastery)) {
    for (const [guardianId, level] of Object.entries(raw.mastery)) {
      if (!registry.guardianIds.includes(guardianId)) continue;
      const clean = Math.floor(finite(level, 0, 0, MASTERY_MAX_LEVEL));
      if (clean > 0) mastery[guardianId] = clean;
    }
  }

  const currency = isRecord(raw.currency) ? raw.currency : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const tutorial = isRecord(raw.tutorial) ? raw.tutorial : {};
  const challenges = isRecord(raw.challenges) ? raw.challenges : {};
  const totals = isRecord(raw.totals) ? raw.totals : {};
  const story = isRecord(raw.storyProgress) ? raw.storyProgress : {};
  const unlocked = new Set([...registry.defaultUnlockedGuardians, ...stringList(raw.unlockedGuardians, registry.guardianIds)]);
  return {
    saveVersion: SAVE_VERSION,
    profileId: text(raw.profileId, base.profileId),
    createdAt: text(raw.createdAt, base.createdAt),
    updatedAt: text(raw.updatedAt, base.updatedAt),
    currency: {
      shells: Math.floor(finite(currency.shells, 0, 0)),
      lifetimeShells: Math.floor(finite(currency.lifetimeShells, finite(currency.shells, 0, 0), 0)),
    },
    unlockedGuardians: [...unlocked],
    completedLevels: stringList(raw.completedLevels, registry.levelIds),
    levelStars,
    achievements,
    enemyDiscovery,
    storyProgress: { seen: stringList(story.seen) },
    tutorial: {
      completedSteps: stringList(tutorial.completedSteps),
      done: bool(tutorial.done, false),
      skipped: bool(tutorial.skipped, false),
    },
    settings: {
      masterVolume: finite(settings.masterVolume, DEFAULT_SETTINGS.masterVolume, 0, 1),
      musicVolume: finite(settings.musicVolume, DEFAULT_SETTINGS.musicVolume, 0, 1),
      sfxVolume: finite(settings.sfxVolume, DEFAULT_SETTINGS.sfxVolume, 0, 1),
      muted: bool(settings.muted, DEFAULT_SETTINGS.muted),
      reducedEffects: bool(settings.reducedEffects, DEFAULT_SETTINGS.reducedEffects),
      screenShake: bool(settings.screenShake, DEFAULT_SETTINGS.screenShake),
      damageNumbers: bool(settings.damageNumbers, DEFAULT_SETTINGS.damageNumbers),
      highContrast: bool(settings.highContrast, DEFAULT_SETTINGS.highContrast),
      uiScale: settings.uiScale === "small" || settings.uiScale === "large" ? settings.uiScale : "normal",
    },
    guardianStats,
    lastLoadout: stringList(raw.lastLoadout, registry.guardianIds),
    lastDifficulty: text(raw.lastDifficulty, base.lastDifficulty),
    mastery,
    challenges: {
      completed: stringList(challenges.completed),
      progress: isRecord(challenges.progress)
        ? Object.fromEntries(Object.entries(challenges.progress).map(([id, value]) => [id, finite(value, 0, 0)]))
        : {},
      lastSeenRotation: typeof challenges.lastSeenRotation === "string" ? challenges.lastSeenRotation : null,
    },
    discoveredSecrets: stringList(raw.discoveredSecrets),
    completedEncounters: stringList(raw.completedEncounters),
    pendingUnlockReveals: stringList(raw.pendingUnlockReveals, registry.guardianIds),
    reef: {
      owned: [...reefOwned],
      placed: reefPlaced,
      // Um save editado à mão não pode gerar colisão de id: o contador sobe acima do que existe.
      nextInstanceId: Math.max(Math.floor(finite(rawReef.nextInstanceId, 1, 1)), maxInstance + 1),
      granted: stringList(rawReef.granted, registry.decorationIds),
      // Ids de canteiro são internos (não vêm do jogador), então basta limitar a quantidade.
      servedSlots: stringList(rawReef.servedSlots).slice(0, MAX_PLACED_DECORATIONS),
      lastSeenStage: Math.floor(finite(rawReef.lastSeenStage, 0, 0, 9)),
      residents: stringList(rawReef.residents, registry.guardianIds),
    },
    totals: {
      matches: finite(totals.matches, 0, 0),
      victories: finite(totals.victories, 0, 0),
      defeats: finite(totals.defeats, 0, 0),
      kills: finite(totals.kills, 0, 0),
      playTimeMs: finite(totals.playTimeMs, 0, 0),
      wavesCleared: finite(totals.wavesCleared, 0, 0),
    },
  };
}
