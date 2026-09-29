import type { GuardianDefinition, GuardianId, GuardianState } from "../types";
import { WEAK_POINT_FIRST } from "../core/Targeting";
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
const oyster = GUARDIAN_BALANCE.oyster;
const lantern = GUARDIAN_BALANCE.lanternfish;
const manta = GUARDIAN_BALANCE["manta-ray"];
const sword = GUARDIAN_BALANCE.swordfish;

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
            description: `${jelly.control.level1.damage} de dano e lentidão pesada: inimigos a ${Math.round(jelly.control.level1.slowFactor * 100)}% da velocidade por ${seconds(jelly.control.level1.slowDurationMs)}.`,
            cost: jelly.upgradeCosts[0],
            damage: jelly.control.level1.damage,
            slowFactor: jelly.control.level1.slowFactor,
            slowDurationMs: jelly.control.level1.slowDurationMs,
          },
          {
            name: "Paralisia",
            description: `Paralisa o alvo por ${seconds(jelly.control.level2.stun.durationMs)}. Cada inimigo só pode ser paralisado de novo após ${seconds(jelly.control.level2.stun.immunityMs)}.`,
            cost: jelly.upgradeCosts[1],
            damage: jelly.control.level2.damage,
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
    description: `Segura ${puffer.blockCapacity} inimigo por ${seconds(puffer.blockHold.durationMs)} e causa ${puffer.contactDamagePerSecond}/s de dano de contato. O agarrão tem prazo: depois de soltar, ${seconds(puffer.blockHold.releaseCooldownMs)} até poder pegar o mesmo de novo.`,
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
    blockHold: { ...puffer.blockHold, bossSlow: { ...puffer.blockHold.bossSlow } },
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
            blockHold: { ...puffer.fortress.level1.blockHold, bossSlow: { ...puffer.fortress.level1.blockHold.bossSlow } },
            contactDamagePerSecond: puffer.fortress.level1.contactDamagePerSecond,
          },
          {
            name: "Fortaleza Espinhosa",
            description: `Segura ${puffer.fortress.level2.blockCapacity} inimigos (${puffer.fortress.level2.contactDamagePerSecond}/s). Pausa chefes por ${seconds(puffer.fortress.level2.bossHold.durationMs)}; depois ficam imunes por ${seconds(puffer.fortress.level2.bossHold.immunityMs)}.`,
            cost: puffer.upgradeCosts[1],
            blockCapacity: puffer.fortress.level2.blockCapacity,
            blockHold: { ...puffer.fortress.level2.blockHold, bossSlow: { ...puffer.fortress.level2.blockHold.bossSlow } },
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
    /** V3.1: o Polvo também vive solto na água, não só agarrado à pedra. */
    altPlacementModes: ["water"],
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
        name: "Investida",
        tagline: "Bote longo: marca e executa a maior ameaça.",
        color: 0x9fc9ff,
        upgrades: [
          {
            name: "Investida Predadora",
            description: `Bote ofensivo: ${shark.alpha.level1.damage} de dano e +${pct(shark.alpha.level1.rangeMultiplier)} de alcance. A cada ${seconds(shark.alpha.level1.mark.cooldownMs)} marca pontos fracos de chefe, elites ou o inimigo mais forte ao alcance: +${pct(shark.alpha.level1.mark.damageMultiplier)} de dano contra ele por ${seconds(shark.alpha.level1.mark.durationMs)}.`,
            cost: shark.upgradeCosts[0],
            targeting: "threat",
            // O Alfa lê o campo e vai no que importa: ponto fraco de chefe antes de tudo.
            targetPriority: WEAK_POINT_FIRST,
            damage: shark.alpha.level1.damage,
            rangeMultiplier: shark.alpha.level1.rangeMultiplier,
            mark: { ...shark.alpha.level1.mark },
          },
          {
            name: "Predador Alfa",
            description: `${shark.alpha.level2.damage} de dano no bote. Golpes seguidos na presa somam +${frac(shark.alpha.level2.mark.stacking.perHit)} cada (máx. +${frac(shark.alpha.level2.mark.stacking.max)}). Se a presa cai, marca outra na hora.`,
            cost: shark.upgradeCosts[1],
            targeting: "threat",
            targetPriority: WEAK_POINT_FIRST,
            damage: shark.alpha.level2.damage,
            rangeMultiplier: shark.alpha.level2.rangeMultiplier,
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
    description: `Segura ${turtle.blockCapacity} inimigos por ${seconds(turtle.blockHold.durationMs)} e bate ${turtle.damage} de dano, deixando o alvo a ${Math.round(turtle.slowFactor * 100)}% da velocidade.`,
    role: "Controle de rota",
    color: 0x3f9a6e,
    accent: 0xd8f5c2,
    cost: turtle.cost,
    range: turtle.range,
    damage: turtle.damage,
    cooldownMs: turtle.cooldownMs,
    attackKind: "melee",
    placementMode: "route",
    blocks: true,
    blockCapacity: turtle.blockCapacity,
    blockHold: { ...turtle.blockHold, bossSlow: { ...turtle.blockHold.bossSlow } },
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
            description: `Segura até ${turtle.shell.level1.blockCapacity} inimigos comuns por ${seconds(turtle.shell.level1.blockHold.durationMs)} (elites ocupam ${turtle.shell.level1.blockHold.eliteSlots} vagas; chefes só perdem velocidade). Depois de soltar, ${seconds(turtle.shell.level1.blockHold.releaseCooldownMs)} de recarga. Não mexe na água: isso é do ramo Correnteza.`,
            cost: turtle.upgradeCosts[0],
            blocks: true,
            blockCapacity: turtle.shell.level1.blockCapacity,
            blockHold: { ...turtle.shell.level1.blockHold, bossSlow: { ...turtle.shell.level1.blockHold.bossSlow } },
          },
          {
            name: "Matriarca do Recife",
            description: `Segura até ${turtle.shell.level2.blockCapacity} comuns por ${seconds(turtle.shell.level2.blockHold.durationMs)}. Repulsa Ancestral a cada ${seconds(turtle.shell.level2.pushWave.cooldownMs)}: empurra comuns ${turtle.shell.level2.pushWave.distance}px pela rota, elites ${frac(turtle.shell.level2.pushWave.eliteFactor)}, chefes só slow.`,
            cost: turtle.upgradeCosts[1],
            blocks: true,
            blockCapacity: turtle.shell.level2.blockCapacity,
            blockHold: { ...turtle.shell.level2.blockHold, bossSlow: { ...turtle.shell.level2.blockHold.bossSlow } },
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
            description: `Zona de corrente contrária em volta: inimigos dentro dela andam a ${Math.round(turtle.current.level1.flowField.speedFactor * 100)}% da velocidade. Segura até ${turtle.current.level1.blockCapacity} inimigos por ${seconds(turtle.current.level1.blockHold.durationMs)}.`,
            cost: turtle.upgradeCosts[0],
            blocks: true,
            blockCapacity: turtle.current.level1.blockCapacity,
            blockHold: { ...turtle.current.level1.blockHold, bossSlow: { ...turtle.current.level1.blockHold.bossSlow } },
            flowField: { ...turtle.current.level1.flowField },
          },
          {
            name: "Senhora das Correntes",
            description: `A cada ${seconds(turtle.current.level2.pushWave.cooldownMs)} uma corrente forte empurra comuns ${turtle.current.level2.pushWave.distance}px para trás na rota (elites ${frac(turtle.current.level2.pushWave.eliteFactor)}; chefes recebem slow forte). Segura até ${turtle.current.level2.blockCapacity} inimigos.`,
            cost: turtle.upgradeCosts[1],
            blocks: true,
            blockCapacity: turtle.current.level2.blockCapacity,
            blockHold: { ...turtle.current.level2.blockHold, bossSlow: { ...turtle.current.level2.blockHold.bossSlow } },
            flowField: { ...turtle.current.level2.flowField },
            pushWave: { ...turtle.current.level2.pushWave, bossSlow: { ...turtle.current.level2.pushWave.bossSlow } },
          },
        ],
      },
    ],
  },
  stonefish: {
    id: "stonefish",
    name: "Peixe-Pedra — Emboscador da Corrente",
    shortName: "Peixe-Pedra",
    description: `Fica agarrado à BORDA da correnteza, camuflado de pedra. Quando alguém entra na zona à frente dele, abre os espinhos e dá o bote: ${stonefish.ambush.damage} de dano em área e veneno de ${stonefish.ambush.poison.damagePerTick}/s por ${seconds(stonefish.ambush.poison.durationMs)}. Recolhe, se camufla e repete a cada ${seconds(stonefish.ambush.cooldownMs)}.`,
    role: "Emboscada • Veneno",
    color: 0x8a7a55,
    accent: 0xffd166,
    cost: stonefish.cost,
    range: stonefish.range,
    damage: stonefish.damage,
    cooldownMs: stonefish.cooldownMs,
    attackKind: "trap",
    /** Ele não fica no meio da água: o jogo encaixa na borda mais próxima do toque. */
    placementMode: "ambush",
    blocks: false,
    trap: { ...stonefish.ambush, poison: { ...stonefish.ambush.poison } },
    timings: { windupMs: 120, attackMs: 300, recoveryMs: 600 },
    animation: stateProfile("stonefish", 120, 300, 60, 600),
    branches: [
      {
        id: "a",
        name: "Jardim Tóxico",
        tagline: "Território envenenado contra enxames.",
        color: 0xa4f26b,
        upgrades: [
          {
            name: "Toxina Viva",
            description: `${stonefish.garden.level1.damage} de dano e veneno de ${stonefish.garden.level1.poison.damagePerTick}/s por ${seconds(stonefish.garden.level1.poison.durationMs)}. O bote deixa uma nuvem de raio ${stonefish.garden.level1.cloud.radius} por ${seconds(stonefish.garden.level1.cloud.durationMs)}: quem atravessa é envenenado e anda a ${Math.round(stonefish.garden.level1.cloud.slowFactor * 100)}% da velocidade.`,
            cost: stonefish.upgradeCosts[0],
            trap: {
              ...stonefish.ambush,
              damage: stonefish.garden.level1.damage,
              triggerRadius: stonefish.garden.level1.triggerRadius,
              poison: { ...stonefish.garden.level1.poison },
              cloud: { ...stonefish.garden.level1.cloud, poison: { ...stonefish.garden.level1.cloud.poison } },
            },
          },
          {
            name: "Jardim Abissal",
            description: `Nuvem maior (raio ${stonefish.garden.level2.cloud.radius}) e mais duradoura. Quem morre envenenado dentro dela espalha a toxina num raio de ${stonefish.garden.level2.spreadOnDeath.radius} — uma vez por morte, sem reação em cadeia.`,
            cost: stonefish.upgradeCosts[1],
            trap: {
              ...stonefish.ambush,
              damage: stonefish.garden.level2.damage,
              triggerRadius: stonefish.garden.level2.triggerRadius,
              poison: { ...stonefish.garden.level2.poison },
              cloud: { ...stonefish.garden.level2.cloud, poison: { ...stonefish.garden.level2.cloud.poison } },
              spreadOnDeath: { ...stonefish.garden.level2.spreadOnDeath, poison: { ...stonefish.garden.level2.spreadOnDeath.poison } },
            },
          },
        ],
      },
      {
        id: "b",
        name: "Predador de Emboscada",
        tagline: "Zona menor, bote brutal, anti-armadura.",
        color: 0xffb35c,
        upgrades: [
          {
            name: "Espinhos Cortantes",
            description: `A zona encolhe para ${stonefish.predator.level1.triggerRadius}, mas o bote sobe para ${stonefish.predator.level1.damage} de dano IGNORANDO ARMADURA. Troca área por punição.`,
            cost: stonefish.upgradeCosts[0],
            trap: {
              ...stonefish.ambush,
              damage: stonefish.predator.level1.damage,
              triggerRadius: stonefish.predator.level1.triggerRadius,
              armorPiercing: true,
              poison: { ...stonefish.ambush.poison },
            },
          },
          {
            name: "Caçador da Corrente",
            description: `${stonefish.predator.level2.damage} de dano ignorando armadura. Quando um alvo forte entra na zona ele TRAVA a presa, carrega os espinhos em ${seconds(stonefish.predator.level2.focus.armMs)} e cobra pela vida máxima dela: +${frac(stonefish.predator.level2.focus.bonusPerMaxHealth)} dessa vida, até +${stonefish.predator.level2.focus.maxBonus} de dano.`,
            cost: stonefish.upgradeCosts[1],
            trap: {
              ...stonefish.ambush,
              damage: stonefish.predator.level2.damage,
              triggerRadius: stonefish.predator.level2.triggerRadius,
              armorPiercing: true,
              poison: { ...stonefish.ambush.poison },
              focus: { ...stonefish.predator.level2.focus },
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
    /** V3.1: como o Tubarão, ele pode encostar na beira da correnteza para alcançar mais rota. */
    altPlacementModes: ["margin"],
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
            description: `Pulso ${pct(dolphin.echo.level1.radiusMultiplier)} maior: revela, marca a ameaça prioritária (ponto fraco > elite > chefe > mais avançado) e aplica +${pct(dolphin.echo.level1.vulnerability.multiplier)} de dano recebido por ${seconds(dolphin.echo.level1.vulnerability.durationMs)}.`,
            cost: dolphin.upgradeCosts[0],
            // O Sonar identifica: ponto fraco exposto é prioridade assim que ele é revelado.
            targetPriority: WEAK_POINT_FIRST,
            sonar: { ...dolphin.echo.level1, vulnerability: { ...dolphin.echo.level1.vulnerability } },
          },
          {
            name: "Oráculo das Profundezas",
            description: `Eco Perfeito: ${dolphin.echo.level2.echo.waves} ondas seguidas. Localiza, analisa (vulnerabilidade e prioridade) e coordena: Guardiões da área priorizam a maior ameaça dentro do próprio alcance por ${seconds(dolphin.echo.level2.echo.coordinateMs)}.`,
            cost: dolphin.upgradeCosts[1],
            targetPriority: WEAK_POINT_FIRST,
            sonar: { ...dolphin.echo.level2, vulnerability: { ...dolphin.echo.level2.vulnerability }, echo: { ...dolphin.echo.level2.echo } },
          },
        ],
      },
    ],
  },
  // ── Canais Profundos (v4) ───────────────────────────────────────────────────
  oyster: {
    id: "oyster",
    name: "Ostra — Tesoureira do Canal",
    shortName: "Ostra",
    description: `Tiro de pérola fraco (${oyster.damage}) e +${oyster.income.amount} pérolas a cada ${seconds(oyster.income.intervalMs)}. Não segura a maré sozinha: paga quem segura.`,
    role: "Economia",
    color: 0xf2d7e6,
    accent: 0xfff6c8,
    cost: oyster.cost,
    range: oyster.range,
    damage: oyster.damage,
    cooldownMs: oyster.cooldownMs,
    attackKind: "projectile",
    placementMode: "platform",
    projectileSpeed: oyster.projectileSpeed,
    generatesPearls: { ...oyster.income },
    timings: { windupMs: 240, attackMs: 200, recoveryMs: 810 },
    animation: stateProfile("oyster", 240, 200, 80, 810),
    branches: [
      {
        id: "a",
        name: "Banco de Pérolas",
        tagline: "Mais renda, e juros sobre o que você guarda.",
        color: 0xffd76a,
        upgrades: [
          {
            name: "Madre Farta",
            description: `Renda sobe para +${oyster.bank.level1.income.amount} a cada ${seconds(oyster.bank.level1.income.intervalMs)}.`,
            cost: oyster.upgradeCosts[0],
            generatesPearls: { ...oyster.bank.level1.income },
          },
          {
            name: "Cofre de Nácar",
            description: `+${oyster.bank.level2.income.amount} a cada ${seconds(oyster.bank.level2.income.intervalMs)} e, no fim de cada onda, juros de ${frac(oyster.bank.level2.interest.rate)} sobre as pérolas GUARDADAS (até ${oyster.bank.level2.interest.cap} por onda).`,
            cost: oyster.upgradeCosts[1],
            generatesPearls: { ...oyster.bank.level2.income },
            interest: { ...oyster.bank.level2.interest },
          },
        ],
      },
      {
        id: "b",
        name: "Madrepérola",
        tagline: "A pérola vira projétil de verdade.",
        color: 0xb8a2ff,
        upgrades: [
          {
            name: "Pérola Afiada",
            description: `${oyster.nacre.level1.damage} de dano que IGNORA armadura. A renda continua a de base.`,
            cost: oyster.upgradeCosts[0],
            damage: oyster.nacre.level1.damage,
            cooldownMs: oyster.nacre.level1.cooldownMs,
            armorPiercing: true,
          },
          {
            name: "Pérola Negra",
            description: `${oyster.nacre.level2.damage} de dano perfurante e estilhaços num raio de ${oyster.nacre.level2.splash.radius} (${frac(oyster.nacre.level2.splash.damageMultiplier)} do dano).`,
            cost: oyster.upgradeCosts[1],
            damage: oyster.nacre.level2.damage,
            cooldownMs: oyster.nacre.level2.cooldownMs,
            armorPiercing: true,
            splash: { ...oyster.nacre.level2.splash },
          },
        ],
      },
    ],
  },
  lanternfish: {
    id: "lanternfish",
    name: "Peixe-Lanterna — Farol das Profundezas",
    shortName: "Lanterna",
    description: `Luz de ${frac(lantern.light.radiusMultiplier)} do alcance: revela camuflados o tempo todo e ACENDE os Guardiões dentro dela, que enxergam através da névoa. Ataque fraco (${lantern.damage}).`,
    role: "Visão",
    color: 0x2c6fa8,
    accent: 0xfff27a,
    cost: lantern.cost,
    range: lantern.range,
    damage: lantern.damage,
    cooldownMs: lantern.cooldownMs,
    attackKind: "projectile",
    placementMode: "water",
    altPlacementModes: ["margin"],
    projectileSpeed: lantern.projectileSpeed,
    light: { ...lantern.light },
    timings: { windupMs: 160, attackMs: 160, recoveryMs: 630 },
    animation: stateProfile("lanternfish", 160, 160, 60, 630),
    branches: [
      {
        id: "a",
        name: "Isca",
        tagline: "A luz que prende o olhar.",
        color: 0xffe36a,
        upgrades: [
          {
            name: "Isca Luminosa",
            description: `A cada ${seconds(lantern.lure.level1.lure.cooldownMs)}, os ${lantern.lure.level1.lure.maxTargets} inimigos mais adiantados na luz ficam FASCINADOS por ${seconds(lantern.lure.level1.lure.durationMs)} (andam a ${frac(lantern.lure.level1.lure.slowFactor)}). Chefes não caem.`,
            cost: lantern.upgradeCosts[0],
            damage: lantern.lure.level1.damage,
            lure: { ...lantern.lure.level1.lure },
          },
          {
            name: "Abismo Hipnótico",
            description: `Fascina até ${lantern.lure.level2.lure.maxTargets} a cada ${seconds(lantern.lure.level2.lure.cooldownMs)}, por ${seconds(lantern.lure.level2.lure.durationMs)}, e quem olhou para a luz recebe +${pct(lantern.lure.level2.lure.vulnerability.multiplier)} de dano por ${seconds(lantern.lure.level2.lure.vulnerability.durationMs)}.`,
            cost: lantern.upgradeCosts[1],
            damage: lantern.lure.level2.damage,
            lure: { ...lantern.lure.level2.lure, vulnerability: { ...lantern.lure.level2.lure.vulnerability } },
          },
        ],
      },
      {
        id: "b",
        name: "Farol",
        tagline: "Clareia o caminho de todo o esquadrão.",
        color: 0x7fe7ff,
        upgrades: [
          {
            name: "Farol do Canal",
            description: `Luz ${pct(lantern.beacon.level1.light.radiusMultiplier / lantern.light.radiusMultiplier)} maior, e os Guardiões no alcance dele ganham +${pct(lantern.beacon.level1.aura.rangeMultiplier)} de alcance.`,
            cost: lantern.upgradeCosts[0],
            damage: lantern.beacon.level1.damage,
            light: { ...lantern.beacon.level1.light },
            aura: { ...lantern.beacon.level1.aura },
          },
          {
            name: "Estrela do Fundo",
            description: `A maior luz dos Canais. Aliados no alcance: +${pct(lantern.beacon.level2.aura.rangeMultiplier)} de alcance e +${pct(lantern.beacon.level2.aura.damageMultiplier)} de dano.`,
            cost: lantern.upgradeCosts[1],
            damage: lantern.beacon.level2.damage,
            light: { ...lantern.beacon.level2.light },
            aura: { ...lantern.beacon.level2.aura },
          },
        ],
      },
    ],
  },
  "manta-ray": {
    id: "manta-ray",
    name: "Arraia-Manta — Asa do Canal",
    shortName: "Arraia",
    description: `Voo rasante: ${manta.damage} de dano em TODOS numa faixa de ${manta.sweep.width} px entre ela e o alvo, e lentidão (${frac(manta.slowFactor)} da velocidade) por ${seconds(manta.slowDurationMs)}.`,
    role: "Controle em área",
    color: 0x3b4f7a,
    accent: 0x9fe3ff,
    cost: manta.cost,
    range: manta.range,
    damage: manta.damage,
    cooldownMs: manta.cooldownMs,
    attackKind: "sweep",
    placementMode: "water",
    altPlacementModes: ["margin"],
    slowFactor: manta.slowFactor,
    slowDurationMs: manta.slowDurationMs,
    lance: { ...manta.sweep },
    timings: { windupMs: 320, attackMs: 280, recoveryMs: 1000 },
    animation: stateProfile("manta", 320, 280, 140, 1000),
    branches: [
      {
        id: "a",
        name: "Planar",
        tagline: "Vai aonde a maré precisa dela.",
        color: 0x8ff0ff,
        upgrades: [
          {
            name: "Asa Longa",
            description: `${manta.glide.level1.damage} de dano numa faixa maior. PLANA: uma vez por onda, selecione a Arraia e toque na água para ela mudar de lugar, de graça.`,
            cost: manta.upgradeCosts[0],
            damage: manta.glide.level1.damage,
            lance: { ...manta.glide.level1.sweep },
            relocate: true,
          },
          {
            name: "Rainha das Correntes",
            description: `${manta.glide.level2.damage} de dano, faixa de ${manta.glide.level2.sweep.width} px e lentidão mais forte (${frac(manta.glide.level2.slowFactor)}). Continua planando uma vez por onda.`,
            cost: manta.upgradeCosts[1],
            damage: manta.glide.level2.damage,
            slowFactor: manta.glide.level2.slowFactor,
            slowDurationMs: manta.glide.level2.slowDurationMs,
            lance: { ...manta.glide.level2.sweep },
            relocate: true,
          },
        ],
      },
      {
        id: "b",
        name: "Arrasto",
        tagline: "A asa que devolve a maré.",
        color: 0x5a7dff,
        upgrades: [
          {
            name: "Batida de Asa",
            description: `A cada ${seconds(manta.drag.level1.pushWave.cooldownMs)}, empurra ${manta.drag.level1.pushWave.distance} px para trás quem estiver no alcance (elites pela metade; chefes só ficam lentos).`,
            cost: manta.upgradeCosts[0],
            damage: manta.drag.level1.damage,
            pushWave: { ...manta.drag.level1.pushWave, bossSlow: { ...manta.drag.level1.pushWave.bossSlow } },
          },
          {
            name: "Maré de Volta",
            description: `Empurrão de ${manta.drag.level2.pushWave.distance} px a cada ${seconds(manta.drag.level2.pushWave.cooldownMs)} e ${manta.drag.level2.damage} de dano na faixa.`,
            cost: manta.upgradeCosts[1],
            damage: manta.drag.level2.damage,
            pushWave: { ...manta.drag.level2.pushWave, bossSlow: { ...manta.drag.level2.pushWave.bossSlow } },
          },
        ],
      },
    ],
  },
  swordfish: {
    id: "swordfish",
    name: "Peixe-Espada — Lâmina do Canal",
    shortName: "Espada",
    description: `Estocada de ${sword.damage} em LINHA RETA: atravessa até ${sword.lance.maxTargets} inimigos na fila, do alvo para trás. Lento para recarregar (${seconds(sword.cooldownMs)}).`,
    role: "Perfuração",
    color: 0x5c7fa3,
    accent: 0xd8f1ff,
    cost: sword.cost,
    range: sword.range,
    damage: sword.damage,
    cooldownMs: sword.cooldownMs,
    attackKind: "lance",
    placementMode: "margin",
    dash: true,
    lance: { ...sword.lance },
    timings: { windupMs: 360, attackMs: 220, recoveryMs: 1520 },
    animation: stateProfile("swordfish", 360, 220, 120, 1520),
    branches: [
      {
        id: "a",
        name: "Estocada",
        tagline: "Ninguém sai da fila com pouca vida.",
        color: 0xffb35a,
        upgrades: [
          {
            name: "Golpe de Misericórdia",
            description: `${sword.thrust.level1.damage} de dano e EXECUTA quem não é chefe e ficar abaixo de ${frac(sword.thrust.level1.execute.threshold)} de vida. Atravessa até ${sword.thrust.level1.lance.maxTargets}.`,
            cost: sword.upgradeCosts[0],
            damage: sword.thrust.level1.damage,
            execute: { ...sword.thrust.level1.execute },
            lance: { ...sword.thrust.level1.lance },
          },
          {
            name: "Lâmina Longa",
            description: `${sword.thrust.level2.damage} de dano, estocada mais longa (até ${sword.thrust.level2.lance.maxTargets} alvos) e execução abaixo de ${frac(sword.thrust.level2.execute.threshold)}.`,
            cost: sword.upgradeCosts[1],
            damage: sword.thrust.level2.damage,
            cooldownMs: sword.thrust.level2.cooldownMs,
            execute: { ...sword.thrust.level2.execute },
            lance: { ...sword.thrust.level2.lance },
          },
        ],
      },
      {
        id: "b",
        name: "Esgrimista",
        tagline: "O duelo contra o que é grande.",
        color: 0xff6a8a,
        upgrades: [
          {
            name: "Guarda Alta",
            description: `${sword.duelist.level1.damage} de dano que ignora armadura, +${pct(sword.duelist.level1.duelist.eliteMultiplier)} contra elite, +${pct(sword.duelist.level1.duelist.bossMultiplier)} contra chefe, e ROMPE o escudo da Tartaruga Corrompida.`,
            cost: sword.upgradeCosts[0],
            damage: sword.duelist.level1.damage,
            armorPiercing: true,
            duelist: { ...sword.duelist.level1.duelist },
          },
          {
            name: "Mestre de Esgrima",
            description: `${sword.duelist.level2.damage} de dano perfurante, +${pct(sword.duelist.level2.duelist.eliteMultiplier)} contra elite e +${pct(sword.duelist.level2.duelist.bossMultiplier)} contra chefe.`,
            cost: sword.upgradeCosts[1],
            damage: sword.duelist.level2.damage,
            cooldownMs: sword.duelist.level2.cooldownMs,
            armorPiercing: true,
            duelist: { ...sword.duelist.level2.duelist },
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
  "oyster",
  "lanternfish",
  "manta-ray",
  "swordfish",
];

/** Quantos Guardiões vão para uma partida (cartas do HUD). */
export const LOADOUT_SIZE = 5;

/** Esquadrão inicial: os cinco Guardiões que já vivem no Recife. */
export const DEFAULT_LOADOUT: GuardianId[] = ["pistol-shrimp", "jellyfish", "pufferfish", "reef-crab", "ink-octopus"];

export function isGuardianId(value: string): value is GuardianId {
  return (GUARDIAN_ORDER as string[]).includes(value);
}

export interface LoadoutOptions {
  /** Guardiões que o jogador já encontrou; ausente = qualquer um vale (testes e balanceamento). */
  unlocked?: readonly GuardianId[];
  /** Esquadrão preferido (o último usado), tentado antes do padrão. */
  fallback?: readonly GuardianId[];
}

/**
 * Esquadrão a partir de `?guardians=a,b,c` (ids inválidos e repetidos são ignorados; vagas restantes
 * vêm do último esquadrão e depois do padrão). Sempre devolve exatamente `LOADOUT_SIZE` ids.
 * Com `unlocked`, só entram Guardiões já desbloqueados — exceto os pedidos explicitamente na URL,
 * que continuam valendo para testes e sondas de balanceamento.
 */
export function resolveLoadout(query: string | null | undefined, options: LoadoutOptions = {}): GuardianId[] {
  const chosen: GuardianId[] = [];
  const add = (id: GuardianId): void => {
    if (!chosen.includes(id) && chosen.length < LOADOUT_SIZE) chosen.push(id);
  };
  (query ?? "")
    .split(",")
    .map((token) => token.trim())
    .forEach((token) => {
      if (isGuardianId(token)) add(token);
    });
  const allowed = (id: GuardianId): boolean => !options.unlocked || options.unlocked.includes(id);
  for (const id of options.fallback ?? []) if (allowed(id)) add(id);
  for (const id of DEFAULT_LOADOUT) if (allowed(id)) add(id);
  // Último recurso (todos os padrões bloqueados, caso de save estranho): completa com o catálogo.
  for (const id of GUARDIAN_ORDER) if (allowed(id)) add(id);
  return chosen;
}
