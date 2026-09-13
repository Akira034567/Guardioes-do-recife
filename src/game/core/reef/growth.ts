import { DECORATIONS, type DecorationDefinition } from "../../data/reef/decorations";
import { REEF_LANDMARKS, REEF_SLOTS, type ReefLandmarkId } from "../../data/reef/layout";
import { DEFAULT_UNLOCKED_GUARDIANS } from "../../data/unlocks";
import { isSatisfied } from "../progression/unlocks";
import { totalStars } from "../progression/stars";
import type { PlayerProgress } from "../save/PlayerProgress";

/**
 * O quanto o Recife cresceu. Tudo aqui é DERIVADO do progresso do jogador — nada disso vai para o
 * save, para a regra e o save nunca discordarem.
 *
 * O crescimento é de propósito graduado em três ritmos diferentes, e é isso que faz o Recife parecer
 * vivo em vez de trocar de cenário:
 *
 * 1. `activeSlots` é fino e contínuo: um canteiro novo a cada `SLOT_STEP` pontos. Cumprir um objetivo
 *    já costuma abrir um — o jogador vê UM coral novo.
 * 2. `unlockedDecorationIds` é por evento: cada peça tem a própria condição, então O QUE aparece está
 *    preso a O QUE o jogador fez. A variedade chega como narrativa, não como tabela de níveis.
 * 3. `vitality` é liso, 0..1, sem nenhum degrau: densidade de partículas, cardumes e luz. Mesmo sem
 *    decoração nova, o Recife fica mensuravelmente mais vivo depois de uma partida.
 *
 * `stage` fica reservado só ao que precisa ser grosso mesmo: a paleta da água e quais lugares já
 * existem. Existe UMA cena, construída uma vez, que lê isto e acrescenta — nada é derrubado e
 * reconstruído.
 */

export type ReefStage = 0 | 1 | 2 | 3 | 4 | 5;

export const MAX_REEF_STAGE: ReefStage = 5;

/** Peso de cada sinal. Vários somando impedem o Recife de depender de uma coisa só. */
export const REEF_WEIGHTS = {
  star: 3,
  level: 4,
  guardian: 5,
  encounter: 8,
  secret: 2,
  achievement: 2,
  story: 1,
} as const;

/**
 * Pontuação mínima de cada estágio; o índice é o estágio. O teto do conteúdo de hoje é 171 pontos
 * (54 de estrelas + 24 de fases + 20 de Guardiões encontrados + 32 de Encontros + 2 de segredo +
 * 32 de conquistas + 7 de histórias), então o último estágio precisa caber abaixo disso — senão ele
 * vira conteúdo que ninguém alcança. `tests/reef-growth.test.ts` cobra esse limite.
 */
export const REEF_THRESHOLDS: readonly number[] = [0, 18, 42, 72, 108, 150];

/** Um canteiro novo a cada seis pontos: o Recife ganha peça de duas em duas estrelas. */
export const SLOT_STEP = 6;

export function reefScore(progress: PlayerProgress): number {
  const achievements = Object.values(progress.achievements).filter((entry) => entry.unlockedAt !== null).length;
  // Os fundadores são o ponto de partida, não uma conquista: só quem foi ENCONTRADO faz o Recife crescer.
  const found = Math.max(0, progress.unlockedGuardians.length - DEFAULT_UNLOCKED_GUARDIANS.length);
  return (
    totalStars(progress.levelStars) * REEF_WEIGHTS.star +
    progress.completedLevels.length * REEF_WEIGHTS.level +
    found * REEF_WEIGHTS.guardian +
    progress.completedEncounters.length * REEF_WEIGHTS.encounter +
    progress.discoveredSecrets.length * REEF_WEIGHTS.secret +
    achievements * REEF_WEIGHTS.achievement +
    progress.storyProgress.seen.length * REEF_WEIGHTS.story
  );
}

export function reefStage(progress: PlayerProgress): ReefStage {
  const score = reefScore(progress);
  let stage: ReefStage = 0;
  for (let index = 0; index < REEF_THRESHOLDS.length; index += 1) {
    if (score >= REEF_THRESHOLDS[index]) stage = index as ReefStage;
  }
  return stage;
}

/** A peça está liberada quando UMA das condições dela se satisfaz. Compra nunca conta sozinha. */
export function isDecorationUnlocked(definition: DecorationDefinition, progress: PlayerProgress): boolean {
  return definition.unlock.some((condition) => isSatisfied(condition, progress));
}

export interface ReefGrowth {
  stage: ReefStage;
  score: number;
  /** 0..1 dentro do estágio atual: cresce todo dia, não só na virada. */
  stageProgress: number;
  /** Pontuação do próximo estágio; null no último. */
  nextStageAt: number | null;
  unlockedDecorationIds: string[];
  activeSlots: string[];
  activeLandmarks: ReefLandmarkId[];
  /** 0..1 contínuo: o quanto o ambiente respira (partículas, cardumes, luz, saturação). */
  vitality: number;
}

export function reefGrowth(progress: PlayerProgress): ReefGrowth {
  const score = reefScore(progress);
  const stage = reefStage(progress);
  const floor = REEF_THRESHOLDS[stage];
  const nextStageAt = stage >= MAX_REEF_STAGE ? null : REEF_THRESHOLDS[stage + 1];
  const stageProgress = nextStageAt === null ? 1 : clamp01((score - floor) / (nextStageAt - floor));
  const openOrders = Math.floor(score / SLOT_STEP);
  return {
    stage,
    score,
    stageProgress,
    nextStageAt,
    unlockedDecorationIds: DECORATIONS.filter((definition) => isDecorationUnlocked(definition, progress)).map((definition) => definition.id),
    activeSlots: REEF_SLOTS.filter((slot) => slot.order <= openOrders).map((slot) => slot.id),
    activeLandmarks: REEF_LANDMARKS.filter((landmark) => stage >= landmark.minStage).map((landmark) => landmark.id),
    vitality: clamp01(score / REEF_THRESHOLDS[MAX_REEF_STAGE]),
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}
