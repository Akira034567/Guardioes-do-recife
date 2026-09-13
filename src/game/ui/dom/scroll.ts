/**
 * Preserva a rolagem e o foco quando uma tela se redesenha (item 6).
 *
 * As telas de coleção reconstroem o miolo inteiro a cada clique num card. Como a grade rola por
 * dentro, isso jogava o conteúdo de volta ao topo e ainda tirava o foco do botão clicado — a página
 * "pulava" a cada escolha. Guardar a posição antes e repô-la depois resolve sem exigir que cada tela
 * vire atualização cirúrgica.
 */

/** Onde procurar rolagem: os contêineres que de fato rolam nas telas de menu. */
const SCROLLERS = ".gr-album__grid, .gr-album__sheet, .gr-prep__side, .gr-prep__main, .gr-world__nav";

export function preserveScroll(root: HTMLElement, mutate: () => void): void {
  const before = [...root.querySelectorAll<HTMLElement>(SCROLLERS)].map((element) => ({
    key: scrollerKey(element),
    top: element.scrollTop,
    left: element.scrollLeft,
  }));
  const focused = document.activeElement as HTMLElement | null;
  const focusedId = focused && root.contains(focused) ? (focused.dataset.testid ?? null) : null;

  mutate();

  // O foco vem ANTES da rolagem, e não depois: devolver o foco a um elemento recriado pode mover a
  // rolagem sozinho (o `preventScroll` nem sempre é respeitado dentro de contêineres aninhados), e
  // quem tem que dar a palavra final sobre a posição é esta função.
  if (focusedId) root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(focusedId)}"]`)?.focus({ preventScroll: true });
  for (const element of root.querySelectorAll<HTMLElement>(SCROLLERS)) {
    const saved = before.find((entry) => entry.key === scrollerKey(element));
    if (!saved) continue;
    element.scrollTop = saved.top;
    element.scrollLeft = saved.left;
  }
}

/**
 * Casa o rolador de antes com o de depois. A classe basta: cada tela tem no máximo uma grade e uma
 * ficha, e um rolador que troque de classe entre os dois desenhos merece começar do topo mesmo.
 */
function scrollerKey(element: HTMLElement): string {
  return element.className;
}
