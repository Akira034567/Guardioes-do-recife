/**
 * Diagnóstico de ciclo de vida (item 8). O jogo já travou mais de uma vez de um jeito difícil de
 * achar: o loop do Phaser reagenda o próximo quadro DEPOIS de chamar o `update()` das cenas
 * (`RequestAnimationFrame.step`), então uma exceção não capturada lá dentro mata o loop para
 * sempre — a tela congela, o cursor continua mudando e o console mostra um único erro solto.
 *
 * Este módulo guarda as últimas transições numa fila curta para que, quando algo assim acontecer,
 * o despejo diga em que fase o jogo estava. Fica inerte fora de desenvolvimento.
 */

const RING_SIZE = 64;

/** Ferramentas de diagnóstico seguem a mesma regra do overlay de debug: DEV ou `?debug=1`. */
export const DIAGNOSTICS_ON =
  typeof window === "undefined"
    ? Boolean(import.meta.env?.DEV)
    : Boolean(import.meta.env?.DEV) || new URLSearchParams(window.location.search).get("debug") === "1";

export interface LifecycleEntry {
  at: number;
  scope: string;
  phase: string;
  detail?: Record<string, unknown>;
}

const ring: LifecycleEntry[] = [];

/** Registra uma transição de fase. Barata o bastante para chamar em toda troca de estado. */
export function lifecycleLog(scope: string, phase: string, detail?: Record<string, unknown>): void {
  if (!DIAGNOSTICS_ON) return;
  const entry: LifecycleEntry = { at: Math.round(performance.now()), scope, phase, detail };
  ring.push(entry);
  if (ring.length > RING_SIZE) ring.shift();
  console.info(`[GR:lifecycle] ${scope} → ${phase}`, detail ?? "");
}

/**
 * Invariante quebrada. NUNCA lança: lançar aqui, dentro de um `update()`, reintroduziria
 * exatamente o travamento que este módulo existe para diagnosticar.
 */
export function devAssert(condition: unknown, message: string, detail?: Record<string, unknown>): void {
  if (!DIAGNOSTICS_ON || condition) return;
  console.error(`[GR:assert] ${message}`, detail ?? "", "\n" + dumpLifecycle().join("\n"));
}

/** As últimas transições, da mais antiga para a mais recente, já formatadas. */
export function dumpLifecycle(): string[] {
  return ring.map((entry) => `  ${entry.at}ms ${entry.scope} → ${entry.phase}${entry.detail ? ` ${JSON.stringify(entry.detail)}` : ""}`);
}

export function lifecycleEntries(): readonly LifecycleEntry[] {
  return ring;
}

/**
 * Publica o despejo no console do navegador e para as sondas e2e, no mesmo espírito do
 * `window.__grUi` usado pelos testes do HUD.
 */
export function publishDiagnostics(): void {
  if (!DIAGNOSTICS_ON || typeof window === "undefined") return;
  (window as unknown as { __grLifecycle?: unknown }).__grLifecycle = {
    entries: lifecycleEntries,
    dump: dumpLifecycle,
  };
}
