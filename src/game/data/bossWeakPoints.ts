import type { WeakPointPlan } from "../core/WeakPoints";

/**
 * Corais Corrompidos (item 11): os pontos fracos da Baleia Quebra-Marés.
 *
 * Quatro aglomerados cravados no dorso. Cada um tem vida própria, pode ser mirado e destruído, e
 * romper um deles rasga a baleia por dentro. Ela continua recebendo dano normalmente enquanto os
 * corais estão lá — os corais são o atalho, não a única porta.
 *
 * 🔶 TODOS os números aqui são placeholders da rodada de polimento. O balanceamento vem depois.
 */
export const CORRUPTED_CORALS: WeakPointPlan = {
  id: "corais-corrompidos",
  name: "Coral Corrompido",
  count: 4,
  /** Cada coral vale 10% da vida máxima da baleia. 🔶 */
  hpFraction: 0.1,
  /** Romper um coral tira 17,5% da vida máxima dela (faixa pedida: 15–20%). 🔶 */
  damageOnBreakFraction: 0.175,
  hitRadius: 9,
  /**
   * Posições no dorso, em múltiplos do `hitRadius` da baleia, com o nariz em +x. Estimadas sobre a
   * faixa dorsal do desenho. 🔶 o placeholder com maior chance de precisar de ajuste visual.
   */
  anchors: [
    { dx: -1.55, dy: -0.62 },
    { dx: -0.7, dy: -1.02 },
    { dx: 0.15, dy: -0.62 },
    { dx: 0.96, dy: -1.09 },
  ],
  color: 0xb44bd6,
  accent: 0xff8ae8,
};
