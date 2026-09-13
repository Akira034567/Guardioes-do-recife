/**
 * Arrastar para reordenar (item 7). Genérico: recebe um contêiner de uma linha com N colunas iguais
 * e avisa quando o jogador move um item de posição.
 *
 * Pointer Events, e não a API de arrastar do HTML: `dragstart`/`drop` não disparam no toque em
 * Chrome móvel sem polyfill, e o projeto tem um alvo de celular nos testes. `setPointerCapture`
 * ainda garante que o `pointerup` chegue mesmo se o dedo sair do elemento.
 */

export interface ReorderOptions {
  container: HTMLElement;
  /** Quantas colunas a linha tem: o destino sai de aritmética, não de acerto de ponteiro. */
  columns: number;
  /** Só itens aprovados aqui podem ser arrastados (vaga vazia, não). */
  draggable(item: HTMLElement): boolean;
  onReorder(from: number, to: number): void;
  /** Seletor dos filhos que não iniciam arrasto (o botão de remover, por exemplo). */
  ignoreSelector?: string;
  /** Classe dos itens dentro do contêiner. */
  itemSelector: string;
}

/**
 * Distância mínima para virar arrasto. É ela que preserva o TOQUE CURTO: encostar numa vaga
 * continua abrindo o seletor, só puxar é que move.
 */
const DRAG_THRESHOLD = 8;

export function enableReorder(options: ReorderOptions): () => void {
  const { container, itemSelector } = options;
  let pointerId: number | null = null;
  let from = -1;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let ghost: HTMLElement | null = null;
  let source: HTMLElement | null = null;
  let target = -1;

  const itemAt = (index: number): HTMLElement | null => container.querySelectorAll<HTMLElement>(itemSelector)[index] ?? null;

  const cleanup = (): void => {
    ghost?.remove();
    ghost = null;
    source?.classList.remove("gr-prep__slot--placeholder");
    source = null;
    container.querySelectorAll(".gr-prep__slot--drop").forEach((element) => element.classList.remove("gr-prep__slot--drop"));
    if (pointerId !== null && container.hasPointerCapture(pointerId)) {
      try {
        container.releasePointerCapture(pointerId);
      } catch {
        /* já solto */
      }
    }
    pointerId = null;
    dragging = false;
    from = -1;
    target = -1;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const item = (event.target as HTMLElement | null)?.closest<HTMLElement>(itemSelector);
    if (!item || !container.contains(item)) return;
    if (options.ignoreSelector && (event.target as HTMLElement).closest(options.ignoreSelector)) return;
    if (!options.draggable(item)) return;
    const items = [...container.querySelectorAll<HTMLElement>(itemSelector)];
    from = items.indexOf(item);
    if (from < 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
  };

  const startDrag = (event: PointerEvent): void => {
    const item = itemAt(from);
    if (!item) return;
    dragging = true;
    // Captura no contêiner para o `pointerup` chegar mesmo se o dedo sair dele. Pode falhar se o
    // ponteiro já não estiver ativo; não é motivo para abortar o arrasto.
    try {
      container.setPointerCapture(event.pointerId);
    } catch {
      /* segue sem captura: os listeners de janela abaixo dão conta */
    }
    const rect = item.getBoundingClientRect();
    ghost = item.cloneNode(true) as HTMLElement;
    ghost.classList.add("gr-prep__drag-ghost");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    document.body.append(ghost);
    source = item;
    source.classList.add("gr-prep__slot--placeholder");
    moveGhost(event);
  };

  const moveGhost = (event: PointerEvent): void => {
    if (!ghost) return;
    const rect = ghost.getBoundingClientRect();
    ghost.style.left = `${event.clientX - rect.width / 2}px`;
    ghost.style.top = `${event.clientY - rect.height / 2}px`;
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId || from < 0) return;
    if (!dragging) {
      if (Math.hypot(event.clientX - startX, event.clientY - startY) < DRAG_THRESHOLD) return;
      startDrag(event);
      if (!dragging) return;
    }
    event.preventDefault();
    moveGhost(event);

    // Destino por aritmética sobre a caixa do contêiner: mais estável que acertar o elemento sob o
    // ponteiro, e não se confunde com o próprio fantasma que segue o dedo.
    const bounds = container.getBoundingClientRect();
    const column = Math.floor(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * options.columns);
    const next = Math.max(0, Math.min(options.columns - 1, column));
    if (next === target) return;
    container.querySelectorAll(".gr-prep__slot--drop").forEach((element) => element.classList.remove("gr-prep__slot--drop"));
    target = next;
    if (target !== from) itemAt(target)?.classList.add("gr-prep__slot--drop");
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    const moved = dragging && target >= 0 && target !== from;
    const origin = from;
    const destination = target;
    cleanup();
    if (moved) options.onReorder(origin, destination);
  };

  const onPointerCancel = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    cleanup();
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && dragging) cleanup();
  };

  /**
   * O arrasto NATIVO do navegador precisa morrer antes de começar. A vaga tem um `<img>` dentro, e
   * imagem é arrastável por padrão: ao cruzar o limiar, o Chromium iniciava o próprio gesto de
   * arrastar e emitia `pointercancel` — o que derrubava este arrasto logo no primeiro movimento,
   * sem erro nenhum no console.
   */
  const onDragStart = (event: Event): void => event.preventDefault();

  // Só o `pointerdown` é do contêiner. Movimento e soltura ficam na janela: assim que o arrasto
  // começa o ponteiro passeia por cima de qualquer elemento, e amarrar os eventos ao alvo (ou à
  // captura de ponteiro) deixa buracos difíceis de reproduzir.
  container.addEventListener("pointerdown", onPointerDown);
  container.addEventListener("dragstart", onDragStart);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  window.addEventListener("keydown", onKeyDown);

  return () => {
    cleanup();
    container.removeEventListener("pointerdown", onPointerDown);
    container.removeEventListener("dragstart", onDragStart);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
    window.removeEventListener("keydown", onKeyDown);
  };
}
