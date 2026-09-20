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
    restoreScroll(element, saved.top, saved.left);
  }
}

/** Por quantos quadros insistir na posição antes de desistir (~0,5s a 60 Hz). */
const RESTORE_FRAMES = 30;

/**
 * Repõe a rolagem — e INSISTE enquanto a altura não for a final.
 *
 * Uma atribuição só não basta. O conteúdo recém-montado tem imagens que ainda não carregaram, e
 * imagem sem carregar não tem altura: o contêiner está mais curto do que vai ficar, o navegador
 * limita `scrollTop` ao máximo daquele instante e a posição some para sempre. O sintoma é uma tela
 * que "às vezes" volta ao topo ao escolher um card — e o "às vezes" é exatamente o que torna isso
 * difícil de acreditar quando alguém relata.
 *
 * Duas saídas antecipadas: acertar o alvo (o caso normal, no primeiro quadro) e o jogador rolar
 * durante a janela. A segunda importa: quem mexeu na roda decidiu para onde quer olhar, e nada aqui
 * pode puxar a tela de volta.
 */
function restoreScroll(element: HTMLElement, top: number, left: number): void {
  let frames = 0;
  /** O que a última escrita realmente conseguiu; `null` = ainda não escrevemos nada. */
  let written: number | null = null;

  const step = (): void => {
    if (!element.isConnected) return;
    if (written !== null && Math.abs(element.scrollTop - written) > 1) return;
    element.scrollTop = top;
    element.scrollLeft = left;
    written = element.scrollTop;
    if (Math.abs(written - top) <= 1 || frames >= RESTORE_FRAMES) return;
    frames += 1;
    requestAnimationFrame(step);
  };

  step();
  if (written !== null && Math.abs(written - top) <= 1) return;

  /*
   * Não coube no primeiro quadro. Além de insistir por alguns quadros, vale esperar as IMAGENS: na
   * primeira visita elas vêm da rede, e nenhum orçamento de tempo cobre uma conexão ruim. Cada uma
   * que chega é uma chance a mais de a altura final aparecer — e a tentativa custa uma atribuição.
   */
  for (const image of element.querySelectorAll("img")) {
    if (image.complete) continue;
    const onSettled = (): void => {
      image.removeEventListener("load", onSettled);
      image.removeEventListener("error", onSettled);
      step();
    };
    image.addEventListener("load", onSettled);
    image.addEventListener("error", onSettled);
  }
}

/**
 * Casa o rolador de antes com o de depois. A classe basta: cada tela tem no máximo uma grade e uma
 * ficha, e um rolador que troque de classe entre os dois desenhos merece começar do topo mesmo.
 */
function scrollerKey(element: HTMLElement): string {
  return element.className;
}
