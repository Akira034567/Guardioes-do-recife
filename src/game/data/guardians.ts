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
const shark = GUARDIAN_BALANCE.shark;
const turtle = GUARDIAN_BALANCE["sea-turtle"];
const stonefish = GUARDIAN_BALANCE.stonefish;
const dolphin = GUARDIAN_BALANCE.dolphin;

const pct = (multiplier: number): string => `${Math.round((multiplier - 1) * 100)}%`;
const frac = (fraction: number): string => `${Math.round(fraction * 100)}%`;
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
  shark: {
    id: "shark",
    name: "Tubarão — Instinto Predador",
    shortName: "Tubarão",
    description: `Investida curta com ${shark.damage} de dano. Prioriza inimigos com pouca vida e volta para a margem.`,
    role: "Execução",
    color: 0x5b7f99,
    accent: 0xff4d5e,
    cost: shark.cost,
    range: shark.range,
    damage: shark.damage,
    cooldownMs: shark.cooldownMs,
    attackKind: "melee",
    placementMode: "margin",
    targeting: shark.targeting,
    dash: true,
    timings: { windupMs: 220, attackMs: 260, recoveryMs: 820 },
    animation: stateProfile("shark", 220, 260, 150, 820),
    branches: [
      {
        id: "a",
        name: "Frenesi",
        tagline: "Cada vez mais rápido contra feridos.",
        color: 0xff5f6d,
        upgrades: [
          {
            name: "Faro de Sangue",
            description: `Contra alvos abaixo de ${frac(shark.frenzy.level1.healthThreshold)} de vida, ataca ${frac(shark.frenzy.level1.attackSpeedBonus)} mais rápido. Prioriza feridos, depois o mais avançado.`,
            cost: shark.upgradeCosts[0],
            targeting: "wounded",
            frenzy: { ...shark.frenzy.level1 },
          },
          {
            name: "Frenesi Predador",
            description: `+${frac(shark.frenzy.level2.perWoundedBonus)} de velocidade por inimigo ferido ao alcance (máx. +${frac(shark.frenzy.level2.maxBonus)}). Rastros vermelhos, sem clones.`,
            cost: shark.upgradeCosts[1],
            targeting: "wounded",
            frenzy: { ...shark.frenzy.level2 },
          },
        ],
      },
      {
        id: "b",
        name: "Caçador Alfa",
        tagline: "Marca e executa a maior ameaça.",
        color: 0x9fc9ff,
        upgrades: [
          {
            name: "Marcar Presa",
            description: `A cada ${seconds(shark.alpha.level1.mark.cooldownMs)} marca chefe, elite ou o inimigo mais forte ao alcance: +${pct(shark.alpha.level1.mark.damageMultiplier)} de dano contra ele por ${seconds(shark.alpha.level1.mark.durationMs)}.`,
            cost: shark.upgradeCosts[0],
            targeting: "threat",
            mark: { ...shark.alpha.level1.mark },
          },
          {
            name: "Predador Alfa",
            description: `${shark.alpha.level2.damage} de dano. Golpes seguidos na presa somam +${frac(shark.alpha.level2.mark.stacking.perHit)} cada (máx. +${frac(shark.alpha.level2.mark.stacking.max)}). Se a presa cai, marca outra na hora.`,
            cost: shark.upgradeCosts[1],
            targeting: "threat",
            damage: shark.alpha.level2.damage,
            mark: { ...shark.alpha.level2.mark, stacking: { ...shark.alpha.level2.mark.stacking } },
          },
        ],
      },
    ],
  },
  "sea-turtle": {
    id: "sea-turtle",
    name: "Tartaruga-Marinha — Guardiã do Recife",
    shortName: "Tartaruga",
    description: `Batida de ${turtle.damage} de dano que deixa o alvo a ${Math.round(turtle.slowFactor * 100)}% da velocidade. O valor dela é o controle da rota.`,
    role: "Controle de rota",
    color: 0x3f9a6e,
    accent: 0xd8f5c2,
    cost: turtle.cost,
    range: turtle.range,
    damage: turtle.damage,
    cooldownMs: turtle.cooldownMs,
    attackKind: "melee",
    placementMode: "route",
    blocks: false,
    slowFactor: turtle.slowFactor,
    slowDurationMs: turtle.slowDurationMs,
    timings: { windupMs: 320, attackMs: 240, recoveryMs: 940 },
    animation: stateProfile("turtle", 320, 240, 110, 940),
    branches: [
      {
        id: "a",
        name: "Casco",
        tagline: "Barreira viva na correnteza.",
        color: 0x8cd98a,
        upgrades: [
          {
            name: "Casco Ancestral",
            description: `Segura até ${turtle.shell.level1.blockCapacity} inimigos comuns por ${seconds(turtle.shell.level1.blockHold.durationMs)} (elites ocupam ${turtle.shell.level1.blockHold.eliteSlots} vagas; chefes só perdem velocidade). Depois de soltar, ${seconds(turtle.shell.level1.blockHold.releaseCooldownMs)} de recarga. Turbulência leve em volta.`,
            cost: turtle.upgradeCosts[0],
            blocks: true,
            blockCapacity: turtle.shell.level1.blockCapacity,
            blockHold: { ...turtle.shell.level1.blockHold, bossSlow: { ...turtle.shell.level1.blockHold.bossSlow } },
            flowField: { ...turtle.shell.level1.flowField },
          },
          {
            name: "Matriarca do Recife",
            description: `Segura até ${turtle.shell.level2.blockCapacity} comuns por ${seconds(turtle.shell.level2.blockHold.durationMs)}. Repulsa Ancestral a cada ${seconds(turtle.shell.level2.pushWave.cooldownMs)}: empurra comuns ${turtle.shell.level2.pushWave.distance}px pela rota, elites ${frac(turtle.shell.level2.pushWave.eliteFactor)}, chefes só slow.`,
            cost: turtle.upgradeCosts[1],
            blocks: true,
            blockCapacity: turtle.shell.level2.blockCapacity,
            blockHold: { ...turtle.shell.level2.blockHold, bossSlow: { ...turtle.shell.level2.blockHold.bossSlow } },
            flowField: { ...turtle.shell.level2.flowField },
            pushWave: { ...turtle.shell.level2.pushWave, bossSlow: { ...turtle.shell.level2.pushWave.bossSlow } },
          },
        ],
      },
      {
        id: "b",
        name: "Correnteza",
        tagline: "Muda a própria água.",
        color: 0x6fe3ff,
        upgrades: [
          {
            name: "Condutora das Águas",
            description: `Zona de corrente contrária em volta: inimigos dentro dela andam a ${Math.round(turtle.current.level1.flowField.speedFactor * 100)}% da velocidade.`,
            cost: turtle.upgradeCosts[0],
            flowField: { ...turtle.current.level1.flowField },
          },
          {
            name: "Senhora das Correntes",
            description: `A cada ${seconds(turtle.current.level2.pushWave.cooldownMs)} uma corrente forte empurra comuns ${turtle.current.level2.pushWave.distance}px para trás na rota (elites ${frac(turtle.current.level2.pushWave.eliteFactor)}; chefes recebem slow forte).`,
            cost: turtle.upgradeCosts[1],
            flowField: { ...turtle.current.level2.flowField },
            pushWave: { ...turtle.current.level2.pushWave, bossSlow: { ...turtle.current.level2.pushWave.bossSlow } },
          },
        ],
      },
    ],
  },
  stonefish: {
    id: "stonefish",
    name: "Peixe-Pedra — Emboscador do Recife",
    shortName: "Peixe-Pedra",
    description: `Armadilha na rota: leva ${seconds(stonefish.trap.armMs)} para se enterrar e emerge com ${stonefish.trap.damage} de dano em quem pisar. Quanto mais tempo armado, mais forte (até +${frac(stonefish.trap.charge.max)}).`,
    role: "Armadilha",
    color: 0x8a7a55,
    accent: 0xffd166,
    cost: stonefish.cost,
    range: stonefish.range,
    damage: stonefish.damage,
    cooldownMs: stonefish.cooldownMs,
    attackKind: "trap",
    placementMode: "route",
    blocks: false,
    trap: { ...stonefish.trap, charge: { ...stonefish.trap.charge } },
    timings: { windupMs: 120, attackMs: 300, recoveryMs: 600 },
    animation: stateProfile("stonefish", 120, 300, 60, 600),
    branches: [
      {
        id: "a",
        name: "Veneno",
        tagline: "Dano ao longo do tempo e zonas tóxicas.",
        color: 0xa4f26b,
        upgrades: [
          {
            name: "Espinhos Tóxicos",
            description: `${stonefish.venom.level1.damage} de dano e veneno de ${stonefish.venom.level1.poison.damagePerTick}/s por ${seconds(stonefish.venom.level1.poison.durationMs)} (acumula até ${stonefish.venom.level1.poison.maxStacks}×).`,
            cost: stonefish.upgradeCosts[0],
            trap: {
              ...stonefish.trap,
              damage: stonefish.venom.level1.damage,
              poison: { ...stonefish.venom.level1.poison },
              charge: { ...stonefish.trap.charge },
            },
          },
          {
            name: "Jardim Tóxico",
            description: `Libera uma nuvem tóxica (raio ${stonefish.venom.level2.cloud.radius}) por ${seconds(stonefish.venom.level2.cloud.durationMs)} que envenena todos que passam por ${seconds(stonefish.venom.level2.poison.durationMs)}.`,
            cost: stonefish.upgradeCosts[1],
            trap: {
              ...stonefish.trap,
              damage: stonefish.venom.level2.damage,
              poison: { ...stonefish.venom.level2.poison },
              cloud: { ...stonefish.venom.level2.cloud, poison: { ...stonefish.venom.level2.cloud.poison } },
              charge: { ...stonefish.trap.charge },
            },
          },
        ],
      },
      {
        id: "b",
        name: "Emboscada",
        tagline: "Controle e explosão instantânea.",
        color: 0xffb35c,
        upgrades: [
          {
            name: "Choque de Areia",
            description: `Emerge com ${stonefish.ambush.level1.damage} de dano em área e atordoa por ${seconds(stonefish.ambush.level1.stun.durationMs)} (elites ${frac(stonefish.ambush.level1.stun.eliteFactor)}, chefes ${frac(stonefish.ambush.level1.stun.bossFactor)}). A carga aumenta a duração do controle.`,
            cost: stonefish.upgradeCosts[0],
            trap: {
              ...stonefish.trap,
              damage: stonefish.ambush.level1.damage,
              stun: { ...stonefish.ambush.level1.stun },
              charge: { ...stonefish.ambush.level1.charge },
            },
          },
          {
            name: "Fúria Abissal",
            description: `Espera ${stonefish.ambush.level2.waitFor.count} inimigos (ou ${seconds(stonefish.ambush.level2.waitFor.maxWaitMs)}) e explode: ${stonefish.ambush.level2.damage} de dano, ${seconds(stonefish.ambush.level2.stun.durationMs)} de stun e empurra ${stonefish.ambush.level2.knockback.distance}px para trás na rota. Chefes: só stun reduzido.`,
            cost: stonefish.upgradeCosts[1],
            trap: {
              ...stonefish.trap,
              damage: stonefish.ambush.level2.damage,
              stun: { ...stonefish.ambush.level2.stun },
              knockback: { ...stonefish.ambush.level2.knockback },
              waitFor: { ...stonefish.ambush.level2.waitFor },
              charge: { ...stonefish.ambush.level2.charge },
            },
          },
        ],
      },
    ],
  },
  dolphin: {
    id: "dolphin",
    name: "Golfinho — Mensageiro do Recife",
    shortName: "Golfinho",
    description: `Pulso de sonar fraco (${dolphin.damage}) e, a cada ${seconds(dolphin.sonar.cooldownMs)}, uma onda que revela inimigos e deixa +${pct(dolphin.sonar.vulnerability.multiplier)} vulneráveis por ${seconds(dolphin.sonar.vulnerability.durationMs)}.`,
    role: "Suporte",
    color: 0x4aa8d8,
    accent: 0xe6f7ff,
    cost: dolphin.cost,
    range: dolphin.range,
    damage: dolphin.damage,
    cooldownMs: dolphin.cooldownMs,
    attackKind: "sonar",
    placementMode: "water",
    sonar: { ...dolphin.sonar, vulnerability: { ...dolphin.sonar.vulnerability } },
    timings: { windupMs: 260, attackMs: 220, recoveryMs: 920 },
    animation: stateProfile("dolphin", 260, 220, 90, 920),
    branches: [
      {
        id: "a",
        name: "Coro",
        tagline: "Fortalece o cardume de Guardiões.",
        color: 0xffd76a,
        upgrades: [
          {
            name: "Chamado do Cardume",
            description: `A cada ${seconds(dolphin.chorus.level1.cooldownMs)}, por ${seconds(dolphin.chorus.level1.durationMs)}: aliados ao alcance atacam ${pct(dolphin.chorus.level1.aura.attackSpeedMultiplier)} mais rápido, recarregam habilidades ${Math.round((1 - dolphin.chorus.level1.aura.abilityCooldownMultiplier) * 100)}% antes e ganham +${pct(dolphin.chorus.level1.aura.rangeMultiplier)} de alcance. +${frac(dolphin.chorus.level1.speciesBonus)} de eficiência por espécie diferente (máx. ${dolphin.chorus.level1.maxSpecies}).`,
            cost: dolphin.upgradeCosts[0],
            chorus: { ...dolphin.chorus.level1, aura: { ...dolphin.chorus.level1.aura } },
          },
          {
            name: "Maestro do Recife",
            description: `Área ${pct(dolphin.chorus.level2.radiusMultiplier)} maior e buffs melhores. Cada espécie recebe um bônus temático modesto (velocidade da investida, controle, área, dano, debuffs, rearme, projétil).`,
            cost: dolphin.upgradeCosts[1],
            chorus: { ...dolphin.chorus.level2, aura: { ...dolphin.chorus.level2.aura }, thematic: { ...dolphin.chorus.level2.thematic } },
          },
        ],
      },
      {
        id: "b",
        name: "Sonar",
        tagline: "Ecolocalização e coordenação.",
        color: 0x9b7bff,
        upgrades: [
          {
            name: "Olhos do Oceano",
            description: `Pulso ${pct(dolphin.echo.level1.radiusMultiplier)} maior: revela, marca a ameaça prioritária (chefe > elite > mais vida > mais avançado) e aplica +${pct(dolphin.echo.level1.vulnerability.multiplier)} de dano recebido por ${seconds(dolphin.echo.level1.vulnerability.durationMs)}.`,
            cost: dolphin.upgradeCosts[0],
            sonar: { ...dolphin.echo.level1, vulnerability: { ...dolphin.echo.level1.vulnerability } },
          },
          {
            name: "Oráculo das Profundezas",
            description: `Eco Perfeito: ${dolphin.echo.level2.echo.waves} ondas seguidas. Localiza, analisa (vulnerabilidade e prioridade) e coordena: Guardiões da área priorizam a maior ameaça dentro do próprio alcance por ${seconds(dolphin.echo.level2.echo.coordinateMs)}.`,
            cost: dolphin.upgradeCosts[1],
            sonar: { ...dolphin.echo.level2, vulnerability: { ...dolphin.echo.level2.vulnerability }, echo: { ...dolphin.echo.level2.echo } },
          },
        ],
      },
    ],
  },
};

/** Todos os Guardiões registrados, na ordem do catálogo. */
export const GUARDIAN_ORDER: GuardianId[] = [
  "pistol-shrimp",
  "jellyfish",
  "pufferfish",
  "reef-crab",
  "ink-octopus",
  "shark",
  "sea-turtle",
  "stonefish",
  "dolphin",
];

/** Quantos Guardiões vão para uma partida (cartas do HUD). */
export const LOADOUT_SIZE = 5;

/** Esquadrão padrão até existir a tela de seleção. */
export const DEFAULT_LOADOUT: GuardianId[] = ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"];

export function isGuardianId(value: string): value is GuardianId {
  return (GUARDIAN_ORDER as string[]).includes(value);
}

/**
 * Esquadrão a partir de `?guardians=a,b,c` (ids inválidos e repetidos são ignorados; vagas restantes são
 * preenchidas com o padrão). Sempre devolve exatamente `LOADOUT_SIZE` ids.
 */
export function resolveLoadout(query: string | null | undefined): GuardianId[] {
  const chosen: GuardianId[] = [];
  (query ?? "")
    .split(",")
    .map((token) => token.trim())
    .forEach((token) => {
      if (isGuardianId(token) && !chosen.includes(token) && chosen.length < LOADOUT_SIZE) chosen.push(token);
    });
  for (const id of DEFAULT_LOADOUT) {
    if (chosen.length >= LOADOUT_SIZE) break;
    if (!chosen.includes(id)) chosen.push(id);
  }
  return chosen;
}
