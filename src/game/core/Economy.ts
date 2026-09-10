export class Economy {
  private balance: number;

  constructor(initialBalance: number) {
    this.balance = Math.max(0, Math.floor(initialBalance));
  }

  get pearls(): number {
    return this.balance;
  }

  canAfford(cost: number): boolean {
    return cost >= 0 && this.balance >= cost;
  }

  spend(cost: number): boolean {
    if (!this.canAfford(cost)) return false;
    this.balance -= cost;
    return true;
  }

  earn(amount: number): void {
    if (amount > 0) this.balance += Math.floor(amount);
  }
}
