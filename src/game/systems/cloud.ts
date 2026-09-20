import { CloudAccount } from "../core/account/CloudAccount";
import type { SupabaseConfig } from "../core/account/supabase";
import { browserStorage } from "./accounts";

/**
 * A conta na nuvem da página inteira, e o laço que mantém o save de lá igual ao daqui.
 *
 * Duas regras que valem para tudo neste arquivo:
 *
 * 1. **A nuvem nunca é o caminho crítico.** O jogo grava no `localStorage` como sempre gravou e
 *    segue a partida; o empurrão para o servidor acontece depois, atrasado, e uma falha dele vira
 *    um aviso na tela de conta — nunca uma partida perdida.
 * 2. **Sem configuração, nada disto existe.** Sem `VITE_SUPABASE_URL` o jogo continua exatamente
 *    como era: contas locais e código de transferência.
 */

/** Espera antes de empurrar: uma partida grava o save várias vezes seguidas no fim. */
const PUSH_DEBOUNCE_MS = 4000;

/**
 * A chave pública do projeto, pelos DOIS nomes que ela teve.
 *
 * O Supabase trocou o JWT `anon` pela chave publicável (`sb_publishable_…`) e aposenta o formato
 * antigo ao fim de 2026 — um projeto criado hoje nem mostra mais "anon key" no painel. Os dois
 * cabeçalhos são os mesmos nos dois casos, então aceitar as duas variáveis custa uma linha e evita
 * que uma instalação existente pare de funcionar na virada.
 */
function configFromEnv(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/+$/, ""), anonKey: key };
}

let account: CloudAccount | null = null;

export function getCloud(): CloudAccount {
  if (!account) account = new CloudAccount(configFromEnv(), browserStorage());
  return account;
}

/** A nuvem está configurada nesta instalação? A tela de conta pergunta isto antes de se desenhar. */
export function isCloudEnabled(): boolean {
  return getCloud().isConfigured;
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let detach: (() => void) | null = null;

/**
 * Liga o save aberto agora à nuvem: toda gravação agenda um empurrão.
 *
 * Chamado toda vez que o `SaveManager` é recriado (trocar de conta abre outro documento), então a
 * primeira coisa que ele faz é desligar o laço anterior. Sem isso, dois documentos escreveriam na
 * mesma linha do servidor.
 */
export function attachCloudSync(save: { progress: { saveVersion: number }; onChange(listener: () => void): () => void }): void {
  detach?.();
  detach = null;
  const cloud = getCloud();
  if (!cloud.isConfigured || !cloud.profile) return;
  detach = save.onChange(() => {
    if (pushTimer !== null) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushTimer = null;
      void cloud.push(save.progress);
    }, PUSH_DEBOUNCE_MS);
  });
}

/** Empurra AGORA o que estiver pendente (o jogador pediu, ou a aba está fechando). */
export async function flushCloudSync(save: { progress: { saveVersion: number } }): Promise<void> {
  if (pushTimer !== null) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  const cloud = getCloud();
  if (!cloud.isConfigured || !cloud.profile) return;
  await cloud.push(save.progress);
}

/**
 * O jogador voltou de um link de e-mail. Guardado aqui porque quem ADOTA a sessão é o arranque
 * (antes de o Phaser existir) e quem REAGE é a cena do Recife, que ainda nem foi criada.
 */
let linkEvent: { type: string; profile: { username: string } } | null = null;

export function setCloudLinkEvent(event: { type: string; profile: { username: string } }): void {
  linkEvent = event;
}

/** Consome o aviso: ele vale uma vez só, para a tela não reabrir a cada visita ao menu. */
export function takeCloudLinkEvent(): { type: string; profile: { username: string } } | null {
  const current = linkEvent;
  linkEvent = null;
  return current;
}
