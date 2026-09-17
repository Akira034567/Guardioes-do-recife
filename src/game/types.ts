import type { StatusType } from "./core/StatusEffects";
import type { TargetingShape } from "./core/TargetingShape";
import type { TargetTier } from "./core/Targeting";
import type { WeakPointPlan } from "./core/WeakPoints";
import type { EliteId } from "./data/elites";

export interface Vec2 {
  x: number;
  y: number;
}

/** Identidade de um jogador na partida ("p1" hoje; coop futuro usa vários). */
export type PlayerId = string;
/** Time de um jogador: quem compartilha o Recife (vidas). */
export type TeamId = string;

export type GuardianId =
  | "pistol-shrimp"
  | "jellyfish"
  | "pufferfish"
  | "reef-crab"
  | "ink-octopus"
  | "shark"
  | "sea-turtle"
  | "stonefish"
  | "dolphin";
export type EnemyId =
  | "minnow"
  | "swimmer"
  | "dartfish"
  | "needlefish"
  | "ghostJelly"
  | "shellback"
  | "moray"
  | "corruptedShark"
  | "tidebreaker";
export type EnemyRole = "swarm" | "common" | "fast" | "armored" | "elite" | "boss";
export type GuardianState = "idle" | "windup" | "attack" | "recovery" | "disabled";
/**
 * projectile: dispara um projétil físico (Camarão).
 * chain: descarga instantânea que pode saltar entre alvos (Água-viva).
 * area: pulso que atinge todos no alcance (Baiacu).
 * melee: golpe curto no alvo mais avançado; com `areaAttack` atinge todos no alcance (Caranguejo).
 * ink: jato instantâneo que aplica debuff (Polvo).
 * trap: não ataca pela FSM; a armadilha (`TrapCore`) dispara quando inimigos pisam nela (Peixe-Pedra).
 * sonar: golpe fraco de alvo único mais pulso periódico de ecolocalização (Golfinho).
 */
export type AttackKind = "projectile" | "chain" | "area" | "melee" | "ink" | "trap" | "sonar";
/**
 * platform: plataforma de pedra da fase; water: água livre longe da rota; route: em cima da correnteza;
 * margin: faixa de água colada à rota (ver `PLACEMENT` em `balance.ts`).
 */
export type PlacementMode = "platform" | "water" | "route" | "margin";
export type BranchId = "a" | "b";
/**
 * Política de escolha de alvo (ver `core/Targeting.ts`):
 * leading: mais avançado na rota; lowestHealth: menos vida; wounded: abaixo do limiar de vida primeiro,
 * depois o mais avançado; threat: chefe > elite > mais vida máxima > mais avançado.
 */
export type TargetPolicyMode = "leading" | "lowestHealth" | "wounded" | "threat";
/** Camada de resistência a controle: comuns não resistem; elites e chefes têm retornos decrescentes. */
export type ControlTier = "common" | "elite" | "boss";

export interface GuardianStateTimings {
  windupMs: number;
  attackMs: number;
  recoveryMs: number;
}

export interface GuardianAnimationState {
  key: string;
  loop: boolean;
  durationMs: number;
}

export interface GuardianAnimationProfile {
  states: Record<GuardianState, GuardianAnimationState>;
  impactAtMs: number;
}

export interface VulnerabilityEffect {
  /** Multiplicador de dano recebido (1.15 = +15%). Não acumula: vale o maior ativo. */
  multiplier: number;
  durationMs: number;
  /** Raio opcional para aplicar o debuff em pequena área ao redor do alvo. */
  radius?: number;
}

export interface ElectricFieldEffect {
  radius: number;
  durationMs: number;
  cooldownMs: number;
  pulseIntervalMs: number;
  damage: number;
  /** Teto de dano que um mesmo campo pode causar a um mesmo inimigo. */
  maxDamagePerTarget: number;
  slowFactor: number;
  slowDurationMs: number;
}

export interface InkCloudEffect {
  radius: number;
  durationMs: number;
  cooldownMs: number;
  slowFactor: number;
  vulnerabilityMultiplier: number;
}

/**
 * Aura completa recebida por um Guardião. Auras não acumulam: para cada atributo vale o melhor valor
 * entre as fontes ao alcance (1 = neutro; multiplicadores de cooldown/rearme menores que 1 são bônus).
 */
export interface ResolvedAura {
  /** 1.10 = ataca 10% mais rápido. */
  attackSpeedMultiplier: number;
  rangeMultiplier: number;
  /** Multiplica cooldowns de habilidades (0.9 = 10% de redução). */
  abilityCooldownMultiplier: number;
  damageMultiplier: number;
  /** Duração de stun/bloqueio/knockback causados pelo Guardião. */
  controlDurationMultiplier: number;
  /** Duração de slow/vulnerabilidade/veneno causados pelo Guardião. */
  debuffDurationMultiplier: number;
  projectileSpeedMultiplier: number;
  /** Tempo de rearme de armadilhas. */
  rearmMultiplier: number;
  /** Velocidade visual da investida do Tubarão. */
  dashSpeedMultiplier: number;
}

/** Aura declarada nos dados: só os campos que a fonte altera. */
export type AuraEffect = Partial<ResolvedAura>;

export interface BossSlow {
  factor: number;
  durationMs: number;
}

/** Tubarão, ramo Frenesi: velocidade de ataque extra contra alvos feridos. */
export interface FrenzyEffect {
  /** Fração de vida (0.4 = 40%) abaixo da qual o alvo conta como ferido. */
  healthThreshold: number;
  /** Bônus quando o alvo atual está ferido (0.35 = +35%). */
  attackSpeedBonus: number;
  /** Frenesi II: bônus adicional por inimigo ferido ao alcance. */
  perWoundedBonus?: number;
  /** Teto do bônus total. */
  maxBonus?: number;
}

/** Tubarão, ramo Caçador Alfa: marca a presa mais perigosa ao alcance. */
export interface MarkEffect {
  damageMultiplier: number;
  durationMs: number;
  cooldownMs: number;
  /** Alfa II: dano extra acumulado por golpe seguido na mesma presa. */
  stacking?: { perHit: number; max: number };
  /** Alfa II: ao perder a presa, marca outra imediatamente (ignora o cooldown). */
  rearmOnDeath?: boolean;
}

/** Tartaruga, ramo Casco: bloqueio temporário com cooldown de liberação. */
export interface BlockHoldEffect {
  durationMs: number;
  releaseCooldownMs: number;
  /** Quantas vagas um elite ocupa. */
  eliteSlots: number;
  /** Chefes não ficam presos: só sofrem este slow ao encostar. */
  bossSlow: BossSlow;
}

/**
 * Geração periódica de pérolas (item 1). Prepara o Guardião OSTRA: basta declarar isto numa definição
 * ou num upgrade para a unidade render pérolas durante a partida.
 */
export interface PearlGeneration {
  amount: number;
  intervalMs: number;
}

/** Zona ambiental circular presa ao Guardião que altera a velocidade da água (ver `core/FlowField.ts`). */
export interface FlowFieldEffect {
  /** Raio = alcance × este fator. */
  radiusMultiplier: number;
  /** Multiplicador de velocidade dentro da zona (0.75 = -25%). */
  speedFactor: number;
}

/** Onda periódica que empurra inimigos para trás ao longo da rota (Repulsa Ancestral / Corrente Forte). */
export interface PushWaveEffect {
  cooldownMs: number;
  /** Deslocamento para trás em pixels de rota (inimigos comuns). */
  distance: number;
  /** Fração do deslocamento aplicada a elites. */
  eliteFactor: number;
  /** Chefes não são empurrados: só sofrem este slow. */
  bossSlow: BossSlow;
  /** Duração do efeito visual. */
  visualMs: number;
}

export interface PoisonEffect {
  damagePerTick: number;
  tickMs: number;
  durationMs: number;
  /** Teto de acúmulos (renovar duração acima disso). */
  maxStacks: number;
}

export interface ToxicCloudEffect {
  radius: number;
  durationMs: number;
  poison: PoisonEffect;
}

export interface TrapStun {
  durationMs: number;
  eliteFactor: number;
  bossFactor: number;
}

/** Peixe-Pedra: armadilha enterrada na rota. */
export interface TrapEffect {
  /** Tempo para se enterrar e armar após ser colocado ou após o cooldown. */
  armMs: number;
  cooldownMs: number;
  /** Raio, em pixels de rota, em que inimigos acionam a armadilha. */
  triggerRadius: number;
  damage: number;
  poison?: PoisonEffect;
  cloud?: ToxicCloudEffect;
  stun?: TrapStun;
  knockback?: { distance: number; eliteFactor: number };
  /**
   * Quando disparar: a armadilha segura o tiro enquanto o grupo se forma e solta pouco antes de o
   * primeiro inimigo escapar do raio — o instante com mais gente dentro.
   *
   * `exitMargin` é a folga em pixels: com raio 65 e margem 12, ela dispara quando o mais avançado
   * está a 53 px dela, faltando 12 para sair. `maxHoldMs` evita a espera eterna quando ninguém anda
   * (um bloqueador segurando a fila em cima da armadilha).
   */
  exitTrigger?: { exitMargin: number; maxHoldMs: number };
  /** Quanto mais tempo armado, maior o próximo efeito: `+bonus` a cada `everyMs`, até `max`. */
  charge: { everyMs: number; bonus: number; max: number; applyTo: "damage" | "control" };
}

/** Golfinho: pulso de ecolocalização. */
export interface SonarEffect {
  cooldownMs: number;
  /** Raio = alcance × este fator. */
  radiusMultiplier: number;
  revealMs: number;
  vulnerability: { multiplier: number; durationMs: number };
  /** Sonar I: marca a ameaça prioritária (chefe > elite > mais vida > mais avançado). */
  markPriority?: boolean;
  /** Sonar II (Eco Perfeito): três ondas; a última coordena Guardiões da área por `coordinateMs`. */
  echo?: { waves: number; intervalMs: number; coordinateMs: number };
}

/** Golfinho, ramo Coro: buff temporizado em Guardiões próximos. */
export interface ChorusEffect {
  durationMs: number;
  cooldownMs: number;
  /** Raio = alcance × este fator. */
  radiusMultiplier: number;
  /** Bônus base; cada parte acima de 1 é multiplicada pela eficiência. */
  aura: AuraEffect;
  /** Eficiência extra por espécie diferente de Guardião na área (0.02 = +2%). */
  speciesBonus: number;
  maxSpecies: number;
  /** Coro II: bônus temático por espécie. */
  thematic?: Partial<Record<GuardianId, AuraEffect>>;
}

/** Resistência de elites/chefes a controle: cada controle na janela vale `steps[n]`; depois, imunidade. */
export interface ControlResistance {
  windowMs: number;
  steps: readonly number[];
  immunityMs: number;
}

/**
 * Um passo de upgrade. Valores absolutos (damage, cooldownMs) substituem a base;
 * multiplicadores compõem. Campos ausentes mantêm o comportamento anterior.
 */
export interface GuardianUpgrade {
  name: string;
  description: string;
  cost: number;
  damage?: number;
  cooldownMs?: number;
  rangeMultiplier?: number;
  projectileSpeedMultiplier?: number;
  predictiveAim?: boolean;
  /** Dano de cada acerto sucessivo de um mesmo projétil (perfuração/ricochete). */
  pierceDamages?: number[];
  /** Após atravessar um alvo, segue em linha reta até o próximo alvo ainda não atingido. */
  straightRicochet?: boolean;
  splash?: { radius: number; damageMultiplier: number };
  /** Dano de cada salto da descarga elétrica. */
  chainDamages?: number[];
  slowFactor?: number;
  slowDurationMs?: number;
  stun?: { durationMs: number; immunityMs: number };
  electricField?: ElectricFieldEffect;
  blockCapacity?: number;
  contactDamagePerSecond?: number;
  /** Segura um chefe por pouco tempo; depois ele fica imune a novas pausas. */
  bossHold?: { durationMs: number; immunityMs: number };
  armorPiercing?: boolean;
  vulnerability?: VulnerabilityEffect;
  areaAttack?: boolean;
  spin?: { everyAttacks: number; damage: number; radiusMultiplier: number };
  inkCloud?: InkCloudEffect;
  aura?: AuraEffect;
  /** Passa a bloquear a rota (Tartaruga, ramo Casco). Só vale em `placementMode` "route". */
  blocks?: boolean;
  targeting?: TargetPolicyMode;
  /** Forma do alcance (item 18); ausente = radial. */
  targetingShape?: TargetingShape;
  /**
   * Ordem de categorias de alvo (item 12). Genérico: o Guardião pede `WEAK_POINT_FIRST`, e quem
   * é ponto fraco de quem é problema dos dados do inimigo, não daqui.
   */
  targetPriority?: readonly TargetTier[];
  /** Passa a render pérolas periodicamente (Ostra e afins). */
  generatesPearls?: PearlGeneration;
  frenzy?: FrenzyEffect;
  mark?: MarkEffect;
  blockHold?: BlockHoldEffect;
  flowField?: FlowFieldEffect;
  pushWave?: PushWaveEffect;
  trap?: TrapEffect;
  sonar?: SonarEffect;
  chorus?: ChorusEffect;
}

export interface UpgradeBranch {
  id: BranchId;
  name: string;
  tagline: string;
  color: number;
  upgrades: [GuardianUpgrade, GuardianUpgrade];
}

export interface GuardianDefinition {
  id: GuardianId;
  name: string;
  shortName: string;
  description: string;
  role: string;
  color: number;
  accent: number;
  cost: number;
  range: number;
  damage: number;
  cooldownMs: number;
  attackKind: AttackKind;
  placementMode: PlacementMode;
  /**
   * Modos ACEITOS além do principal. O Golfinho aceita água e margem; o Polvo, plataforma e água.
   * A ordem importa: `placementMode` é o que o HUD sugere e o que o fantasma desenha por padrão.
   */
  altPlacementModes?: readonly PlacementMode[];
  /** Apenas para placementMode "route": se a unidade segura inimigos. */
  blocks?: boolean;
  blockCapacity?: number;
  /** Bloqueio com prazo já na versão base (Baiacu e Tartaruga, desde a V3.1). */
  blockHold?: BlockHoldEffect;
  contactDamagePerSecond?: number;
  projectileSpeed?: number;
  slowFactor?: number;
  slowDurationMs?: number;
  vulnerability?: VulnerabilityEffect;
  targeting?: TargetPolicyMode;
  /** Forma do alcance (item 18); ausente = radial, como todos os Guardiões atuais. */
  targetingShape?: TargetingShape;
  /**
   * Ordem de categorias de alvo (item 12). Genérico: o Guardião pede `WEAK_POINT_FIRST`, e quem
   * é ponto fraco de quem é problema dos dados do inimigo, não daqui.
   */
  targetPriority?: readonly TargetTier[];
  /** Rende pérolas periodicamente durante a partida (nenhum Guardião atual usa). */
  generatesPearls?: PearlGeneration;
  /** Investida visual curta até o alvo e volta (Tubarão). */
  dash?: boolean;
  trap?: TrapEffect;
  sonar?: SonarEffect;
  timings: GuardianStateTimings;
  animation: GuardianAnimationProfile;
  branches: [UpgradeBranch, UpgradeBranch];
}

/** Categorias de inimigo (item 5). Um inimigo pode ter várias; elites e chefes acumulam a própria. */
/**
 * `WEAK_POINT` e `PRIORITY_TARGET` são GENÉRICOS de propósito (item 12): marcam qualquer entidade
 * que alguns Guardiões devem priorizar — o coral da baleia hoje, o que vier em chefes futuros.
 * Nenhum código de mira sabe de que chefe elas são.
 */
export type EnemyTag =
  | "NORMAL"
  | "FAST"
  | "TANK"
  | "SWARM"
  | "ARMORED"
  | "STEALTH"
  | "SUPPORT"
  | "ELITE"
  | "BOSS"
  | "WEAK_POINT"
  | "PRIORITY_TARGET";
/** Formas vetoriais disponíveis para inimigos sem sprite (o antigo `switch` por id em `Enemy.drawBody`). */
export type EnemyShapeKey = "fish" | "minnow" | "dart" | "needle" | "shell" | "moray" | "shark" | "boss";

export type EnemyArtRef =
  | { kind: "procedural"; shape: EnemyShapeKey }
  /** Pasta em `public/assets/enemies/<folder>/frame-N.png`; cai para a forma vetorial se a textura faltar. */
  | {
      kind: "sprite";
      folder: string;
      frames: number;
      frameMs?: number;
      scale?: number;
      /**
       * Para que lado a criatura foi desenhada; a view espelha quando ela nada para o outro.
       * AUSENTE SIGNIFICA `"right"`: é assim que a prancha inteira foi desenhada.
       */
      facing?: "left" | "right";
      /**
       * `path` (padrão) inclina a criatura ao longo da rota, como um peixe visto de cima.
       * `upright` mantém o desenho em pé e só espelha: para bichos que andam no leito (caranguejo).
       */
      rotate?: "path" | "upright";
      /**
       * Quadros do ciclo de nado normal (1-based). Ausente = todos. Existe para separar a animação
       * contínua dos quadros que só aparecem num momento específico — ver `guard`.
       */
      loopFrames?: number[];
      /** Quadros da pose de defesa (concha fechada, casco recolhido). */
      guardFrames?: number[];
      /**
       * Quando a criatura se recolhe. É só apresentação: não muda regra nenhuma do motor.
       * O Cascudo alternava os quatro quadros em rodízio cego, então fechava a concha a cada 800ms
       * e parecia estar piscando em vez de se defender.
       */
      guard?: {
        trigger: "damage" | "interval" | "both";
        /** Quanto tempo fica recolhido. */
        holdMs: number;
        /** Intervalo mínimo entre dois recolhimentos, para o dano em rajada não virar estrobo. */
        cooldownMs: number;
        /** Média do recolhimento espontâneo, quando `trigger` inclui `interval`. */
        idleIntervalMs?: number;
        /** Variação em torno da média, para os bichos não se recolherem em uníssono. */
        idleJitterMs?: number;
      };
      shapeFallback?: EnemyShapeKey;
    };

/** Multiplicadores de atributos (elites, fases de chefe). `armorBonus` é aditivo. */
export interface StatMultipliers {
  maxHealth?: number;
  speed?: number;
  reward?: number;
  reefDamage?: number;
  scale?: number;
  armorBonus?: number;
}

/** Resistências por tipo de status: 0..1 = fração ignorada. `slow` substitui o antigo `slowResistance`. */
export type StatusResistanceMap = Partial<Record<StatusType, number>>;

/**
 * Habilidades de inimigo como componentes reutilizáveis (item 6). O motor despacha por `type`
 * (`core/EnemyAbilities.ts`); nenhum código olha o id do inimigo.
 */
export type EnemyAbility =
  | { type: "regen"; hpPerSecond: number; delayAfterHitMs?: number; maxFraction?: number }
  | { type: "enrageBelowHp"; threshold: number; speedMultiplier?: number; armorBonus?: number; reefDamageBonus?: number }
  | { type: "shieldAllies"; radius: number; damageReduction: number; onlyTags?: EnemyTag[] }
  | { type: "disruptGuardians"; radius: number; intervalMs: number; attackSpeedMultiplier: number; durationMs: number }
  /**
   * Camuflagem. `untilDamaged`: um acerto qualquer já o expõe. `revealOnBlock`: encostar num
   * bloqueador da rota o expõe DE VEZ — é a porta que não depende do Golfinho.
   */
  | { type: "stealth"; untilDamaged?: boolean; revealOnBlock?: boolean }
  | { type: "splitOnDeath"; enemyId: EnemyId; count: number; spreadPx?: number }
  | { type: "phaseChangeAtHp"; threshold: number; statMultipliers?: StatMultipliers; addAbilities?: EnemyAbility[]; announcement?: string }
  | { type: "speedBurst"; intervalMs: number; durationMs: number; multiplier: number }
  /** Quebra-Marés: inverte as correntes reversíveis do mapa em ciclo (um ciclo compartilhado por todos os donos vivos). */
  /**
   * Quebra-Marés: em ciclos, a Baleia AMPLIFICA a corrente natural do mapa (nunca inverte, e nunca
   * toca nas correntes criadas por Guardiões — veja `CurrentZone.amplifiable`).
   */
  | { type: "amplifyCurrents"; cycleMs: number; surgeMs: number; strengthMultiplier: number; driftMultiplier: number };

export interface BossPhase {
  id: string;
  name?: string;
  /** Entra quando `health / maxHealth <= hpThreshold` (a primeira fase usa 1). */
  hpThreshold: number;
  announcement?: string;
  statMultipliers?: StatMultipliers;
  addAbilities?: EnemyAbility[];
  removeAbilityTypes?: EnemyAbility["type"][];
}

/** Encontro de chefe (item 8): fases por vida, barra própria e recompensa extra. */
export interface BossDefinition {
  title?: string;
  phases: BossPhase[];
  healthBar?: { segments?: number; color?: number };
  rewards?: { pearls?: number };
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
  role: EnemyRole;
  color: number;
  accent: number;
  maxHealth: number;
  speed: number;
  reward: number;
  armor: number;
  reefDamage: number;
  hitRadius: number;
  scale: number;
  isBoss?: boolean;
  /** Ignora bloqueios de rota (chefes). */
  unblockable?: boolean;
  /** 0..1: fração da lentidão ignorada (0.5 = sofre metade do slow). Atalho para `resistances.slow`. */
  slowResistance?: number;
  // ---- v2 (todos opcionais; ausente = comportamento atual; ver `resolveEnemy`) ----
  description?: string;
  art?: EnemyArtRef;
  tags?: EnemyTag[];
  resistances?: StatusResistanceMap;
  immunities?: StatusType[];
  /** 0 comum · 1 blindado · 2 elite · 3 chefe (preview de onda e bestiário). */
  threatLevel?: number;
  abilities?: EnemyAbility[];
  /**
   * Pontos fracos presos ao corpo (item 11). Ligado por dificuldade em `resolveLevelForDifficulty`,
   * não escrito à mão no catálogo: no Normal o chefe não tem nenhum.
   */
  weakPoints?: WeakPointPlan;
  boss?: BossDefinition;
  /** Preenchidos por `applyElite`; nunca escritos à mão. */
  eliteId?: string;
  baseId?: EnemyId;
}

/** `EnemyDefinition` com todos os campos v2 preenchidos (`resolveEnemy`). */
export interface ResolvedEnemyDefinition extends EnemyDefinition {
  description: string;
  art: EnemyArtRef;
  tags: EnemyTag[];
  resistances: StatusResistanceMap;
  immunities: StatusType[];
  threatLevel: number;
  abilities: EnemyAbility[];
}

export interface WaveGroupDefinition {
  enemyId: EnemyId;
  count: number;
  /** Intervalo entre spawns do grupo (alias de autoria: `spawnInterval`). */
  intervalMs?: number;
  spawnInterval?: number;
  /** Atraso do primeiro spawn dentro da onda (alias de autoria: `spawnDelay`). */
  delayMs?: number;
  spawnDelay?: number;
  /** Rota deste grupo; ausente = rota principal (`paths[0]`, hoje `waypoints`). */
  pathId?: string;
  /** Variação de elite aplicada aos spawns (item 7); uma lista sorteia entre elas por ordem. */
  elite?: EliteId | EliteId[];
  /** Índices de spawn que viram elite; ausente com `elite` definido = todos. */
  elitePicks?: number[];
}

/** Modificadores de uma onda inteira (item 9). */
export type WaveModifier =
  | { type: "strongCurrents"; multiplier: number }
  | { type: "eliteAll"; elite: EliteId }
  | { type: "noEarlyStart" }
  | { type: "fog" };

export interface WaveDefinition {
  name: string;
  groups: WaveGroupDefinition[];
  /** Alias de autoria para `groups`. */
  enemyGroups?: WaveGroupDefinition[];
  waveNumber?: number;
  specialModifiers?: WaveModifier[];
  /** Bônus ao limpar esta onda; ausente = `ECONOMY.waveClearBonus`. */
  completionReward?: number;
  /** Ausente = derivado (algum grupo com chefe). */
  isBossWave?: boolean;
}

/**
 * Objetivo secundário de uma fase (item 21). Cada fase declara três; o primeiro é sempre `complete`.
 * `value` é o número que o tipo pede (vidas, Guardiões, milissegundos); tipos sem número o ignoram.
 */
export type ObjectiveKind =
  | "complete"
  | "minLivesRemaining"
  | "noLeaks"
  | "noEliteLeaks"
  | "maxGuardians"
  | "maxDistinctGuardians"
  | "underTimeMs"
  | "noFinalEvolution"
  | "noSell"
  | "noEarlyCall";

export interface LevelObjectiveDefinition {
  id: string;
  kind: ObjectiveKind;
  value?: number;
}

/** Uma rota da fase. A primeira é a principal e coincide com `waypoints`. */
export interface PathDefinition {
  id: string;
  waypoints: Vec2[];
  spawnPointId?: string;
  goalPointId?: string;
}

export interface SpawnPointDefinition extends Vec2 {
  id: string;
  pathId: string;
}

export interface GoalPointDefinition extends Vec2 {
  id: string;
}

export interface PlacementDefinition extends Vec2 {
  id: string;
}

export interface CurrentZoneDefinition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: Vec2;
  speedModifier: number;
  projectileDrift: number;
}

export interface EnemyScaling {
  health: number;
  speed: number;
  reward: number;
}

/** Ajuste pontual de um inimigo em uma fase (aplicado antes de `enemyScaling`). */
export type EnemyOverride = Partial<Pick<EnemyDefinition, "maxHealth" | "speed" | "reward" | "armor" | "reefDamage" | "weakPoints">>;

export interface LevelTheme {
  water: number;
  sand: number;
  path: number;
  rock: number;
}

export interface LevelDefinition {
  id: string;
  name: string;
  subtitle: string;
  /** Duas ou três linhas sobre o lugar, para a tela de preparação. */
  briefing?: string;
  /** A frase do Recife que fecha o briefing, sem as aspas (a tela as desenha). */
  quote?: string;
  /** Textura de fundo pintada; ausente = fundo procedural desenhado a partir da rota. */
  backgroundKey?: string;
  theme: LevelTheme;
  startingPearls: number;
  reefHealth: number;
  initialWaveDelayMs: number;
  betweenWaveDelayMs: number;
  enemyScaling: EnemyScaling;
  /** Sobrescritas por inimigo, ex.: chefe mais fraco na fase de aprendizado. */
  enemyOverrides?: Partial<Record<EnemyId, EnemyOverride>>;
  /** Rota principal. Continua sendo a fonte da verdade; `paths[0]` é ela. */
  waypoints: Vec2[];
  placements: PlacementDefinition[];
  currents: CurrentZoneDefinition[];
  waves: WaveDefinition[];
  // ---- v2 (opcionais; ausente = fase de rota única como hoje) ----
  paths?: PathDefinition[];
  spawnPoints?: SpawnPointDefinition[];
  goalPoints?: GoalPointDefinition[];
  /** Bônus de conclusão próprio; ausente = `ECONOMY.levelClearBonus`. */
  levelClearBonus?: number;
  /** Três objetivos: o primeiro é concluir a fase, os outros dois valem as estrelas 2 e 3. */
  objectives?: [LevelObjectiveDefinition, LevelObjectiveDefinition, LevelObjectiveDefinition];
  /** Fase de campanha (padrão) ou Encontro, a fase curta onde um Guardião é achado (item 3). */
  kind?: "campaign" | "encounter";
  /** Id do Encontro concluído ao vencer esta fase; alimenta `unlocks.ts`. */
  encounterId?: string;
  /** Elementos do mapa com que o jogador interage durante a partida (item 28). */
  interactables?: InteractableDefinition[];
}

/** O que o jogador precisa fazer para resolver um interagível. */
export type InteractableGoal =
  /** Toques repetidos, com descanso entre eles (cortar uma rede). */
  | { type: "taps"; taps: number; cooldownMs: number }
  /** Manter um Guardião por perto durante um tempo (acalmar, escoltar). */
  | { type: "guardNearby"; radius: number; durationMs: number }
  /** Derrotar quem guarda o lugar. */
  | { type: "enemyDefeated"; enemyId: EnemyId; count?: number }
  /** Um toque só: o segredo escondido no mapa. */
  | { type: "reveal" };

/**
 * Elemento interativo do mapa (item 28): a rede que prende a Tartaruga, a pedra que pisca, a gruta do
 * Tubarão. Puro dado — o motor resolve, a cena só desenha e manda o comando `interact`.
 */
export interface InteractableDefinition {
  id: string;
  x: number;
  y: number;
  /** Raio de toque no mapa. */
  radius?: number;
  label: string;
  goal: InteractableGoal;
  /** Só pode ser trabalhado a partir desta onda (1 = desde o começo). */
  availableFromWave?: number;
  /** Guardião libertado, que entra como aliado gratuito até o fim da partida. */
  ally?: { guardianId: GuardianId; x: number; y: number; branchId?: BranchId; upgradeLevel?: number };
  /** Segredo achado: o id vai para `discoveredSecrets` no save. */
  secretId?: string;
  /** Corrente temporária criada ao concluir (a Tartaruga virando a água, por exemplo). */
  current?: { x: number; y: number; radius: number; speedFactor: number; durationMs: number };
  /** Textos curtos para o mapa e as mensagens do HUD. */
  messages?: { idle?: string; progress?: string; done?: string };
}

export interface DebugFlags {
  enabled: boolean;
  /** A linha da rota, sem os nós. */
  route: boolean;
  /**
   * Os nós internos que definem o caminho: bolinha, rótulo (`SPAWN`, `P3`, `RECIFE`) e seta de
   * sentido entre eles. É estrutura de autoria, não informação de jogo — fica desligada por padrão
   * até com o overlay ligado, porque já vazou para o jogador uma vez.
   */
  routeNodes: boolean;
  ranges: boolean;
  hitboxes: boolean;
  current: boolean;
  states: boolean;
  targets: boolean;
  placements: boolean;
  /** Campos de corrente, armadilhas, marcas e coordenação. */
  controls: boolean;
}

export type WaveState = "countdown" | "spawning" | "active" | "victory";

export interface UpgradeOption {
  branchId: BranchId;
  branchName: string;
  branchColor: number;
  level: number;
  name: string;
  description: string;
  cost: number;
}

export type BranchState = "available" | "chosen" | "locked" | "complete";

/** Estado de um ramo para o painel de upgrade: mostra sempre os dois ramos, com o não escolhido bloqueado. */
export interface BranchStatus {
  id: BranchId;
  name: string;
  color: number;
  state: BranchState;
  steps: Array<{ name: string; purchased: boolean; cost: number }>;
}

export interface SelectedGuardianInfo {
  instanceId: string;
  guardianId: GuardianId;
  name: string;
  upgradeLevel: number;
  maxUpgradeLevel: number;
  branchId: BranchId | null;
  branchName: string | null;
  branchColor: number | null;
  /** Pasta da variante visual atual (`base`, `perfuracao-1`, ...), ver `assets/guardianArt.ts`. */
  artVariant: string;
  options: UpgradeOption[];
  branches: BranchStatus[];
  invested: number;
  sellValue: number;
  /** Medidas em vigor (já com os upgrades comprados), para o painel do HUD. */
  damage: number;
  range: number;
  cooldownMs: number;
}

/** Uma linha da prévia da próxima onda: "🐟 x12" ou "⚠ Elite x1". */
export interface WavePreviewChip {
  enemyId: EnemyId;
  name: string;
  count: number;
  isElite: boolean;
  isBoss: boolean;
}

export interface WavePreviewInfo {
  name: string;
  isBossWave: boolean;
  totalCount: number;
  chips: WavePreviewChip[];
}

export interface BossHudInfo {
  name: string;
  title: string;
  healthRatio: number;
  phaseIndex: number;
  phaseCount: number;
  /** Pontos fracos deste chefe; `null` quando a dificuldade não os concede (item 11). */
  weakPoints: { total: number; remaining: number } | null;
}

export interface HudSnapshot {
  levelId: string;
  levelName: string;
  levelIndex: number;
  levelCount: number;
  nextLevelId: string | null;
  pearls: number;
  reefHealth: number;
  maxReefHealth: number;
  wave: number;
  totalWaves: number;
  waveState: WaveState;
  countdownSeconds: number;
  canSkipCountdown: boolean;
  /** Velocidade da partida (1×, 2×, 3×). */
  speed: 1 | 2 | 3;
  /** Composição da próxima onda (item 9); null na última. */
  nextWave: WavePreviewInfo | null;
  /** Pérolas que o jogador ganha se chamar a onda agora (0 = bônus desligado). */
  earlyCallBonus: number;
  /** Chefe em campo, para a barra e o aviso. */
  boss: BossHudInfo | null;
  /** Dificuldade da partida. */
  difficulty: string;
  /** Os cinco Guardiões disponíveis nas cartas desta partida. */
  loadout: GuardianId[];
  selectedGuardianId: GuardianId | null;
  selectedPlacedGuardian: SelectedGuardianInfo | null;
  paused: boolean;
  muted: boolean;
  debug: DebugFlags;
  message: string;
  /** Dica do tutorial em curso (item 30); null quando não há nada a ensinar. */
  tutorial: TutorialHint | null;
  gameOver: "victory" | "defeat" | null;
}

/** Passo do tutorial pronto para desenhar. */
export interface TutorialHint {
  id: string;
  text: string;
  /** Nome do controle destacado no HUD (`UiRegistry`), quando a dica fala de um botão. */
  highlight: string | null;
  step: number;
  total: number;
}
