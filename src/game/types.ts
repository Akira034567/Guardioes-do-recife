export interface Vec2 {
  x: number;
  y: number;
}

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
export type EnemyId = "minnow" | "swimmer" | "dartfish" | "needlefish" | "shellback" | "moray" | "tidebreaker";
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
  /** Emboscada II: espera `count` inimigos ou `maxWaitMs` após o primeiro entrar. */
  waitFor?: { count: number; maxWaitMs: number };
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
  /** Apenas para placementMode "route": se a unidade segura inimigos. */
  blocks?: boolean;
  blockCapacity?: number;
  contactDamagePerSecond?: number;
  projectileSpeed?: number;
  slowFactor?: number;
  slowDurationMs?: number;
  vulnerability?: VulnerabilityEffect;
  targeting?: TargetPolicyMode;
  /** Investida visual curta até o alvo e volta (Tubarão). */
  dash?: boolean;
  trap?: TrapEffect;
  sonar?: SonarEffect;
  timings: GuardianStateTimings;
  animation: GuardianAnimationProfile;
  branches: [UpgradeBranch, UpgradeBranch];
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
  /** 0..1: fração da lentidão ignorada (0.5 = sofre metade do slow). */
  slowResistance?: number;
}

export interface WaveGroupDefinition {
  enemyId: EnemyId;
  count: number;
  intervalMs: number;
  delayMs: number;
}

export interface WaveDefinition {
  name: string;
  groups: WaveGroupDefinition[];
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
export type EnemyOverride = Partial<Pick<EnemyDefinition, "maxHealth" | "speed" | "reward" | "armor" | "reefDamage">>;

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
  waypoints: Vec2[];
  placements: PlacementDefinition[];
  currents: CurrentZoneDefinition[];
  waves: WaveDefinition[];
}

export interface DebugFlags {
  enabled: boolean;
  route: boolean;
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
  /** Os cinco Guardiões disponíveis nas cartas desta partida. */
  loadout: GuardianId[];
  selectedGuardianId: GuardianId | null;
  selectedPlacedGuardian: SelectedGuardianInfo | null;
  paused: boolean;
  muted: boolean;
  debug: DebugFlags;
  message: string;
  gameOver: "victory" | "defeat" | null;
}
