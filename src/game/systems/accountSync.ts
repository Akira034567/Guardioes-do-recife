import { SAVE_KEY } from "../core/save/SaveManager";
import { browserStorage, getAccountApi, getSession } from "./accounts";
import { getSaveManager, resetSaveManager } from "./ProgressStore";
import { resetProgression } from "./progression";
import { notifySettingsChanged } from "./settings";

/**
 * A sincronização do progresso com o servidor.
 *
 * Duas regras, e só duas, para ninguém precisar adivinhar o que aconteceu com o save:
 *
 * 1. **Ao entrar, o servidor manda.** O que está na conta desce e passa por cima do que houver neste
 *    aparelho. É o que faz "jogar em outro lugar" significar alguma coisa. A exceção é a conta que
 *    ainda não tem save nenhum lá: aí o que estiver aqui sobe, e é assim que o progresso de quem
 *    jogou como convidado vira o progresso da conta.
 * 2. **Depois disso, este aparelho manda.** Cada gravação local sobe, com uma pausa curta para não
 *    mandar um pedido por tecla apertada. Falhou? Fica pendente e tenta de novo — nada se perde,
 *    porque o save continua gravado aqui do mesmo jeito.
 */

/** Espera antes de subir: junta a rajada de gravações do fim de uma partida num pedido só. */
const PUSH_DELAY_MS = 2000;

export interface SyncState {
  /** Há mudança local esperando subir. */
  pending: boolean;
  /** Última subida bem-sucedida. */
  lastPushAt: string | null;
  /** Por que a última tentativa falhou; `null` quando está tudo em dia. */
  error: string | null;
}

const state: SyncState = { pending: false, lastPushAt: null, error: null };
const listeners = new Set<(state: SyncState) => void>();
let unsubscribeSave: (() => void) | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

export function syncState(): Readonly<SyncState> {
  return state;
}

export function onSyncChanged(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce(): void {
  listeners.forEach((listener) => listener(state));
}

/** Reabre o save da sessão atual (o documento é outro) e avisa quem depende das configurações. */
export function reloadSaveScope(): void {
  resetSaveManager();
  resetProgression();
  notifySettingsChanged();
}

/**
 * Desce o save da conta e o coloca no lugar certo ANTES de qualquer cena ler o progresso. Escreve
 * direto no armazenamento em vez de passar pelo `SaveManager`: o documento vindo do servidor é o
 * documento inteiro, não um remendo, e assim ele é lido e saneado uma vez só, na abertura seguinte.
 */
export async function pullSave(): Promise<"baixou" | "subiu" | "nada" | "offline"> {
  const session = getSession();
  const token = session.token;
  if (!token) return "nada";
  const result = await getAccountApi().getSave(token);
  if (!result.ok) {
    if (result.reason === "offline") {
      state.error = result.message;
      announce();
      return "offline";
    }
    return "nada";
  }

  const storage = browserStorage();
  if (result.save && storage) {
    try {
      storage.setItem(session.saveKey(), result.save.document);
    } catch {
      // Sem espaço: o jogo segue com o que já estava aqui; a próxima subida corrige o rumo.
    }
    reloadSaveScope();
    return "baixou";
  }

  // Conta ainda sem save no servidor: o que existir neste aparelho é o começo dela.
  const local = readLocal(session.saveKey()) ?? readLocal(SAVE_KEY);
  if (local && storage) {
    try {
      storage.setItem(session.saveKey(), local);
    } catch {
      // idem
    }
    reloadSaveScope();
    await push(local);
    return "subiu";
  }
  reloadSaveScope();
  return "nada";
}

/** Passa a subir toda gravação local. Chamado ao entrar e na abertura do jogo com sessão válida. */
export function startSaveSync(): void {
  stopSaveSync();
  if (!getSession().token) return;
  unsubscribeSave = getSaveManager().onChange(() => schedulePush());
}

export function stopSaveSync(): void {
  unsubscribeSave?.();
  unsubscribeSave = null;
  if (timer !== null) clearTimeout(timer);
  timer = null;
  state.pending = false;
  state.error = null;
  announce();
}

/** Sobe agora o que estiver pendente (usado ao fechar a aba e nos testes). */
export async function flushSaveSync(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (!state.pending) return;
  await push(JSON.stringify(getSaveManager().progress));
}

function schedulePush(): void {
  state.pending = true;
  announce();
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void push(JSON.stringify(getSaveManager().progress));
  }, PUSH_DELAY_MS);
}

async function push(document: string): Promise<void> {
  const token = getSession().token;
  if (!token) return;
  const result = await getAccountApi().putSave(token, document);
  if (result.ok) {
    state.pending = false;
    state.lastPushAt = result.save.updatedAt;
    state.error = null;
  } else {
    // Continua pendente de propósito: a próxima gravação (ou o próximo `flush`) tenta de novo.
    state.error = result.message;
  }
  announce();
}

function readLocal(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
