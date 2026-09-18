import { AccountApi } from "../core/account/AccountApi";
import { SessionStore } from "../core/account/SessionStore";
import type { ApiUser } from "../core/account/AccountApi";
import type { SaveStorage } from "../core/save/SaveManager";

let sessionStore: SessionStore | null = null;
let api: AccountApi | null = null;

/** O `localStorage` da página, ou `null` quando ele não existe (aba anônima, testes headless). */
export function browserStorage(): SaveStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * A sessão da página. Fica aqui, e não no `ProgressStore`, porque é ela quem decide QUAL save o
 * `ProgressStore` vai abrir — a dependência precisa apontar numa direção só.
 */
export function getSession(): SessionStore {
  if (!sessionStore) sessionStore = new SessionStore(browserStorage());
  return sessionStore;
}

/** O cliente da API de contas desta página. */
export function getAccountApi(): AccountApi {
  if (!api) api = new AccountApi();
  return api;
}

/** O usuário logado, ou `null` para quem joga como convidado. */
export function currentAccount(): ApiUser | null {
  return getSession().user;
}
