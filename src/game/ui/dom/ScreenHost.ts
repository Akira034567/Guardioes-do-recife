import type Phaser from "phaser";
import { GAME_WIDTH } from "../../constants";
import { getSettings, onSettingsChanged, UI_SCALE_FACTOR } from "../../systems/settings";
import "./ui.css";

/**
 * Uma tela em HTML por cima do canvas. `render` devolve o conteúdo já montado; `onClose` roda quando
 * a tela sai (por `pop`, `replace` ou `clear`).
 */
export interface Screen {
  id: string;
  render(host: ScreenHost): HTMLElement;
  /** Bloqueia o input do Phaser enquanto estiver aberta (padrão: true). */
  modal?: boolean;
  onClose?(): void;
}

/**
 * Camada de telas fora da partida (menus, resultado, coleção, história). Fica alinhada ao canvas e
 * escala junto com ele, então a mesma tela serve em qualquer resolução. O HUD da partida continua em
 * Phaser; aqui só entra o que é texto e navegação.
 */
export class ScreenHost {
  private readonly root: HTMLDivElement;
  private readonly stack: Array<{ screen: Screen; element: HTMLElement }> = [];

  private readonly unsubscribeSettings: () => void;
  /** Quem quer saber qual tela está no topo (o hub pausa a cena quando uma seção o cobre). */
  private readonly topListeners = new Set<(topId: string | null) => void>();

  constructor(private readonly game: Phaser.Game) {
    this.root = document.createElement("div");
    this.root.id = "ui-layer";
    (this.game.canvas.parentElement ?? document.body).append(this.root);
    this.game.scale.on("resize", this.align, this);
    window.addEventListener("resize", this.align);
    // A escala da interface é uma configuração do jogador (item 36).
    this.unsubscribeSettings = onSettingsChanged(this.align);
    this.align();
  }

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  /** Tela cheia é do canvas; a camada HTML acompanha porque está presa a ele. */
  get isFullscreen(): boolean {
    return this.game.scale.isFullscreen;
  }

  toggleFullscreen(): void {
    this.game.scale.toggleFullscreen();
  }

  get topId(): string | null {
    return this.stack.at(-1)?.screen.id ?? null;
  }

  /**
   * Avisa quando a tela do topo muda. A cena do hub usa isto para pausar enquanto uma seção está
   * aberta por cima, em vez de ficar conferindo `topId` a cada quadro.
   */
  onTopChanged(listener: (topId: string | null) => void): () => void {
    this.topListeners.add(listener);
    return () => this.topListeners.delete(listener);
  }

  /** Abre uma tela por cima das outras. */
  push(screen: Screen): void {
    const element = screen.render(this);
    element.classList.add("gr-screen");
    element.dataset.screen = screen.id;
    this.root.append(element);
    this.stack.push({ screen, element });
    this.sync();
  }

  /** Troca a tela do topo (sem empilhar). */
  replace(screen: Screen): void {
    this.pop();
    this.push(screen);
  }

  pop(): void {
    const entry = this.stack.pop();
    if (!entry) return;
    entry.element.remove();
    entry.screen.onClose?.();
    this.sync();
  }

  clear(): void {
    while (this.stack.length > 0) this.pop();
  }

  destroy(): void {
    this.clear();
    this.topListeners.clear();
    this.unsubscribeSettings();
    this.game.scale.off("resize", this.align, this);
    window.removeEventListener("resize", this.align);
    this.root.remove();
  }

  /** Mantém a camada exatamente sobre o canvas e ajusta a escala das telas. */
  private readonly align = (): void => {
    const bounds = this.game.scale.canvasBounds;
    const parent = this.game.canvas.parentElement;
    const origin = parent?.getBoundingClientRect();
    this.root.style.left = `${bounds.x - (origin?.x ?? 0)}px`;
    this.root.style.top = `${bounds.y - (origin?.y ?? 0)}px`;
    this.root.style.width = `${bounds.width}px`;
    this.root.style.height = `${bounds.height}px`;
    const settings = getSettings();
    const fit = Math.max(0.55, bounds.width / GAME_WIDTH);
    this.root.style.setProperty("--gr-scale", String(fit * UI_SCALE_FACTOR[settings.uiScale]));
    this.root.dataset.contrast = settings.highContrast ? "high" : "normal";
  };

  /** Enquanto houver tela modal aberta, o jogo não recebe cliques. */
  private sync(): void {
    const top = this.stack.at(-1);
    const modal = top ? (top.screen.modal ?? true) : false;
    this.game.input.enabled = !modal;
    const topId = top?.screen.id ?? null;
    this.game.canvas.dataset.overlay = topId ?? "";
    this.topListeners.forEach((listener) => listener(topId));
  }
}
