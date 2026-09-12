/**
 * Progressão permanente do jogador (item 37). Nunca mistura com o estado de uma partida: o motor
 * (`core/match`) não conhece este documento, e este documento só recebe resultados no fim da partida.
 */
export const SAVE_VERSION = 2;

export type Stars = 0 | 1 | 2 | 3;

export interface LevelRecord {
  stars: Stars;
  /** Objetivos já cumpridos em qualquer tentativa (OR entre partidas; nunca regride). */
  objectives: boolean[];
  completions: number;
  best: { livesLost: number; durationMs: number; guardiansUsed: number; difficulty: string } | null;
}

export interface PlayerSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  reducedEffects: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  uiScale: "small" | "normal" | "large";
}

export interface GuardianCareer {
  matches: number;
  kills: number;
  damage: number;
  placements: number;
  upgrades: number;
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
  challenges: { completed: string[]; progress: Record<string, number>; lastSeenRotation: string | null };
  /** Segredos achados nos mapas e Encontros concluídos (desbloqueio narrativo dos Guardiões). */
  discoveredSecrets: string[];
  completedEncounters: string[];
  /** Guardiões desbloqueados ainda não apresentados ao jogador. */
  pendingUnlockReveals: string[];
  totals: { matches: number; victories: number; defeats: number; kills: number; playTimeMs: number; wavesCleared: number };
}

/** Ids válidos para descartar lixo de saves antigos ou de conteúdo removido. */
export interface SanitizeRegistry {
  levelIds: readonly string[];
  guardianIds: readonly string[];
  enemyIds: readonly string[];
  /** Guardiões liberados em um perfil novo. */
  defaultUnlockedGuardians: readonly string[];
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  masterVolume: 1,
  musicVolume: 0.8,
  sfxVolume: 1,
  muted: false,
  reducedEffects: false,
  screenShake: true,
  damageNumbers: true,
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
    challenges: { completed: [], progress: {}, lastSeenRotation: null },
    discoveredSecrets: [],
    completedEncounters: [],
    pendingUnlockReveals: [],
    totals: { matches: 0, victories: 0, defeats: 0, kills: 0, playTimeMs: 0, wavesCleared: 0 },
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

function sanitizeLevelRecord(value: unknown): LevelRecord | null {
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
  return { stars, objectives, completions: Math.floor(finite(value.completions, 0, 0)), best };
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
      const clean = sanitizeLevelRecord(record);
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
      uiScale: settings.uiScale === "small" || settings.uiScale === "large" ? settings.uiScale : "normal",
    },
    guardianStats,
    lastLoadout: stringList(raw.lastLoadout, registry.guardianIds),
    lastDifficulty: text(raw.lastDifficulty, base.lastDifficulty),
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
