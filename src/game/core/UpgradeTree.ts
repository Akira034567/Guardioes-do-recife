import type { BranchId, BranchStatus, GuardianDefinition, GuardianUpgrade, UpgradeBranch, UpgradeOption } from "../types";

export const MAX_UPGRADE_LEVEL = 2;

export interface UpgradeProgress {
  branchId: BranchId | null;
  upgradeLevel: number;
}

export function branchOf(definition: GuardianDefinition, branchId: BranchId | null): UpgradeBranch | null {
  if (!branchId) return null;
  return definition.branches.find((branch) => branch.id === branchId) ?? null;
}

/** Upgrades já comprados por esta unidade, na ordem. */
export function appliedUpgrades(definition: GuardianDefinition, progress: UpgradeProgress): GuardianUpgrade[] {
  const branch = branchOf(definition, progress.branchId);
  if (!branch) return [];
  return branch.upgrades.slice(0, Math.max(0, Math.min(MAX_UPGRADE_LEVEL, progress.upgradeLevel)));
}

/**
 * Opções disponíveis: sem ramo escolhido, o primeiro passo de cada ramo;
 * com ramo escolhido, apenas o próximo passo daquele ramo.
 */
export function upgradeOptions(definition: GuardianDefinition, progress: UpgradeProgress): UpgradeOption[] {
  if (progress.upgradeLevel >= MAX_UPGRADE_LEVEL) return [];
  const branches = progress.branchId
    ? definition.branches.filter((branch) => branch.id === progress.branchId)
    : definition.branches;
  return branches.map((branch) => {
    const upgrade = branch.upgrades[progress.upgradeLevel];
    return {
      branchId: branch.id,
      branchName: branch.name,
      branchColor: branch.color,
      level: progress.upgradeLevel + 1,
      name: upgrade.name,
      description: upgrade.description,
      cost: upgrade.cost,
    };
  });
}

/**
 * Estado dos dois ramos para o painel: `available` antes da escolha, `chosen` no ramo em curso,
 * `complete` quando os dois passos foram comprados e `locked` no ramo descartado.
 */
export function branchStatuses(definition: GuardianDefinition, progress: UpgradeProgress): BranchStatus[] {
  return definition.branches.map((branch) => {
    const chosen = progress.branchId === branch.id;
    const purchased = chosen ? Math.min(MAX_UPGRADE_LEVEL, progress.upgradeLevel) : 0;
    const state = !progress.branchId
      ? "available"
      : !chosen
        ? "locked"
        : purchased >= MAX_UPGRADE_LEVEL
          ? "complete"
          : "chosen";
    return {
      id: branch.id,
      name: branch.name,
      color: branch.color,
      state,
      steps: branch.upgrades.map((upgrade, index) => ({ name: upgrade.name, purchased: index < purchased, cost: upgrade.cost })),
    };
  });
}

export function canApplyUpgrade(definition: GuardianDefinition, progress: UpgradeProgress, branchId: BranchId): boolean {
  return upgradeOptions(definition, progress).some((option) => option.branchId === branchId);
}

export function applyUpgrade(definition: GuardianDefinition, progress: UpgradeProgress, branchId: BranchId): UpgradeProgress | null {
  if (!canApplyUpgrade(definition, progress, branchId)) return null;
  return { branchId, upgradeLevel: progress.upgradeLevel + 1 };
}

/** Custo base mais todos os upgrades comprados. */
export function investedValue(definition: GuardianDefinition, progress: UpgradeProgress): number {
  return appliedUpgrades(definition, progress).reduce((total, upgrade) => total + upgrade.cost, definition.cost);
}

export function sellValue(invested: number, refundRate: number): number {
  return Math.max(0, Math.floor(invested * refundRate));
}

/** Último valor definido para uma chave, considerando base e upgrades aplicados. */
export function resolveLast<K extends keyof GuardianUpgrade>(
  upgrades: readonly GuardianUpgrade[],
  key: K,
): GuardianUpgrade[K] | undefined {
  for (let index = upgrades.length - 1; index >= 0; index -= 1) {
    const value = upgrades[index][key];
    if (value !== undefined) return value;
  }
  return undefined;
}

export function resolveProduct(
  upgrades: readonly GuardianUpgrade[],
  key: "rangeMultiplier" | "projectileSpeedMultiplier",
): number {
  return upgrades.reduce((product, upgrade) => product * (upgrade[key] ?? 1), 1);
}
