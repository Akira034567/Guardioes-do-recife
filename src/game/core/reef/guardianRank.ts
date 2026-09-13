import type { GuardianCareer } from "../save/PlayerProgress";

/**
 * A patente de um Guardião no Recife, derivada das partidas que ele já jogou.
 *
 * Os upgrades de unidade são escopo de partida e não persistem — não existe "nível do Guardião" no
 * save. Em vez de inventar uma persistência nova só para a ficha do hub ter um número, a patente sai
 * do que o jogo já guarda: a carreira em `progress.guardianStats`.
 */

export interface GuardianRank {
  id: "novato" | "veterano" | "guardiao" | "lenda";
  label: string;
  /** Partidas necessárias para o próximo degrau; null quando já está no topo. */
  nextAt: number | null;
}

const RANKS: ReadonlyArray<{ id: GuardianRank["id"]; label: string; from: number }> = [
  { id: "novato", label: "Novato", from: 0 },
  { id: "veterano", label: "Veterano", from: 5 },
  { id: "guardiao", label: "Guardião", from: 15 },
  { id: "lenda", label: "Lenda do Recife", from: 40 },
];

export function guardianRank(career: GuardianCareer | undefined): GuardianRank {
  const matches = Math.max(0, Math.floor(career?.matches ?? 0));
  let index = 0;
  for (let step = 0; step < RANKS.length; step += 1) {
    if (matches >= RANKS[step].from) index = step;
  }
  const next = RANKS[index + 1];
  return { id: RANKS[index].id, label: RANKS[index].label, nextAt: next ? next.from : null };
}
