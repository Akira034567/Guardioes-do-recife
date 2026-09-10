export interface Vec2 {
  x: number;
  y: number;
}

export type GuardianId = "pistol-shrimp" | "jellyfish" | "pufferfish";
export type EnemyId = "swimmer" | "dartfish" | "shellback" | "tidebreaker";
export type GuardianState = "idle" | "windup" | "attack" | "recovery" | "disabled";
export type AttackKind = "projectile" | "chain" | "area";

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
  projectileSpeed?: number;
  slowFactor?: number;
  slowDurationMs?: number;
  timings: GuardianStateTimings;
  animation: GuardianAnimationProfile;
  upgrade: GuardianUpgrade;
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
}

export type WaveState = "countdown" | "spawning" | "active" | "victory";

export interface SelectedGuardianInfo {
  instanceId: string;
  name: string;
  upgraded: boolean;
  upgradeName: string;
  upgradeDescription: string;
  upgradeCost: number;
}

export interface HudSnapshot {
  pearls: number;
  reefHealth: number;
  maxReefHealth: number;
  wave: number;
  totalWaves: number;
  waveState: WaveState;
  countdownSeconds: number;
  selectedGuardianId: GuardianId | null;
  selectedPlacedGuardian: SelectedGuardianInfo | null;
  paused: boolean;
  muted: boolean;
  debug: DebugFlags;
  message: string;
  gameOver: "victory" | "defeat" | null;
}
