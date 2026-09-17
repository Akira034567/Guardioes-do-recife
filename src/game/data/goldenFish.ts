import type { MasteryBonus } from "../core/progression/mastery";
import type { BranchId, GuardianId } from "../types";

/**
 * PEIXINHO DOURADO (V3).
 *
 * Um por partida. Lá pelos 60% da fase o Recife entrega o Peixinho como recompensa GARANTIDA — não é
 * sorteio — e o jogador escolhe UMA unidade já em campo para coroar. A escolha vale o resto daquela
 * partida e não pode ser desfeita.
 *
 * O que a coroa faz: AMPLIFICA o que o ramo daquela unidade já faz. Não existe mecânica nova aqui, e
 * de propósito — o Peixinho é um holofote sobre uma decisão que o jogador já tomou, não uma decisão
 * nova. O ganho efetivo mira a faixa de 20% a 30%, medido na função do Guardião.
 *
 * Como ele NÃO se confunde com a maestria:
 *
 * - A maestria é permanente, vale para todas as unidades daquele Guardião e é comprada com Conchas.
 *   O Peixinho é de uma partida só, vale para UMA unidade e é conquistado jogando.
 * - O nó 5 da maestria e a coroa nunca compartilham código nem efeito. Se um dia os dois derem "mais
 *   área", serão dois efeitos separados, somando cada um o seu.
 * - Visualmente também não se confundem: dourado é SEMPRE peixinho coroado. O efeito do nó 5 da
 *   maestria tem partícula própria, não-dourada.
 *
 * Os números vivem em `GOLDEN_BOOSTS`, um por Guardião e por ramo, e entram no MESMO canal da maestria
 * (`combineBonus`) — as duas fontes somam cada uma a sua parte, nenhuma sobrescreve a outra.
 *
 * 🔶 Primeira passada de calibração: cada pacote mira a faixa declarada em `GOLDEN_AMPLIFICATION`,
 *    medida no eixo que interessa àquele Guardião. Falta confirmar em partida.
 */

/** Momento da fase em que o Peixinho é concedido: fração das ondas já limpas. */
export const GOLDEN_AWARD_WAVE_FRACTION = 0.6;

/** Faixa de ganho efetivo pretendida, para a calibração futura não sair dela sem decisão explícita. */
export const GOLDEN_AMPLIFICATION = { min: 0.2, max: 0.3 } as const;

/** Duração da coroação: clarão, partícula e a coroa assentando. */
export const GOLDEN_CORONATION_MS = 1000;

export interface GoldenBranchBoost {
  /** O que este ramo ganha ao ser coroado. */
  summary: string;
}

export interface GoldenFishProfile {
  guardianId: GuardianId;
  /** Como a coroa se manifesta neste Guardião, em uma linha. */
  tagline: string;
  /**
   * O que cada ramo ganha. `base` cobre a unidade ainda sem ramo escolhido: a coroa amplifica os
   * atributos brutos até ela decidir o caminho.
   */
  base: GoldenBranchBoost;
  branches: Record<BranchId, GoldenBranchBoost>;
}

const profile = (guardianId: GuardianId, tagline: string, base: string, a: string, b: string): GoldenFishProfile => ({
  guardianId,
  tagline,
  base: { summary: base },
  branches: { a: { summary: a }, b: { summary: b } },
});

export const GOLDEN_FISH: Record<GuardianId, GoldenFishProfile> = {
  "pistol-shrimp": profile(
    "pistol-shrimp",
    "O estampido fica dourado e o tiro, mais pesado.",
    "Mais dano e mais cadência no disparo simples.",
    "Perfuração: menos perda de dano a cada alvo atravessado, e mais cadência.",
    "Dano Concentrado: mais raio e mais impacto na explosão.",
  ),
  jellyfish: profile(
    "jellyfish",
    "A descarga ganha brilho e alcance.",
    "Mais dano e lentidão mais longa.",
    "Elétrico: campo maior e pulso um pouco mais rápido.",
    "Controle: paralisia um pouco maior, com intervalo interno menor.",
  ),
  pufferfish: profile(
    "pufferfish",
    "Os espinhos reluzem e cobram mais caro.",
    "Mais dano de contato em quem ele segura.",
    "Fortaleza: mais contato e mais carga máxima de presos.",
    "Pulso: pulsos maiores e mais frequentes.",
  ),
  "reef-crab": profile(
    "reef-crab",
    "As pinças ficam douradas e batem mais fundo.",
    "Mais dano e um pouco mais de cadência.",
    "Quebra-Casco: foco em duelo — mais peso contra alvos resistentes.",
    "Varredura: giro maior e pinçada extra mais estável.",
  ),
  "ink-octopus": profile(
    "ink-octopus",
    "A tinta ganha reflexo dourado.",
    "Debuffs duram mais e alcançam mais longe.",
    "Tinta: mancha mais forte, com vulnerabilidade mais duradoura.",
    "Maré Aliada: a aura cobre mais e rende mais aos aliados.",
  ),
  shark: profile(
    "shark",
    "A investida deixa rastro dourado.",
    "Mais dano e mais alcance no bote.",
    "Frenesi: transição mais suave entre presas.",
    "Investida: preserva parte da progressão da marca ao trocar de presa.",
  ),
  "sea-turtle": profile(
    "sea-turtle",
    "O casco brilha e a água obedece.",
    "Zona maior e controles mais longos.",
    "Casco: mais capacidade de contenção.",
    "Correnteza: mais zona e onda de corrente mais forte.",
  ),
  stonefish: profile(
    "stonefish",
    "A pedra em que ele se esconde cintila.",
    "Zona maior, bote mais forte e recarga mais curta.",
    "Jardim Tóxico: veneno mais potente e mais duradouro, em área maior.",
    "Predador: bote mais pesado e espera mais curta entre emboscadas.",
  ),
  dolphin: profile(
    "dolphin",
    "O canto dele fica dourado.",
    "Pulso mais amplo e mais duradouro.",
    "Coro: bônus maior por diversidade de espécies.",
    "Sonar: eco-onda extra ao fim do pulso.",
  ),
};

/**
 * Amplificação de cada Guardião, por ramo. Os campos são os mesmos da maestria: o que é multiplicador
 * multiplica, o que é `*Bonus` soma. Cada pacote mexe no eixo que É a função daquele Guardião — a
 * coroa aumenta o volume do que a unidade já faz, nunca muda o que ela faz.
 */
export const GOLDEN_BOOSTS: Record<GuardianId, Record<"base" | BranchId, Partial<MasteryBonus>>> = {
  "pistol-shrimp": {
    base: { damageMultiplier: 1.25, attackSpeedMultiplier: 1.1 },
    a: { damageMultiplier: 1.16, attackSpeedMultiplier: 1.16, projectileSpeedMultiplier: 1.2 },
    b: { damageMultiplier: 1.28, rangeMultiplier: 1.1 },
  },
  jellyfish: {
    base: { damageMultiplier: 1.22, debuffDurationMultiplier: 1.2 },
    a: { damageMultiplier: 1.15, abilityCooldownMultiplier: 0.8, rangeMultiplier: 1.15 },
    b: { damageMultiplier: 1.15, controlDurationMultiplier: 1.25, debuffDurationMultiplier: 1.15 },
  },
  pufferfish: {
    base: { contactDamageMultiplier: 1.3, controlDurationMultiplier: 1.15 },
    a: { contactDamageMultiplier: 1.3, blockCapacityBonus: 1, controlDurationMultiplier: 1.15 },
    b: { damageMultiplier: 1.25, abilityCooldownMultiplier: 0.82, rangeMultiplier: 1.1 },
  },
  "reef-crab": {
    base: { damageMultiplier: 1.2, attackSpeedMultiplier: 1.12 },
    a: { damageMultiplier: 1.28, attackSpeedMultiplier: 1.08 },
    b: { damageMultiplier: 1.2, rangeMultiplier: 1.15 },
  },
  "ink-octopus": {
    base: { debuffDurationMultiplier: 1.25, rangeMultiplier: 1.12 },
    a: { debuffDurationMultiplier: 1.3, abilityCooldownMultiplier: 0.8 },
    b: { rangeMultiplier: 1.2, attackSpeedMultiplier: 1.12 },
  },
  shark: {
    base: { damageMultiplier: 1.25, rangeMultiplier: 1.1 },
    a: { attackSpeedMultiplier: 1.2, damageMultiplier: 1.12 },
    b: { damageMultiplier: 1.28, rangeMultiplier: 1.08 },
  },
  "sea-turtle": {
    base: { controlDurationMultiplier: 1.25, blockCapacityBonus: 1 },
    a: { controlDurationMultiplier: 1.2, blockCapacityBonus: 2 },
    b: { rangeMultiplier: 1.2, pushDistanceMultiplier: 1.25, blockCapacityBonus: 1 },
  },
  stonefish: {
    // A coroa dele não inventa nada: mais área, mais dano, menos recarga e veneno mais longo.
    base: { damageMultiplier: 1.2, rangeMultiplier: 1.12, rearmMultiplier: 0.85 },
    a: { damageMultiplier: 1.15, rangeMultiplier: 1.12, debuffDurationMultiplier: 1.2 },
    b: { damageMultiplier: 1.25, rearmMultiplier: 0.82, rangeMultiplier: 1.08 },
  },
  dolphin: {
    base: { rangeMultiplier: 1.2, debuffDurationMultiplier: 1.2 },
    a: { rangeMultiplier: 1.2, abilityCooldownMultiplier: 0.78 },
    b: { debuffDurationMultiplier: 1.25, abilityCooldownMultiplier: 0.8, rangeMultiplier: 1.08 },
  },
};

/** A amplificação desta unidade, dado o ramo que ela escolheu (ou nenhum ainda). */
export function goldenBonusFor(guardianId: GuardianId, branchId: BranchId | null): Partial<MasteryBonus> {
  const boosts = GOLDEN_BOOSTS[guardianId];
  return branchId ? boosts[branchId] : boosts.base;
}

/** O que a coroa faz nesta unidade, dado o ramo que ela escolheu (ou nenhum ainda). */
export function goldenBoostFor(guardianId: GuardianId, branchId: BranchId | null): GoldenBranchBoost {
  const item = GOLDEN_FISH[guardianId];
  return branchId ? item.branches[branchId] : item.base;
}

/** Em que onda (índice 0) o Peixinho é concedido numa fase de `totalWaves` ondas. */
export function goldenAwardWaveIndex(totalWaves: number): number {
  if (totalWaves <= 0) return 0;
  // Nunca na última onda: a recompensa tem que dar tempo de ser usada.
  return Math.max(0, Math.min(totalWaves - 2, Math.round(totalWaves * GOLDEN_AWARD_WAVE_FRACTION) - 1));
}
