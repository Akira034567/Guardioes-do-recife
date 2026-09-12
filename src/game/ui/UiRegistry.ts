/**
 * Registro dos controles do HUD por nome (item 44). Serve a dois usos:
 * o tutorial destaca o botão de que está falando, e os testes e2e encontram um controle sem depender
 * de coordenadas escritas à mão. Só guarda retângulos: nenhuma regra, nenhum input.
 */
export interface UiControlBounds {
  name: string;
  /** Centro e tamanho em coordenadas do jogo (1280×720). */
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
}

export class UiRegistry {
  private readonly controls = new Map<string, UiControlBounds>();

  register(name: string, x: number, y: number, width: number, height: number): void {
    this.controls.set(name, { name, x, y, width, height, enabled: true });
  }

  setEnabled(name: string, enabled: boolean): void {
    const control = this.controls.get(name);
    if (control) control.enabled = enabled;
  }

  get(name: string): UiControlBounds | undefined {
    return this.controls.get(name);
  }

  all(): UiControlBounds[] {
    return [...this.controls.values()];
  }

  clear(): void {
    this.controls.clear();
  }
}

/** Registro da página, publicado em `window.__grUi` para os testes lerem as posições. */
export const UI_REGISTRY = new UiRegistry();

export function publishUiRegistry(): void {
  if (typeof window === "undefined") return;
  window.__grUi = {
    bounds: (name: string) => UI_REGISTRY.get(name) ?? null,
    names: () => UI_REGISTRY.all().map((control) => control.name),
  };
}

declare global {
  interface Window {
    /** Somente leitura: posições dos controles do HUD, para os testes. */
    __grUi?: {
      bounds(name: string): UiControlBounds | null;
      names(): string[];
    };
  }
}
