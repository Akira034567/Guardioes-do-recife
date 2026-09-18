import type { ApiResult, ApiUser } from "../core/account/AccountApi";
import { getAccountApi, getSession } from "./accounts";
import { pullSave, reloadSaveScope, startSaveSync, stopSaveSync } from "./accountSync";

/**
 * Entrar, sair e cuidar da conta — a ponte entre a tela e a API.
 *
 * Cada operação que muda QUEM está jogando também troca o save que a página inteira enxerga, então
 * ela termina reabrindo o escopo (`reloadSaveScope`) e religando a sincronização. Quem chama só
 * precisa cuidar da tela; o resto acontece aqui.
 */

export type { ApiUser };

/**
 * Cria a conta. Não entra: o jogador precisa confirmar o e-mail primeiro, e é justamente isso que
 * separa "digitou um endereço" de "tem esse endereço".
 */
export async function register(email: string, name: string, password: string): Promise<ApiResult<{ user: ApiUser; mailer: string }>> {
  return getAccountApi().register(email, name, password);
}

/** Entra na conta, desce o progresso dela e liga a sincronização. */
export async function signIn(email: string, password: string): Promise<ApiResult<{ user: ApiUser; token: string }>> {
  const result = await getAccountApi().login(email, password);
  if (!result.ok) return result;
  getSession().set({ token: result.token, user: result.user });
  reloadSaveScope();
  await pullSave();
  startSaveSync();
  return { ok: true, user: result.user, token: result.token };
}

/** Sai da conta e volta para o save do aparelho. O progresso da conta continua no servidor. */
export async function signOut(): Promise<void> {
  const session = getSession();
  const token = session.token;
  stopSaveSync();
  session.clear();
  reloadSaveScope();
  // Avisar o servidor é bom (invalida o token), mas não pode travar a saída se a rede cair.
  if (token) void getAccountApi().logout(token);
}

export async function resendVerification(email: string): Promise<ApiResult<{ message: string }>> {
  return getAccountApi().resendVerification(email);
}

export async function forgotPassword(email: string): Promise<ApiResult<{ message: string }>> {
  return getAccountApi().forgotPassword(email);
}

export async function changePassword(current: string, next: string): Promise<ApiResult<Record<string, never>>> {
  const token = getSession().token;
  if (!token) return { ok: false, status: 401, reason: "no-session", message: "Entre na conta para trocar a senha." };
  return getAccountApi().changePassword(token, current, next);
}

/** Apaga a conta no servidor (some com o save de lá) e volta este aparelho ao modo convidado. */
export async function deleteAccount(password: string): Promise<ApiResult<Record<string, never>>> {
  const session = getSession();
  const token = session.token;
  if (!token) return { ok: false, status: 401, reason: "no-session", message: "Entre na conta para apagá-la." };
  const result = await getAccountApi().deleteAccount(token, password);
  if (!result.ok) return result;
  stopSaveSync();
  session.clear();
  reloadSaveScope();
  return result;
}

/**
 * Na abertura do jogo: confere se a sessão guardada ainda vale, atualiza o retrato do usuário (o
 * e-mail pode ter sido confirmado noutro aparelho) e desce o progresso da conta.
 *
 * Servidor fora do ar não desloga ninguém: sem resposta, o jogo segue com o save local desta conta e
 * tenta de novo na próxima abertura. Só uma recusa explícita (401) derruba a sessão.
 */
export async function restoreSession(): Promise<void> {
  const session = getSession();
  const token = session.token;
  if (!token) return;
  const result = await getAccountApi().me(token);
  if (!result.ok) {
    if (result.status === 401) {
      session.clear();
      reloadSaveScope();
    }
    return;
  }
  session.updateUser(result.user);
  await pullSave();
  startSaveSync();
}
