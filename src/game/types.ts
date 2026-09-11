export interface Vec2 {
  x: number;
  y: number;
}

export type GuardianId = "pistol-shrimp" | "jellyfish" | "pufferfish" | "reef-crab" | "ink-octopus";
export type EnemyId = "minnow" | "swimmer" | "dartfish" | "needlefish" | "shellback" | "moray" | "tidebreaker";
export type EnemyRole = "swarm" | "common" | "fast" | "armored" | "elite" | "boss";
export type GuardianState = "idle" | "windup" | "attack" | "recovery" | "disabled";
/**
 * projectile: dispara um projétil físico (Camarão).
 * chain: descarga instantânea que pode saltar entre alvos (Água-viva).
 * area: pulso que atinge todos no alcance (Baiacu).
 * melee: golpe curto no alvo mais avançado; com `areaAttack` atinge todos no alcance (Caranguejo).
 * ink: jato instantâneo que aplica debuff (Polvo).
 */
export type AttackKind = "projectile" | "chain" | "area" | "melee" | "ink";
export type PlacementMode = "platform" | "water" | "route";
export type BranchId = "a" | "b";

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

export interface AuraEffect {
  /** 1.10 = aliados atacam 10% mais rápido. Auras não acumulam: vale a maior. */
  attackSpeedMultiplier: number;
  rangeMultiplier: number;
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

export interface SelectedGuardianInfo {
  instanceId: string;
  guardianId: GuardianId;
  name: string;
  upgradeLevel: number;
  maxUpgradeLevel: number;
  branchId: BranchId | null;
  branchName: string | null;
  branchColor: number | null;
  options: UpgradeOption[];
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
  selectedGuardianId: GuardianId | null;
  selectedPlacedGuardian: SelectedGuardianInfo | null;
  paused: boolean;
  muted: boolean;
  debug: DebugFlags;
  message: string;
  gameOver: "victory" | "defeat" | null;
}
