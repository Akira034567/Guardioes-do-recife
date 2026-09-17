import type { BranchId, GuardianId } from "../types";
import { GUARDIAN_ORDER } from "./guardians";

/**
 * MAESTRIA PERMANENTE (V3).
 *
 * Progressão de fora da partida: cada Guardião tem cinco nós, comprados com Conchas e válidos em
 * todas as partidas seguintes. Nada aqui é escolha dentro da fase — a árvore de upgrades (dois ramos,
 * dois níveis) continua sendo a decisão tática, e a maestria é a decisão de longo prazo.
 *
 * Duas regras de desenho que valem para o catálogo inteiro:
 *
 * 1. **Nós 1 a 4 são pequenos e específicos.** Cada um mexe em UM atributo da função do Guardião, na
 *    casa de 3% a 5%. Somados, os bônus NOMINAIS dos quatro ficam entre 13% e 16%.
 *
 *    Atenção ao que esse número é: uma SOMA de eixos diferentes (dano, cadência, alcance, duração).
 *    O ganho efetivo em campo é MENOR, porque +4% de alcance não vira +4% de dano por segundo. O
 *    alvo de desenho — 10% a 15% de poder efetivo — cai dentro disso, mas confirmar exige medir em
 *    partida, não somar. 🔶 é um dos pontos de calibração desta rodada.
 * 2. **O nó 5 é temático e condicional.** Só liga quando aquela unidade chega ao nível 2 de um dos
 *    ramos, e o que ele faz depende do ramo escolhido. É a recompensa de quem levou o Guardião até o
 *    fim, não um bônus passivo a mais.
 *
 * 🔶 TODOS os números são placeholders desta rodada, para calibrar depois do próximo rebalanceamento.
 * 🔶 Os efeitos do nó 5 estão DECLARADOS mas ainda SEM efeito numérico: `capstone` descreve o que cada
 *    ramo vai ganhar e o motor já sabe quando ele está ativo (`MasteryBonus.capstone`), mas nenhum
 *    sistema lê isso ainda. É de propósito: o desenho está fechado, os números não.
 */

/** Custo em Conchas de cada nó, do 1 ao 5. Igual para todos os Guardiões. */
export const MASTERY_COSTS = [500, 1500, 4000, 10_000, 25_000] as const;

export const MASTERY_MAX_LEVEL = MASTERY_COSTS.length;

/**
 * Bônus numérico de um nó. Todo campo é um MULTIPLICADOR (1 = neutro), exceto os `*Bonus`, que são
 * aditivos. Nos campos de recarga e rearme, MENOR é melhor.
 */
export interface MasteryEffect {
  damageMultiplier?: number;
  attackSpeedMultiplier?: number;
  rangeMultiplier?: number;
  projectileSpeedMultiplier?: number;
  /** Duração de stun, bloqueio e empurrão. */
  controlDurationMultiplier?: number;
  /** Duração de lentidão, vulnerabilidade e veneno. */
  debuffDurationMultiplier?: number;
  /** Recarga de habilidades (campo elétrico, nuvem, sonar, coro, repulsa). */
  abilityCooldownMultiplier?: number;
  /** Tempo para a armadilha voltar a armar. */
  rearmMultiplier?: number;
  /** Dano de contato por segundo dos bloqueadores. */
  contactDamageMultiplier?: number;
  /** Tempo que o Peixe-Pedra leva para se enterrar. */
  trapArmMultiplier?: number;
  /** Soma ao teto da carga da armadilha (0.03 = +3 pontos percentuais). */
  chargeMaxBonus?: number;
  /** Distância das ondas de repulsa da Tartaruga. */
  pushDistanceMultiplier?: number;
}

export interface MasteryNode {
  level: number;
  name: string;
  description: string;
  cost: number;
  effect: MasteryEffect;
}

/**
 * Nó 5. Só entra em vigor quando a unidade chega ao nível 2 de um ramo, e o efeito muda com o ramo.
 *
 * 🔶 `branches` guarda hoje só a descrição do que cada lado vai ganhar. O ponto de extensão é o
 * `capstone` em `MasteryBonus`: quando os números forem definidos, é ali que os sistemas passam a ler.
 */
export interface MasteryCapstone {
  id: string;
  name: string;
  description: string;
  cost: number;
  branches: Record<BranchId, string>;
}

export interface GuardianMastery {
  guardianId: GuardianId;
  /** Os quatro nós pequenos, em ordem. */
  nodes: MasteryNode[];
  capstone: MasteryCapstone;
}

const node = (level: number, name: string, description: string, effect: MasteryEffect): MasteryNode => ({
  level,
  name,
  description,
  cost: MASTERY_COSTS[level - 1],
  effect,
});

const capstone = (id: string, name: string, description: string, a: string, b: string): MasteryCapstone => ({
  id,
  name,
  description,
  cost: MASTERY_COSTS[4],
  branches: { a, b },
});

export const MASTERY: Record<GuardianId, GuardianMastery> = {
  "pistol-shrimp": {
    guardianId: "pistol-shrimp",
    nodes: [
      node(1, "Pólvora Fina", "+3% de dano em todos os disparos.", { damageMultiplier: 1.03 }),
      node(2, "Bolha Tensa", "+5% na velocidade do projétil: menos tiro perdido em alvo rápido.", { projectileSpeedMultiplier: 1.05 }),
      node(3, "Gatilho Leve", "+3% de cadência.", { attackSpeedMultiplier: 1.03 }),
      node(4, "Mira Longa", "+4% de alcance.", { rangeMultiplier: 1.04 }),
    ],
    capstone: capstone(
      "balistica-perfeita",
      "Balística Perfeita",
      "O disparo aprende a continuar depois do alvo.",
      "Perfuração: ganha um quarto ricochete, mais fraco que os três primeiros.",
      "Dano Concentrado: o estampido deixa uma segunda explosão menor e atrasada no ponto de impacto.",
    ),
  },
  jellyfish: {
    guardianId: "jellyfish",
    nodes: [
      node(1, "Nematocisto Denso", "+3% de dano na descarga.", { damageMultiplier: 1.03 }),
      node(2, "Toque Persistente", "+4% na duração da lentidão.", { debuffDurationMultiplier: 1.04 }),
      node(3, "Tentáculo Longo", "+4% de alcance.", { rangeMultiplier: 1.04 }),
      node(4, "Pulso Curto", "+3% de cadência.", { attackSpeedMultiplier: 1.03 }),
    ],
    capstone: capstone(
      "sobrecarga",
      "Sobrecarga",
      "A carga acumulada precisa ir para algum lugar.",
      "Elétrico: a sobrecarga ESPALHA — a descarga alcança mais gente em volta.",
      "Controle: a sobrecarga CONTROLA — a paralisia pesa mais sobre quem já está preso.",
    ),
  },
  pufferfish: {
    guardianId: "pufferfish",
    nodes: [
      node(1, "Espinho Afiado", "+4% de dano de contato.", { contactDamageMultiplier: 1.04 }),
      node(2, "Agarre Firme", "+4% na duração do que ele segura.", { controlDurationMultiplier: 1.04 }),
      node(3, "Inflar Mais", "+4% de alcance: a área do pulso e o raio de contenção crescem juntos.", { rangeMultiplier: 1.04 }),
      node(4, "Couro Grosso", "+4% de dano de contato.", { contactDamageMultiplier: 1.04 }),
    ],
    capstone: capstone(
      "fortaleza-de-espinhos",
      "Fortaleza de Espinhos",
      "Quem para na frente dele para de vez.",
      "Fortaleza: segura mais e cobra mais caro de cada um que está preso.",
      "Pulso: os pulsos ficam maiores e mais frequentes.",
    ),
  },
  "reef-crab": {
    guardianId: "reef-crab",
    nodes: [
      node(1, "Pinça Pesada", "+3% de dano.", { damageMultiplier: 1.03 }),
      node(2, "Passada Larga", "+4% de alcance — muito, para quem só tem 78.", { rangeMultiplier: 1.04 }),
      node(3, "Carapaça Leve", "+3% de cadência.", { attackSpeedMultiplier: 1.03 }),
      node(4, "Quelas Duplas", "+3% de dano, valendo tanto na perfuração quanto na varredura.", { damageMultiplier: 1.03 }),
    ],
    capstone: capstone(
      "pressao-das-pincas",
      "Pressão das Pinças",
      "Ele não solta o que agarrou.",
      "Quebra-Casco: duelo — acrescenta uma pinçada extra em alvo mantido, contra quem resiste.",
      "Varredura: o giro fica maior e a pinçada extra sai de forma mais estável.",
    ),
  },
  "ink-octopus": {
    guardianId: "ink-octopus",
    nodes: [
      node(1, "Tinta Espessa", "+4% na duração dos debuffs que ele aplica.", { debuffDurationMultiplier: 1.04 }),
      node(2, "Braço Longo", "+4% de alcance (vale também para a aura).", { rangeMultiplier: 1.04 }),
      node(3, "Bico Afiado", "+3% de dano.", { damageMultiplier: 1.03 }),
      node(4, "Sifão Eficiente", "−4% na recarga das habilidades.", { abilityCooldownMultiplier: 0.96 }),
    ],
    capstone: capstone(
      "tinta-viva",
      "Tinta Viva",
      "A tinta dele não seca quando o alvo cai.",
      "Tinta: o inimigo afetado deixa uma mancha temporária ao morrer.",
      "Maré Aliada: um pulso sai a cada abate dentro da aura.",
    ),
  },
  shark: {
    guardianId: "shark",
    nodes: [
      node(1, "Dentes Serrilhados", "+3% de dano na mordida.", { damageMultiplier: 1.03 }),
      node(2, "Bote Longo", "+4% no alcance da investida.", { rangeMultiplier: 1.04 }),
      node(3, "Nado Curto", "+3% de cadência.", { attackSpeedMultiplier: 1.03 }),
      node(4, "Faro Apurado", "+3% de dano — na prática, mais peso contra os feridos que ele já caça.", { damageMultiplier: 1.03 }),
    ],
    capstone: capstone(
      "cacada-implacavel",
      "Caçada Implacável",
      "Uma presa que cai não interrompe a caçada.",
      "Frenesi: a transição entre presas fica mais suave — ele não perde o embalo ao trocar de alvo.",
      "Investida: preserva parte da progressão da marca ao mudar de presa.",
    ),
  },
  "sea-turtle": {
    guardianId: "sea-turtle",
    nodes: [
      node(1, "Casco Largo", "+4% de alcance: a zona de corrente cresce junto.", { rangeMultiplier: 1.04 }),
      node(2, "Peso Ancestral", "+4% na duração do bloqueio e dos controles.", { controlDurationMultiplier: 1.04 }),
      node(3, "Bicada Firme", "+3% de dano.", { damageMultiplier: 1.03 }),
      node(4, "Braçada Forte", "+4% na distância das ondas de repulsa.", { pushDistanceMultiplier: 1.04 }),
    ],
    capstone: capstone(
      "dominio-das-correntes",
      "Domínio das Correntes",
      "A água ao redor dela deixa de ser neutra.",
      "Casco: mais capacidade territorial — ela segura mais gente ao mesmo tempo.",
      "Correnteza: gera uma onda de corrente extra de tempos em tempos, além da que já tem.",
    ),
  },
  stonefish: {
    guardianId: "stonefish",
    nodes: [
      node(1, "Bote Rápido", "−4% no tempo de abrir os espinhos: o bote sai mais cedo.", { trapArmMultiplier: 0.96 }),
      node(2, "Fôlego Curto", "−4% na recarga entre emboscadas.", { rearmMultiplier: 0.96 }),
      node(3, "Sombra Larga", "+4% na zona de emboscada.", { rangeMultiplier: 1.04 }),
      node(4, "Peçonha Densa", "+4% na duração do veneno que ele aplica.", { debuffDurationMultiplier: 1.04 }),
    ],
    capstone: capstone(
      "territorio-mortal",
      "Território Mortal",
      "A espera e o veneno dele deixam de ser passageiros.",
      "Ecossistema Tóxico: a PRIMEIRA vez que um inimigo entra no Jardim recebe uma dose extra e curta de veneno.",
      "Paciência Mortal: cada segundo camuflado sem atacar soma dano ao próximo bote, até um teto.",
    ),
  },
  dolphin: {
    guardianId: "dolphin",
    nodes: [
      node(1, "Eco Amplo", "+4% de alcance do sonar e do coro.", { rangeMultiplier: 1.04 }),
      node(2, "Nota Sustentada", "+4% na duração dos efeitos que ele aplica.", { debuffDurationMultiplier: 1.04 }),
      node(3, "Fôlego Longo", "−4% na recarga das habilidades.", { abilityCooldownMultiplier: 0.96 }),
      node(4, "Canto Claro", "+3% de dano no pulso — o suporte continua suporte.", { damageMultiplier: 1.03 }),
    ],
    capstone: capstone(
      "sincronia-do-recife",
      "Sincronia do Recife",
      "O cardume inteiro passa a respirar junto. Ajuste fino, nunca um salto.",
      "Coro: bônus maior por diversidade de espécies na área.",
      "Sonar: acrescenta uma eco-onda extra, pequena, ao fim do pulso.",
    ),
  },
};

/** Catálogo na ordem do jogo. */
export const MASTERY_ORDER: GuardianId[] = [...GUARDIAN_ORDER];

/** Custo acumulado para chegar ao nível `level` (0 = nada comprado). */
export function masteryTotalCost(level: number): number {
  let total = 0;
  for (let index = 0; index < Math.min(level, MASTERY_MAX_LEVEL); index += 1) total += MASTERY_COSTS[index];
  return total;
}

/** Custo do PRÓXIMO nó; `null` quando a árvore daquele Guardião já está completa. */
export function masteryNextCost(level: number): number | null {
  return level >= MASTERY_MAX_LEVEL ? null : MASTERY_COSTS[level];
}
