import type { AccountResult } from "../core/account/AccountStore";
import type { CloudProfile, CloudResult } from "../core/account/CloudAccount";
import { browserStorage, getAccounts } from "./accounts";
import { flushCloudSync, getCloud } from "./cloud";
import { resetProgression } from "./progression";
import { getSaveManager, resetSaveManager } from "./ProgressStore";
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

// ------------------------------------------------------------------ conta na nuvem

/**
 * Entrar na nuvem é trocar de save, como entrar numa conta local — com um passo a mais: o
 * documento que vale pode estar no servidor.
 *
 * A regra de quem vence é a data: o save mais RECENTE ganha, venha de onde vier. É a regra que
 * acerta no caso que o jogador descreveu (joguei no computador, abri no celular) sem inventar
 * fusão de progresso, que daria resultados impossíveis de explicar — "eu tinha 12 estrelas e agora
 * tenho 9" é pior do que qualquer perda honesta.
 */
async function adoptCloudSave(): Promise<"cloud" | "local" | "none"> {
  const cloud = getCloud();
  const key = cloud.saveKey();
  const storage = browserStorage();
  if (!key) return "none";

  const pulled = await cloud.pull();
  const remote = pulled.ok ? pulled.value : null;
  const localRaw = (() => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  })();
  const localStamp = stampOf(localRaw);
  const remoteStamp = remote ? Date.parse(stampOfDocument(remote.document) ?? remote.updatedAt) : Number.NaN;

  // O de fora é mais novo (ou é o único que existe): ele passa a ser o espelho local.
  if (remote && (Number.isNaN(localStamp) || (!Number.isNaN(remoteStamp) && remoteStamp >= localStamp))) {
    try {
      storage?.setItem(key, JSON.stringify(remote.document));
    } catch {
      // Sem armazenamento: o save vale só nesta aba, e o `SaveManager` cai para memória.
    }
    reloadSaveScope();
    return "cloud";
  }

  // O daqui é mais novo (ou a nuvem está vazia): sobe ele.
  reloadSaveScope();
  await flushCloudSync(getSaveManager());
  return "local";
}

/** `updatedAt` de um documento cru, em ms; `NaN` quando não dá para ler. */
function stampOf(raw: string | null): number {
  if (!raw) return Number.NaN;
  try {
    return Date.parse(stampOfDocument(JSON.parse(raw)) ?? "");
  } catch {
    return Number.NaN;
  }
}

function stampOfDocument(document: unknown): string | null {
  if (typeof document !== "object" || document === null) return null;
  const value = (document as { updatedAt?: unknown }).updatedAt;
  return typeof value === "string" ? value : null;
}

export async function cloudSignUp(input: { username: string; email: string; password: string; confirmPassword?: string }): Promise<CloudResult<{ needsConfirmation: boolean }>> {
  const result = await getCloud().signUp(input);
  // Com confirmação de e-mail ligada não há sessão ainda: não há save a adotar.
  if (result.ok && !result.value.needsConfirmation) await adoptCloudSave();
  return result;
}

export async function cloudSignIn(identifier: string, password: string): Promise<CloudResult<{ profile: CloudProfile; source: "cloud" | "local" | "none" }>> {
  const result = await getCloud().signIn(identifier, password);
  if (!result.ok) return result;
  const source = await adoptCloudSave();
  return { ok: true, value: { profile: result.value, source } };
}

export async function cloudSignOut(): Promise<void> {
  // Sobe o que ainda não subiu ANTES de sair: depois do logout não há mais token para isso.
  await flushCloudSync(getSaveManager()).catch(() => {});
  await getCloud().signOut();
  reloadSaveScope();
}

/** O botão "sincronizar agora": sobe o que está aqui e confere o que está lá. */
export async function cloudSyncNow(): Promise<CloudResult> {
  const cloud = getCloud();
  if (!cloud.profile) return { ok: false, message: "Entre na conta para sincronizar." };
  await flushCloudSync(getSaveManager());
  return cloud.sync.error ? { ok: false, message: cloud.sync.error } : { ok: true, value: undefined };
}

/**
 * O jogador voltou do link do e-mail (confirmação de conta ou troca de senha). Adota a sessão que
 * veio no endereço, limpa o fragmento (para o token não ficar na barra nem no histórico) e diz o
 * que aconteceu, para a tela abrir a troca de senha quando for o caso.
 */
export async function adoptCloudLinkSession(): Promise<{ type: string; profile: CloudProfile } | null> {
  const cloud = getCloud();
  if (!cloud.isConfigured || typeof window === "undefined") return null;
  const adopted = await cloud.adoptUrlSession(window.location.hash);
  if (!adopted) return null;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  await adoptCloudSave();
  return adopted;
}
