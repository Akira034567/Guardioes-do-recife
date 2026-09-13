import { decoration } from "../../data/reef/decorations";
import { MAX_PLACED_DECORATIONS, type PlacedDecoration, type PlayerProgress } from "../save/PlayerProgress";
import { isDecorationUnlocked } from "./growth";

/**
 * A costura para as Conchas ganharem função.
 *
 * Hoje NADA nesta ilha é chamado pela interface: não há loja, e o jogador não é obrigado a gastar
 * nada. O que existe é o mínimo para a loja de amanhã nascer sem refazer regra nenhuma — e já
 * testado, que é a parte que costuma faltar.
 *
 * `spendShells` é o único caminho para tirar Conchas da carteira. Ter um sumidouro só é o que
 * permite, um dia, registrar, animar e conferir gasto em um lugar apenas.
 */

export type SpendResult = { ok: true; shells: number } | { ok: false; reason: "insufficient" | "invalid" };

/** `lifetimeShells` NUNCA diminui: ele é histórico do que o jogador ganhou, não saldo. */
export function spendShells(progress: PlayerProgress, amount: number): SpendResult {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) return { ok: false, reason: "invalid" };
  if (progress.currency.shells < amount) return { ok: false, reason: "insufficient" };
  progress.currency.shells -= amount;
  return { ok: true, shells: progress.currency.shells };
}

export function canAfford(progress: PlayerProgress, amount: number): boolean {
  return Number.isFinite(amount) && progress.currency.shells >= amount;
}

export type BuyResult =
  | { ok: true; instanceId: string | null }
  | { ok: false; reason: "unknown" | "locked" | "owned" | "notForSale" | "insufficient" };

/**
 * A loja de amanhã. A posse é por PEÇA, não por cópia: comprar uma vez libera plantar até o
 * `maxCount` dela. Quem barra o excesso é `placeDecoration`, não a compra.
 */
export function buyDecoration(
  progress: PlayerProgress,
  definitionId: string,
  at?: { slotId?: string | null; x: number; y: number },
): BuyResult {
  const definition = decoration(definitionId);
  if (!definition) return { ok: false, reason: "unknown" };
  if (progress.reef.owned.includes(definitionId)) return { ok: false, reason: "owned" };
  if (definition.cost <= 0) return { ok: false, reason: "notForSale" };
  if (!isDecorationUnlocked(definition, progress)) return { ok: false, reason: "locked" };
  const spent = spendShells(progress, definition.cost);
  if (!spent.ok) return { ok: false, reason: "insufficient" };
  progress.reef.owned.push(definitionId);
  const planted = at ? placeDecoration(progress, definitionId, at) : null;
  return { ok: true, instanceId: planted?.instanceId ?? null };
}

/** Concede sem cobrar (crescimento automático, recompensa narrativa). Idempotente. */
export function grantDecoration(progress: PlayerProgress, definitionId: string): boolean {
  if (!decoration(definitionId)) return false;
  if (progress.reef.owned.includes(definitionId)) return false;
  progress.reef.owned.push(definitionId);
  return true;
}

export function placeDecoration(
  progress: PlayerProgress,
  definitionId: string,
  at: { slotId?: string | null; x: number; y: number; rotation?: number; scale?: number; flip?: boolean },
): PlacedDecoration | null {
  const definition = decoration(definitionId);
  if (!definition) return null;
  if (progress.reef.placed.length >= MAX_PLACED_DECORATIONS) return null;
  const placedCount = progress.reef.placed.filter((item) => item.defId === definitionId).length;
  if (placedCount >= definition.maxCount) return null;
  const placed: PlacedDecoration = {
    instanceId: `d${progress.reef.nextInstanceId}`,
    defId: definitionId,
    x: at.x,
    y: at.y,
    rotation: at.rotation ?? 0,
    scale: at.scale ?? 1,
    flip: at.flip ?? false,
    slotId: at.slotId ?? null,
  };
  progress.reef.nextInstanceId += 1;
  progress.reef.placed.push(placed);
  if (!progress.reef.owned.includes(definitionId)) progress.reef.owned.push(definitionId);
  return placed;
}

export function removeDecoration(progress: PlayerProgress, instanceId: string): boolean {
  const index = progress.reef.placed.findIndex((item) => item.instanceId === instanceId);
  if (index < 0) return false;
  progress.reef.placed.splice(index, 1);
  return true;
}
