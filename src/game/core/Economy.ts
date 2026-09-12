/** Origem de cada pérola ganha dentro da partida (item 1 do design: várias fontes de geração). */
export type PearlSource =
  | "EnemyReward"
  | "WaveReward"
  | "LevelReward"
  | "GuardianGeneration"
  | "MapReward"
  | "SpecialReward"
  | "EarlyWaveBonus"
  | "SellRefund";

/** Destino de cada pérola gasta. */
export type PearlSink = "Place" | "Upgrade";

export interface EconomySnapshot {
  pearls: number;
  earned: Partial<Record<PearlSource, number>>;
  spent: Partial<Record<PearlSink, number>>;
  totalEarned: number;
  totalSpent: number;
}

/**
 * Saldo de pérolas de UMA partida (nunca persiste). Além do saldo, mantém um razão por fonte e por
 * destino para as estatísticas da partida e para o HUD ("+25 · onda").
 */
export class Economy {
  private balance: number;
  private readonly earnedBySource: Partial<Record<PearlSource, number>> = {};
  private readonly spentBySink: Partial<Record<PearlSink, number>> = {};

  constructor(initialBalance: number) {
    this.balance = Math.max(0, Math.floor(initialBalance));
  }

  get pearls(): number {
    return this.balance;
  }

  get earned(): Readonly<Partial<Record<PearlSource, number>>> {
    return this.earnedBySource;
  }

  get spent(): Readonly<Partial<Record<PearlSink, number>>> {
    return this.spentBySink;
  }

  get totalEarned(): number {
    return Object.values(this.earnedBySource).reduce((total, value) => total + (value ?? 0), 0);
  }

  get totalSpent(): number {
    return Object.values(this.spentBySink).reduce((total, value) => total + (value ?? 0), 0);
  }

  canAfford(cost: number): boolean {
    return cost >= 0 && this.balance >= cost;
  }

  spend(cost: number, sink: PearlSink = "Place"): boolean {
    if (!this.canAfford(cost)) return false;
    this.balance -= cost;
    this.spentBySink[sink] = (this.spentBySink[sink] ?? 0) + cost;
    return true;
  }

  /** Credita pérolas inteiras positivas e devolve quanto entrou (0 quando nada foi creditado). */
  earn(amount: number, source: PearlSource = "SpecialReward"): number {
    if (!(amount > 0)) return 0;
    const credited = Math.floor(amount);
    if (credited <= 0) return 0;
    this.balance += credited;
    this.earnedBySource[source] = (this.earnedBySource[source] ?? 0) + credited;
    return credited;
  }

  snapshot(): EconomySnapshot {
    return {
      pearls: this.balance,
      earned: { ...this.earnedBySource },
      spent: { ...this.spentBySink },
      totalEarned: this.totalEarned,
      totalSpent: this.totalSpent,
    };
  }
}
