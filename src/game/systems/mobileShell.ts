import { EventBus, Events } from "../EventBus";
import { safeInsetsCss } from "./stage";

/**
 * O JOGO COMO APP NO CELULAR — tudo que a página faz para não parecer página.
 *
 * - Deitado, sempre: em pé, o overlay "Gire o celular" (CSS em `style.css`) cobre o jogo e a
 *   partida pausa. iOS não deixa site nenhum travar a orientação; no Android instalado, travamos.
 * - Sem zoom, sem seleção de texto, sem menu de "copiar" no toque longo, sem a página "quicar".
 * - Saiu do app (trocou de aba, atendeu ligação): a partida pausa.
 * - A tela não apaga no meio de uma onda (`wakeLock`).
 *
 * A barrinha de início do iPhone é um gesto do SISTEMA: nenhum site consegue desligá-la. O que dá
 * para fazer — e é feito em `style.css` — é o jogo inteiro viver DENTRO da área segura, para nenhum
 * botão ficar embaixo dela, e o app instalado não ter a barra do Safari que "sobe" no toque.
 */

function isTouch(): boolean {
  return document.documentElement.classList.contains("is-touch");
}

export function isStandalone(): boolean {
  return document.documentElement.classList.contains("is-standalone");
}

function isPortrait(): boolean {
  return window.matchMedia("(orientation: portrait)").matches;
}

async function lockLandscape(): Promise<void> {
  const orientation = screen.orientation as (ScreenOrientation & { lock?: (value: string) => Promise<void> }) | undefined;
  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Só funciona instalado/em tela cheia, e nunca no iOS. O overlay cobre o resto.
  }
}

let wakeLock: { release: () => Promise<void> } | null = null;
let wantWake = false;

async function acquireWake(): Promise<void> {
  const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } };
  if (!wantWake || wakeLock || !nav.wakeLock || document.visibilityState !== "visible") return;
  try {
    wakeLock = await nav.wakeLock.request("screen");
  } catch {
    wakeLock = null;
  }
}

/** A partida começou (true) ou acabou/saiu (false): só com partida viva a tela fica acesa. */
export function setMatchActive(active: boolean): void {
  wantWake = active;
  if (active) void acquireWake();
  else if (wakeLock) {
    const lock = wakeLock;
    wakeLock = null;
    void lock.release().catch(() => {});
  }
}

/**
 * O PALCO NO TAMANHO DA TELA DE VERDADE.
 *
 * O CSS (`html.is-touch #game` em `style.css`) estica o jogo pela tela inteira. No iPhone isso não
 * basta: aberto pelo ícone (e às vezes no Safari, depois de girar), o WebKit calcula a
 * janela MAIS ALTA que a tela — sobra a altura da barra de status do retrato. O Phaser mede esse
 * `#game` alto demais, o modo FIT passa a caber pela largura e o canvas sai maior que a tela: a
 * barra de cima (pérolas, pausa, velocidade) e a de baixo (cartas, melhorar) ficam cortadas.
 *
 * A tela física não mente: `screen.width/height` é o aparelho, em qualquer orientação. Então o
 * palco ganha tamanho explícito, o MENOR entre o que a janela diz e o que cabe na tela. O Phaser
 * confere o pai a cada 500 ms e se ajusta sozinho.
 */
function fitStageToScreen(stage: HTMLElement): void {
  const viewport = window.visualViewport;
  const landscape = !isPortrait();
  const longSide = Math.max(screen.width, screen.height) || Infinity;
  const shortSide = Math.min(screen.width, screen.height) || Infinity;
  const width = Math.min(window.innerWidth, viewport?.width ?? Infinity, landscape ? longSide : shortSide);
  const height = Math.min(window.innerHeight, viewport?.height ?? Infinity, landscape ? shortSide : longSide);
  const inset = safeInsetsCss();
  // Tela inteira, SEM descontar notch nem barrinha de início: o fundo do jogo passa por baixo dos
  // dois, e quem se afasta do recorte é o HUD (`hudEdges`) e as telas HTML (`padding` em `ui.css`).
  // Só o topo respeita a área segura (em pé há a barra de status; deitado ela é zero).
  stage.style.top = `${Math.round((viewport?.offsetTop ?? 0) + inset.top)}px`;
  stage.style.left = `${Math.round(viewport?.offsetLeft ?? 0)}px`;
  stage.style.width = `${Math.max(0, Math.floor(width))}px`;
  stage.style.height = `${Math.max(0, Math.floor(height - inset.top))}px`;
}

function armStageFit(): void {
  const stage = document.getElementById("game");
  if (!stage) return;
  let timers: number[] = [];
  const refit = (): void => {
    fitStageToScreen(stage);
    // O iOS entrega o tamanho novo aos poucos depois de girar: confere de novo logo em seguida.
    timers.forEach((timer) => window.clearTimeout(timer));
    timers = [150, 500, 1000].map((delay) => window.setTimeout(() => fitStageToScreen(stage), delay));
  };
  refit();
  window.addEventListener("resize", refit);
  window.addEventListener("orientationchange", refit);
  window.visualViewport?.addEventListener("resize", refit);
  window.visualViewport?.addEventListener("scroll", refit);
  document.addEventListener("fullscreenchange", refit);
  window.addEventListener("pageshow", refit);
}

/** Arma tudo. Chamado uma vez em `main.ts`; no desktop só a pausa ao trocar de aba fica ativa. */
export function armMobileShell(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      EventBus.emit(Events.requestPause);
      wakeLock = null;
    } else void acquireWake();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as InstallPromptEvent;
  });

  if (!isTouch()) return;

  armStageFit();
  if (isStandalone()) void lockLandscape();

  const onOrientation = (): void => {
    if (isPortrait()) EventBus.emit(Events.requestPause);
  };
  window.matchMedia("(orientation: portrait)").addEventListener?.("change", onOrientation);
  window.addEventListener("orientationchange", onOrientation);

  // Pinça do Safari (que ignora `user-scalable=no` desde o iOS 10). O zoom do toque duplo sai no
  // CSS (`touch-action`), e não num `preventDefault` no `touchend` — esse engoliria o segundo toque
  // rápido num botão, que é exatamente o "melhorar duas vezes" do jogador com pressa.
  const block = (event: Event): void => event.preventDefault();
  document.addEventListener("gesturestart", block, { passive: false });
  document.addEventListener("gesturechange", block, { passive: false });
  // Toque longo não abre "copiar/salvar imagem" em cima do jogo.
  document.addEventListener("contextmenu", block);
}

/** Pulso curto de vibração (Android). No iPhone a API não existe e isto não faz nada. */
export function haptic(pattern: number | number[] = 12): void {
  if (!isTouch()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Alguns navegadores lançam fora de gesto do usuário.
  }
}

const INSTALL_HINT_KEY = "gr:install-hint-dismissed";
type InstallPromptEvent = Event & { prompt: () => Promise<void> };
let deferredInstall: InstallPromptEvent | null = null;

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * CONVITE PARA INSTALAR. Aberto pelo ícone da tela inicial, o jogo não tem barra do navegador —
 * é isso que acaba com a barra do Safari "subindo" quando se toca embaixo. O convite aparece uma
 * vez por aparelho, no hub, e só no navegador (instalado não faz sentido).
 *
 * - Android/Chrome: botão "Instalar", que abre o pedido nativo.
 * - iPhone: o Safari não tem pedido nativo, então o convite ensina o caminho.
 */
export function maybeShowInstallHint(): void {
  if (!isTouch() || isStandalone() || navigator.webdriver) return;
  try {
    if (window.localStorage.getItem(INSTALL_HINT_KEY)) return;
  } catch {
    return;
  }
  if (!isIOS() && !deferredInstall) return;
  if (document.querySelector(".gr-install")) return;

  const box = document.createElement("div");
  box.className = "gr-install";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Instalar o jogo");
  const text = isIOS()
    ? 'Jogue em tela cheia: toque em <b>Compartilhar</b> <span class="gr-install__share" aria-hidden="true"></span> e depois em <b>Adicionar à Tela de Início</b>.'
    : "Instale o jogo e abra pelo ícone: tela cheia, sem barra do navegador.";
  box.innerHTML = `<img src="icons/icon-192.png" alt="" /><p>${text}</p>`;
  const close = (): void => {
    try {
      window.localStorage.setItem(INSTALL_HINT_KEY, "1");
    } catch {
      // Sem armazenamento, o convite volta na próxima visita. Tudo bem.
    }
    box.remove();
  };
  if (deferredInstall) {
    const install = document.createElement("button");
    install.type = "button";
    install.className = "gr-install__go";
    install.textContent = "Instalar";
    install.addEventListener("click", () => {
      void deferredInstall?.prompt().finally(close);
      deferredInstall = null;
    });
    box.appendChild(install);
  }
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "gr-install__close";
  dismiss.setAttribute("aria-label", "Fechar");
  dismiss.textContent = "✕";
  dismiss.addEventListener("click", close);
  box.appendChild(dismiss);
  document.body.appendChild(box);
}

/** Service worker: o app instalado abre rápido e sem rede. Só no build (no `vite dev` atrapalharia). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator) || navigator.webdriver) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  });
}
