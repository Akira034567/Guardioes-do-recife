import type { AccountResult } from "../core/account/AccountStore";
import { getAccounts } from "./accounts";
import { resetProgression } from "./progression";
import { resetSaveManager } from "./ProgressStore";
import { notifySettingsChanged } from "./settings";

/**
 * A sessão: qual conta está jogando agora.
 *
 * Entrar, sair ou trazer um código muda o save que a página inteira enxerga. Como os serviços de
 * progresso são únicos por página (`ProgressStore`, `progression`), eles precisam cair JUNTO — senão
 * a conta nova continuaria mexendo no documento da anterior. É só isto que este módulo faz: executa a
 * operação de conta e, quando ela dá certo, reabre o save do zero.
 *
 * O que está na TELA depois disso é responsabilidade de quem chamou: as cenas se refazem com
 * `rebootToHub()` (em `ui/dom/sections.ts`), que é o único jeito de o Recife, o mapa e o HUD
 * lerem o save novo.
 */

/** Reabre o save da conta ativa e avisa quem depende das configurações (elas vêm do save). */
export function reloadSaveScope(): void {
  resetSaveManager();
  resetProgression();
  notifySettingsChanged();
}

export async function signUp(input: { name: string; password: string; confirmPassword?: string; carryDeviceProgress?: boolean }): Promise<AccountResult> {
  return finish(await getAccounts().signUp(input));
}

export async function signIn(name: string, password: string): Promise<AccountResult> {
  return finish(await getAccounts().signIn(name, password));
}

export function signOut(): void {
  getAccounts().signOut();
  reloadSaveScope();
}

export async function importAccountCode(code: string, password: string): Promise<AccountResult> {
  return finish(await getAccounts().importCode(code, password));
}

/** Trocar a senha não muda de save; nada a reabrir. */
export async function changePassword(current: string, next: string, confirm?: string): Promise<AccountResult> {
  return getAccounts().changePassword(current, next, confirm);
}

/** Apagar a conta ativa devolve o jogador ao save do aparelho, então o escopo é reaberto. */
export async function deleteAccount(name: string, password: string): Promise<AccountResult> {
  return finish(await getAccounts().deleteAccount(name, password));
}

function finish(result: AccountResult): AccountResult {
  if (result.ok) reloadSaveScope();
  return result;
}
