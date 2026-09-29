import Phaser from "phaser";

/**
 * ENTRADA DO JOGO — a tela de carregamento que já está no `index.html` antes de qualquer JS.
 *
 * O markup e o CSS moram no HTML de propósito: assim ela aparece no primeiro quadro, cobrindo o
 * download do bundle e a adoção de sessão da nuvem. Este módulo só move a barra e a tira da frente.
 *
 * Progresso: 0–30% é o próprio bundle chegando (marcado em `main.ts`), 30–100% é o `preload` da
 * `BootScene`. Na abertura normal a entrada fica pelo menos `MIN_VISIBLE_MS` na tela — senão, em
 * rede rápida, ela pisca e ninguém vê a animação. Atalhos de desenvolvimento (`?level=`, `?screen=`)
 * e os testes automatizados pulam essa espera.
 */

const MIN_VISIBLE_MS = 1200;
const FADE_MS = 420;

function splashElement(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.getElementById("boot-splash");
}

function skipsMinimum(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("level") || params.has("screen") || navigator.webdriver === true;
}

let shown = 0;

/** Avança a barra. Nunca volta para trás — carregamentos em sequência não fazem a barra "pular". */
export function setSplashProgress(value: number): void {
  const splash = splashElement();
  if (!splash) return;
  shown = Math.max(shown, Math.min(1, Math.max(0, value)));
  splash.style.setProperty("--p", shown.toFixed(3));
  splash.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
}

let hideRequested = false;
let pendingLoads = 0;

function leave(splash: HTMLElement): void {
  if (splash.classList.contains("is-leaving")) return;
  splash.classList.add("is-leaving");
  window.setTimeout(() => splash.remove(), FADE_MS);
}

function leaveWhenIdle(): void {
  const splash = splashElement();
  if (splash && hideRequested && pendingLoads === 0) leave(splash);
}

/**
 * Pede para a entrada sair (com fade) assim que a primeira tela terminar de carregar. Idempotente.
 *
 * A espera mínima nunca é zero: a cena seguinte só começa o `preload` no próximo quadro, e a
 * entrada precisa ver esse carregamento (ver `trackSceneLoad`) antes de decidir que acabou.
 */
export function hideSplash(): void {
  const splash = splashElement();
  if (!splash || hideRequested) return;
  hideRequested = true;
  setSplashProgress(1);
  const startedAt = (window as { __grSplashStartedAt?: number }).__grSplashStartedAt ?? 0;
  const wait = skipsMinimum() ? 0 : MIN_VISIBLE_MS - (performance.now() - startedAt);
  window.setTimeout(leaveWhenIdle, Math.max(120, wait));
}

const TOAST_DELAY_MS = 250;

/**
 * Carregamento preguiçoso de uma cena (fundo da fase, arte do esquadrão, decoração do recife).
 * Chame no FIM do `preload()`, depois de enfileirar os arquivos.
 *
 * - Se a entrada ainda está na tela, ela espera este carregamento terminar antes de sair.
 * - Senão, e se demorar mais que um piscar, aparece a mini-barra de água sobre o jogo.
 */
export function trackSceneLoad(scene: Phaser.Scene): void {
  const loader = scene.load;
  if (loader.list.size === 0) return;
  const splash = splashElement();
  if (splash && !splash.classList.contains("is-leaving")) {
    pendingLoads += 1;
    loader.once(Phaser.Loader.Events.COMPLETE, () => {
      pendingLoads -= 1;
      leaveWhenIdle();
    });
    return;
  }
  let toast: HTMLElement | null = null;
  const timer = window.setTimeout(() => {
    toast = document.createElement("div");
    toast.className = "gr-load-toast";
    toast.innerHTML = '<div class="gr-load-toast__bar"><div class="gr-load-toast__fill"></div></div><span>Carregando…</span>';
    document.body.appendChild(toast);
  }, TOAST_DELAY_MS);
  const onProgress = (value: number): void => toast?.style.setProperty("--p", value.toFixed(3));
  loader.on(Phaser.Loader.Events.PROGRESS, onProgress);
  loader.once(Phaser.Loader.Events.COMPLETE, () => {
    window.clearTimeout(timer);
    loader.off(Phaser.Loader.Events.PROGRESS, onProgress);
    toast?.remove();
  });
}
