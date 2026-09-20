import { button, h } from "../h";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  icon?: string;
  testId: string;
  /**
   * Quanto tempo o botão de confirmar fica DESARMADO depois de a tela abrir.
   *
   * É a proteção contra o toque duplo: quem aperta R duas vezes rápido (ou clica duas vezes no
   * botão) está repetindo o gesto que ABRIU esta tela, não respondendo a ela. Meio segundo é o
   * bastante para o olho registrar que apareceu uma pergunta, e pouco o bastante para não irritar
   * quem realmente quis confirmar.
   */
  armDelayMs?: number;
  onConfirm(): void;
  onCancel(): void;
}

export const CONFIRM_ARM_MS = 600;

/**
 * Uma pergunta de sim ou não por cima do jogo, com o sim DESARMADO por um instante.
 *
 * `armed()` é público para quem responde por teclado: a tecla precisa obedecer exatamente à mesma
 * carência do botão, senão a proteção existiria só para o mouse.
 */
export interface ConfirmScreen extends Screen {
  /** Já dá para confirmar? */
  armed(): boolean;
  confirm(): void;
  cancel(): void;
}

export function confirmScreen(options: ConfirmOptions): ConfirmScreen {
  const armDelay = options.armDelayMs ?? CONFIRM_ARM_MS;
  const openedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const armed = (): boolean => Date.now() - openedAt >= armDelay;

  const confirm = (): void => {
    if (!armed()) return;
    options.onConfirm();
  };

  return {
    id: "confirm",
    armed,
    confirm,
    cancel: options.onCancel,
    onClose() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    render() {
      const okButton = button(options.confirmLabel, confirm, { testId: `${options.testId}-ok`, variant: "danger", disabled: !armed() });
      const root = h(
        "div",
        { class: "gr-confirm", testId: options.testId, dataArmed: String(armed()) },
        h(
          "div",
          { class: "gr-panel gr-confirm__panel" },
          h("span", { class: "gr-icon gr-icon--lg", html: options.icon ?? ICONS.refresh }),
          h("h1", { class: "gr-title", text: options.title }),
          h("p", { text: options.message }),
          h(
            "div",
            { class: "gr-actions" },
            button(options.cancelLabel ?? "CANCELAR", options.onCancel, { testId: `${options.testId}-cancel`, variant: "primary" }),
            okButton,
          ),
          h("p", { class: "gr-hint", text: "Enter ou R confirma · Esc cancela" }),
        ),
      );
      // Arma o botão quando a carência passa, sem redesenhar a tela inteira.
      if (!armed()) {
        timer = setTimeout(() => {
          okButton.disabled = false;
          root.dataset.armed = "true";
        }, Math.max(0, armDelay - (Date.now() - openedAt)));
      }
      return root;
    },
  };
}
