/** Criação de elementos sem framework: `h("div", { class: "x" }, "texto", outroElemento)`. */
export type Child = Node | string | number | false | null | undefined;

export interface Attributes {
  class?: string;
  testId?: string;
  text?: string;
  html?: string;
  onClick?: (event: MouseEvent) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  disabled?: boolean;
  [key: string]: unknown;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Attributes = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") element.className = String(value);
    else if (key === "testId") element.dataset.testid = String(value);
    else if (key === "text") element.textContent = String(value);
    else if (key === "html") element.innerHTML = String(value);
    // Qualquer `onXxx` vira um listener do evento `xxx`: `onClick`, `onKeyDown`, `onPointerDown`…
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    else if (key === "disabled") (element as HTMLButtonElement).disabled = Boolean(value);
    else if (key.startsWith("data")) element.setAttribute(key.replace(/([A-Z])/g, "-$1").toLowerCase(), String(value));
    else element.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

/**
 * `replaceChildren` que aceita `null` e `false` como "não renderizar", igual ao `h()`. Sem isto,
 * toda árvore com um filho condicional precisa de um `.filter` à mão no lugar da chamada.
 */
export function fill(parent: HTMLElement, ...children: Child[]): void {
  parent.replaceChildren(
    ...children
      .filter((child): child is Node | string | number => child !== null && child !== undefined && child !== false)
      .map((child) => (child instanceof Node ? child : document.createTextNode(String(child)))),
  );
}

/** Botão do tema: `primary` para a ação principal, `ghost` para as secundárias. */
export function button(label: string, onClick: () => void, options: { testId?: string; variant?: "primary" | "ghost" | "danger"; disabled?: boolean } = {}): HTMLButtonElement {
  return h("button", {
    class: `gr-button gr-button--${options.variant ?? "ghost"}`,
    testId: options.testId,
    text: label,
    disabled: options.disabled,
    onClick,
    type: "button",
  });
}
