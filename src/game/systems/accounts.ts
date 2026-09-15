import { AccountStore } from "../core/account/AccountStore";
import type { SaveStorage } from "../core/save/SaveManager";

let store: AccountStore | null = null;

/** O `localStorage` da página, ou `null` quando ele não existe (aba anônima, testes headless). */
export function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Único registro de contas da página. Fica aqui, e não no `ProgressStore`, porque ele é quem decide
 * QUAL save o `ProgressStore` vai abrir — a dependência precisa apontar numa direção só.
 */
export function getAccounts(): AccountStore {
  if (!store) store = new AccountStore(browserStorage());
  return store;
}

/** A conta em uso, ou `null` para quem joga como convidado (o save do aparelho). */
export function currentAccount(): ReturnType<AccountStore["list"]>[number] | null {
  return getAccounts().active;
}
