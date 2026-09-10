export interface Vec2 {
  x: number;
  y: number;
}

export type GuardianId = "pistol-shrimp" | "jellyfish" | "pufferfish";
export type EnemyId = "swimmer" | "dartfish" | "shellback" | "tidebreaker";
export type GuardianState = "idle" | "windup" | "attack" | "recovery" | "disabled";
export type AttackKind = "projectile" | "chain" | "area";
export type PlacementMode = "platform" | "water" | "route";

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

export interface GuardianUpgrade {
  name: string;
  description: string;
  cost: number;
  damageMultiplier?: number;
  rangeMultiplier?: number;
  slowMultiplier?: number;
  extraTargets?: number;
  projectileSpeedMultiplier?: number;
  predictiveAim?: boolean;
  secondaryDamageMultiplier?: number;
  chainDamageMultiplier?: number;
  blockCapacity?: number;
  contactDamagePerSecond?: number;
  electricField?: {
    radius: number;
    durationMs: number;
    cooldownMs: number;
    pulseIntervalMs: number;
    damage: number;
    slowFactor: number;
    slowDurationMs: number;
  };
}

export interface GuardianDefinition {
  id: GuardianId;
  name: string;
  shortName: string;
  description: string;
  color: number;
  accent: number;
  cost: number;
  range: number;
  damage: number;
  cooldownMs: number;
  attackKind: AttackKind;
  placementMode: PlacementMode;
  projectileSpeed?: number;
  slowFactor?: number;
  slowDurationMs?: number;
  timings: GuardianStateTimings;
  animation: GuardianAnimationProfile;
  upgrades: [GuardianUpgrade, GuardianUpgrade];
}

export interface EnemyDefinition {
  id: EnemyId;
  name: string;
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

export interface LevelDefinition {
  id: string;
  name: string;
  startingPearls: number;
  reefHealth: number;
  initialWaveDelayMs: number;
  betweenWaveDelayMs: number;
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

export interface SelectedGuardianInfo {
  instanceId: string;
  name: string;
  upgradeLevel: number;
  maxUpgradeLevel: number;
  nextUpgradeName: string | null;
  nextUpgradeDescription: string | null;
  nextUpgradeCost: number | null;
}

export interface HudSnapshot {
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
