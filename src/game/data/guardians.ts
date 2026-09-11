import type { GuardianDefinition, GuardianId, GuardianState } from "../types";
import { GUARDIAN_BALANCE } from "./balance";

const stateProfile = (
  prefix: string,
  windupMs: number,
  attackMs: number,
  impactAtMs: number,
  recoveryMs: number,
): GuardianDefinition["animation"] => ({
  impactAtMs,
  states: {
    idle: { key: `${prefix}-idle`, loop: true, durationMs: 900 },
    windup: { key: `${prefix}-windup`, loop: false, durationMs: windupMs },
    attack: { key: `${prefix}-attack`, loop: false, durationMs: attackMs },
    recovery: { key: `${prefix}-recovery`, loop: false, durationMs: recoveryMs },
    disabled: { key: `${prefix}-disabled`, loop: true, durationMs: 700 },
  } satisfies Record<GuardianState, { key: string; loop: boolean; durationMs: number }>,
});

const shrimp = GUARDIAN_BALANCE["pistol-shrimp"];
const jelly = GUARDIAN_BALANCE.jellyfish;
const puffer = GUARDIAN_BALANCE.pufferfish;
const crab = GUARDIAN_BALANCE["reef-crab"];
const octopus = GUARDIAN_BALANCE["ink-octopus"];

const pct = (multiplier: number): string => `${Math.round((multiplier - 1) * 100)}%`;
const seconds = (ms: number): string => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;

/**
 * Catálogo de Guardiões. Os números vêm de `balance.ts`; aqui ficam nomes,
 * cores, ritmo de animação e a estrutura das duas árvores de upgrade.
 * Para adicionar um Guardião: crie a entrada aqui, no `GUARDIAN_BALANCE`,
 * no tipo `GuardianId` e inclua o id em `GUARDIAN_ORDER`.
 */
export const GUARDIANS: Record<GuardianId, GuardianDefinition> = {
  "pistol-shrimp": {
    id: "pistol-shrimp",
    name: "Camarão-Pistola",
    shortName: "Camarão",
    description: "Disparo forte em alvo único. A unidade mais simples e barata.",
    role: "Dano à distância",
    color: 0xff7043,
    accent: 0x24c8ef,
    cost: shrimp.cost,
    range: shrimp.range,
    damage: shrimp.damage,
    cooldownMs: shrimp.cooldownMs,
    attackKind: "projectile",
    placementMode: "platform",
    projectileSpeed: shrimp.projectileSpeed,
    timings: { windupMs: 180, attackMs: 180, recoveryMs: 540 },
    animation: stateProfile("shrimp", 180, 180, 55, 540),
    branches: [
      {
        id: "a",
        name: "Perfuração",
        tagline: "Um disparo, vários alvos.",
        color: 0x4fd6ff,
        upgrades: [
          {
            name: "Tiro Perfurante",
            description: `Atravessa um segundo alvo: ${shrimp.pierce.level1.pierceDamages.join(" / ")} de dano. Nunca acerta o mesmo inimigo duas vezes.`,
            cost: shrimp.upgradeCosts[0],
            pierceDamages: [...shrimp.pierce.level1.pierceDamages],
          },
          {
            name: "Ricochete Reto",
            description: `Até três alvos (${shrimp.pierce.level2.pierceDamages.join(" / ")}). Ao atravessar, segue reto para o próximo alvo novo.`,
            cost: shrimp.upgradeCosts[1],
            pierceDamages: [...shrimp.pierce.level2.pierceDamages],
            straightRicochet: true,
          },
        ],
      },
      {
        id: "b",
        name: "Dano Concentrado",
        tagline: "Mais lento, muito mais forte.",
        color: 0xffb547,
        upgrades: [
          {
            name: "Carga Pesada",
            description: `${shrimp.heavy.level1.damage} de dano a cada ${seconds(shrimp.heavy.level1.cooldownMs)}. Ótimo contra armadura, elites e chefes.`,
            cost: shrimp.upgradeCosts[0],
            damage: shrimp.heavy.level1.damage,
            cooldownMs: shrimp.heavy.level1.cooldownMs,
          },
          {
            name: "Estampido Abissal",
            description: `${shrimp.heavy.level2.damage} de dano a cada ${seconds(shrimp.heavy.level2.cooldownMs)} com pequena área no impacto.`,
            cost: shrimp.upgradeCosts[1],
            damage: shrimp.heavy.level2.damage,
            cooldownMs: shrimp.heavy.level2.cooldownMs,
            splash: { ...shrimp.heavy.level2.splash },
          },
        ],
      },
    ],
  },
  jellyfish: {
    id: "jellyfish",
    name: "Água-viva",
    shortName: "Água-viva",
    description: "Descarga que desacelera. O valor dela é o controle, não o dano.",
    role: "Controle",
    color: 0xb86bff,
    accent: 0x6fe9ff,
    cost: jelly.cost,
    range: jelly.range,
    damage: jelly.damage,
    cooldownMs: jelly.cooldownMs,
    attackKind: "chain",
    placementMode: "water",
    slowFactor: jelly.slowFactor,
    slowDurationMs: jelly.slowDurationMs,
    timings: { windupMs: 260, attackMs: 200, recoveryMs: 590 },
    animation: stateProfile("jellyfish", 260, 200, 80, 590),
    branches: [
      {
        id: "a",
        name: "Elétrico",
        tagline: "Saltos e campo periódico.",
        color: 0x7deaff,
        upgrades: [
          {
            name: "Salto Elétrico",
            description: `A descarga salta até ${jelly.electric.level1.chainDamages.length} inimigos: ${jelly.electric.level1.chainDamages.join(" / ")} de dano.`,
            cost: jelly.upgradeCosts[0],
            chainDamages: [...jelly.electric.level1.chainDamages],
          },
          {
            name: "Campo Elétrico",
            description: `Zona de ${jelly.electric.level2.damage} de dano a cada ${seconds(jelly.electric.level2.pulseIntervalMs)} por ${seconds(jelly.electric.level2.durationMs)} (máx. ${jelly.electric.level2.maxDamagePerTarget} por alvo). Recarga ${seconds(jelly.electric.level2.cooldownMs)}.`,
            cost: jelly.upgradeCosts[1],
            electricField: { ...jelly.electric.level2 },
          },
        ],
      },
      {
        id: "b",
        name: "Controle",
        tagline: "Lentidão forte e paralisia curta.",
        color: 0xe08cff,
        upgrades: [
          {
            name: "Toque Gélido",
            description: `Lentidão mais forte: inimigos a ${Math.round(jelly.control.level1.slowFactor * 100)}% da velocidade por ${seconds(jelly.control.level1.slowDurationMs)}.`,
            cost: jelly.upgradeCosts[0],
            slowFactor: jelly.control.level1.slowFactor,
            slowDurationMs: jelly.control.level1.slowDurationMs,
          },
          {
            name: "Paralisia",
            description: `Paralisa o alvo por ${seconds(jelly.control.level2.stun.durationMs)}. Cada inimigo só pode ser paralisado de novo após ${seconds(jelly.control.level2.stun.immunityMs)}.`,
            cost: jelly.upgradeCosts[1],
            stun: { ...jelly.control.level2.stun },
          },
        ],
      },
    ],
  },
  pufferfish: {
    id: "pufferfish",
    name: "Baiacu",
    shortName: "Baiacu",
    description: `Segura ${puffer.blockCapacity} inimigo na correnteza e causa ${puffer.contactDamagePerSecond}/s de dano de contato.`,
    role: "Contenção",
    color: 0xa8d85e,
    accent: 0xffe082,
    cost: puffer.cost,
    range: puffer.range,
    damage: puffer.damage,
    cooldownMs: puffer.cooldownMs,
    attackKind: "area",
    placementMode: "route",
    blocks: true,
    blockCapacity: puffer.blockCapacity,
    contactDamagePerSecond: puffer.contactDamagePerSecond,
    timings: { windupMs: 340, attackMs: 240, recoveryMs: 920 },
    animation: stateProfile("pufferfish", 340, 240, 100, 920),
    branches: [
      {
        id: "a",
        name: "Fortaleza",
        tagline: "Mais contenção.",
        color: 0x9ee36b,
        upgrades: [
          {
            name: "Espinhos Reforçados",
            description: `Segura ${puffer.fortress.level1.blockCapacity} inimigos com ${puffer.fortress.level1.contactDamagePerSecond}/s de contato.`,
            cost: puffer.upgradeCosts[0],
            blockCapacity: puffer.fortress.level1.blockCapacity,
            contactDamagePerSecond: puffer.fortress.level1.contactDamagePerSecond,
          },
          {
            name: "Fortaleza Espinhosa",
            description: `Segura ${puffer.fortress.level2.blockCapacity} inimigos (${puffer.fortress.level2.contactDamagePerSecond}/s). Pausa chefes por ${seconds(puffer.fortress.level2.bossHold.durationMs)}; depois ficam imunes por ${seconds(puffer.fortress.level2.bossHold.immunityMs)}.`,
            cost: puffer.upgradeCosts[1],
            blockCapacity: puffer.fortress.level2.blockCapacity,
            contactDamagePerSecond: puffer.fortress.level2.contactDamagePerSecond,
            bossHold: { ...puffer.fortress.level2.bossHold },
          },
        ],
      },
      {
        id: "b",
        name: "Pulso",
        tagline: "Dano em área com leve controle.",
        color: 0xffe082,
        upgrades: [
          {
            name: "Pulso Espinhoso",
            description: `Pulso de ${puffer.pulse.level1.damage} de dano em área a cada ${seconds(puffer.pulse.level1.cooldownMs)}.`,
            cost: puffer.upgradeCosts[0],
            damage: puffer.pulse.level1.damage,
            cooldownMs: puffer.pulse.level1.cooldownMs,
          },
          {
            name: "Onda de Espinhos",
            description: `Pulso de ${puffer.pulse.level2.damage} que também desacelera brevemente (${Math.round(puffer.pulse.level2.slowFactor * 100)}% por ${seconds(puffer.pulse.level2.slowDurationMs)}).`,
            cost: puffer.upgradeCosts[1],
            damage: puffer.pulse.level2.damage,
            cooldownMs: puffer.pulse.level2.cooldownMs,
            slowFactor: puffer.pulse.level2.slowFactor,
            slowDurationMs: puffer.pulse.level2.slowDurationMs,
          },
        ],
      },
    ],
  },
  "reef-crab": {
    id: "reef-crab",
    name: "Caranguejo-Recife",
    shortName: "Caranguejo",
    description: "Corpo a corpo na correnteza. Não bloqueia, mas bate forte em quem passa.",
    role: "Dano corpo a corpo",
    color: 0xe0563d,
    accent: 0xffd1a8,
    cost: crab.cost,
    range: crab.range,
    damage: crab.damage,
    cooldownMs: crab.cooldownMs,
    attackKind: "melee",
    placementMode: "route",
    blocks: false,
    timings: { windupMs: 240, attackMs: 200, recoveryMs: 960 },
    animation: stateProfile("crab", 240, 200, 90, 960),
    branches: [
      {
        id: "a",
        name: "Quebra-Casco",
        tagline: "Anti-armadura.",
        color: 0xffa86b,
        upgrades: [
          {
            name: "Pinça Perfurante",
            description: `${crab.shellbreaker.level1.damage} de dano ignorando armadura.`,
            cost: crab.upgradeCosts[0],
            damage: crab.shellbreaker.level1.damage,
            armorPiercing: true,
          },
          {
            name: "Fratura Exposta",
            description: `${crab.shellbreaker.level2.damage} de dano ignorando armadura e o alvo sofre +${pct(crab.shellbreaker.level2.vulnerability.multiplier)} de dano por ${seconds(crab.shellbreaker.level2.vulnerability.durationMs)}.`,
            cost: crab.upgradeCosts[1],
            damage: crab.shellbreaker.level2.damage,
            armorPiercing: true,
            vulnerability: { ...crab.shellbreaker.level2.vulnerability },
          },
        ],
      },
      {
        id: "b",
        name: "Varredura",
        tagline: "Dano em área contra grupos.",
        color: 0xff8f8f,
        upgrades: [
          {
            name: "Pinçada Ampla",
            description: `${crab.sweep.level1.damage} de dano em todos os inimigos ao alcance.`,
            cost: crab.upgradeCosts[0],
            damage: crab.sweep.level1.damage,
            areaAttack: true,
          },
          {
            name: "Giro de Carapaça",
            description: `A cada ${crab.sweep.level2.spin.everyAttacks} ataques, gira 360° causando ${crab.sweep.level2.spin.damage} em área ampliada.`,
            cost: crab.upgradeCosts[1],
            damage: crab.sweep.level2.damage,
            areaAttack: true,
            spin: { ...crab.sweep.level2.spin },
          },
        ],
      },
    ],
  },
  "ink-octopus": {
    id: "ink-octopus",
    name: "Polvo-Tinteiro",
    shortName: "Polvo",
    description: `Suporte nas pedras. Jato de tinta fraco que deixa o alvo ${pct(octopus.vulnerability.multiplier)} mais vulnerável.`,
    role: "Suporte",
    color: 0x6b5bd6,
    accent: 0xffc3f0,
    cost: octopus.cost,
    range: octopus.range,
    damage: octopus.damage,
    cooldownMs: octopus.cooldownMs,
    attackKind: "ink",
    placementMode: "platform",
    vulnerability: { ...octopus.vulnerability },
    timings: { windupMs: 300, attackMs: 220, recoveryMs: 1080 },
    animation: stateProfile("octopus", 300, 220, 90, 1080),
    branches: [
      {
        id: "a",
        name: "Tinta",
        tagline: "Debuff nos inimigos.",
        color: 0x9d7bff,
        upgrades: [
          {
            name: "Tinta Corrosiva",
            description: `${octopus.ink.level1.damage} de dano e +${pct(octopus.ink.level1.vulnerability.multiplier)} de vulnerabilidade em pequena área.`,
            cost: octopus.upgradeCosts[0],
            damage: octopus.ink.level1.damage,
            vulnerability: { ...octopus.ink.level1.vulnerability },
          },
          {
            name: "Nuvem de Tinta",
            description: `Cria uma nuvem por ${seconds(octopus.ink.level2.durationMs)} que desacelera e aplica vulnerabilidade. Recarga ${seconds(octopus.ink.level2.cooldownMs)}.`,
            cost: octopus.upgradeCosts[1],
            inkCloud: { ...octopus.ink.level2 },
          },
        ],
      },
      {
        id: "b",
        name: "Maré Aliada",
        tagline: "Buff nos aliados. Não acumula.",
        color: 0xffc3f0,
        upgrades: [
          {
            name: "Ritmo da Maré",
            description: `Aliados ao alcance atacam ${pct(octopus.tide.level1.attackSpeedMultiplier)} mais rápido.`,
            cost: octopus.upgradeCosts[0],
            aura: { ...octopus.tide.level1 },
          },
          {
            name: "Maré Alta",
            description: `Aliados atacam ${pct(octopus.tide.level2.attackSpeedMultiplier)} mais rápido e ganham +${pct(octopus.tide.level2.rangeMultiplier)} de alcance.`,
            cost: octopus.upgradeCosts[1],
            aura: { ...octopus.tide.level2 },
          },
        ],
      },
    ],
  },
};

export const GUARDIAN_ORDER: GuardianId[] = ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"];
