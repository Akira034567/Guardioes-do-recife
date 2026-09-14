import { DECORATIONS, type DecorationDefinition } from "../../data/reef/decorations";
import { REEF_SLOTS, type ReefSlot } from "../../data/reef/layout";
import { createRng, hashSeed } from "../Rng";
import { MAX_PLACED_DECORATIONS, type PlacedDecoration, type PlayerProgress } from "../save/PlayerProgress";
import { reefGrowth, type ReefStage } from "./growth";

/**
 * Planta o que o crescimento liberou. Muta `progress.reef` no lugar, como `reconcileUnlocks` faz com
 * os Guardiões: só acrescenta, nunca tira.
 *
 * A semente de cada peça sai de `hashSeed(profileId, slot.id)` — POR CANTEIRO, não por chamada. O
 * mesmo canteiro sempre rende a mesma peça, a mesma inclinação, o mesmo espelho e o mesmo tamanho,
 * em qualquer sessão. É o que faz o Recife parecer SEU: um hub que se rearranja a cada visita deixa
 * de ser um lugar e vira um protetor de tela. Semear pelo índice do array em vez de pelo id quebraria
 * isso em silêncio no dia em que um canteiro fosse inserido no meio da lista.
 */

export interface PlantingOptions {
  catalog?: readonly DecorationDefinition[];
  slots?: readonly ReefSlot[];
  /** Semente estável; o padrão é o `profileId` do save. */
  seed?: string;
}

export interface PlantingResult {
  planted: readonly PlacedDecoration[];
  granted: readonly string[];
  /** Estágio novo quando o Recife subiu desde a última visita; null quando não subiu. */
  stageUp: ReefStage | null;
}

/** Inclinação e tamanho variam um pouco para o canteiro não parecer um catálogo. */
const ROTATION_JITTER = 12;
export const SCALE_JITTER = 0.15;

export function reconcileReef(progress: PlayerProgress, options: PlantingOptions = {}): PlantingResult {
  const catalog = options.catalog ?? DECORATIONS;
  const slots = options.slots ?? REEF_SLOTS;
  const seed = options.seed ?? progress.profileId;
  const growth = reefGrowth(progress);
  const reef = progress.reef;

  const unlocked = new Set(growth.unlockedDecorationIds);
  const owned = new Set(reef.owned);
  const granted = new Set(reef.granted);
  const occupied = new Set(reef.placed.map((item) => item.slotId).filter((id): id is string => id !== null));
  const served = new Set(reef.servedSlots);
  const counts = new Map<string, number>();
  for (const item of reef.placed) counts.set(item.defId, (counts.get(item.defId) ?? 0) + 1);

  reanchor(reef.placed, slots);

  const planted: PlacedDecoration[] = [];
  const newlyGranted: string[] = [];

  for (const slotId of growth.activeSlots) {
    if (reef.placed.length >= MAX_PLACED_DECORATIONS) break;
    if (occupied.has(slotId)) continue;
    // Um canteiro só é preenchido automaticamente UMA vez. Se o jogador esvaziou, o espaço é dele.
    if (served.has(slotId)) continue;
    const slot = slots.find((candidate) => candidate.id === slotId);
    if (!slot) continue;

    const candidates = catalog.filter((definition) => {
      if (!definition.slots.includes(slot.kind)) return false;
      if (!unlocked.has(definition.id)) return false;
      // Peça de loja só entra no Recife depois de comprada.
      if (definition.cost > 0 && !owned.has(definition.id)) return false;
      return (counts.get(definition.id) ?? 0) < definition.maxCount;
    });
    if (candidates.length === 0) continue;

    const rng = createRng(hashSeed(seed, slot.id));
    const definition = candidates[rng.int(candidates.length)];
    const decorationPlaced: PlacedDecoration = {
      instanceId: `d${reef.nextInstanceId}`,
      defId: definition.id,
      x: slot.at.x,
      y: slot.at.y,
      rotation: Math.round((rng.next() * 2 - 1) * ROTATION_JITTER),
      scale: Number((slot.scale * (1 + (rng.next() * 2 - 1) * SCALE_JITTER)).toFixed(3)),
      flip: rng.next() < 0.5,
      slotId: slot.id,
    };
    reef.nextInstanceId += 1;
    reef.placed.push(decorationPlaced);
    planted.push(decorationPlaced);
    occupied.add(slot.id);
    served.add(slot.id);
    reef.servedSlots.push(slot.id);
    counts.set(definition.id, (counts.get(definition.id) ?? 0) + 1);
    if (!owned.has(definition.id)) {
      owned.add(definition.id);
      reef.owned.push(definition.id);
    }
    if (!granted.has(definition.id)) {
      granted.add(definition.id);
      reef.granted.push(definition.id);
      newlyGranted.push(definition.id);
    }
  }

  return { planted, granted: newlyGranted, stageUp: growth.stage > reef.lastSeenStage ? growth.stage : null };
}

/**
 * Prende de volta ao canteiro o que já está plantado.
 *
 * A posição é do CANTEIRO; a instância guarda só o capricho visual (inclinação, espelho, tamanho).
 * Sem isto, mexer no layout deixaria o Recife de quem já jogou com as peças paradas onde o canteiro
 * não está mais — em cima de um lugar pintado, por exemplo. E peça cujo canteiro sumiu do layout
 * não tem mais casa: sai da cena (a posse continua, então o jogador não perde nada).
 */
function reanchor(placed: PlacedDecoration[], slots: readonly ReefSlot[]): void {
  for (let index = placed.length - 1; index >= 0; index -= 1) {
    const item = placed[index];
    const slot = item.slotId === null ? undefined : slots.find((candidate) => candidate.id === item.slotId);
    if (item.slotId !== null && !slot) {
      placed.splice(index, 1);
      continue;
    }
    if (!slot) continue;
    item.x = slot.at.x;
    item.y = slot.at.y;
    // O tamanho volta para a faixa do canteiro: é dela que sai a garantia de não tapar um lugar.
    const low = slot.scale * (1 - SCALE_JITTER);
    const high = slot.scale * (1 + SCALE_JITTER);
    item.scale = Number(Math.min(high, Math.max(low, item.scale)).toFixed(3));
  }
}
