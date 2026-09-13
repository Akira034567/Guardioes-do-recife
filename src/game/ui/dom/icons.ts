/**
 * Pictogramas das telas em HTML. São SVG inline (via `h(..., { html })`) em vez de emoji porque
 * emoji muda de desenho e de cor a cada sistema — e a tela de preparação depende das cores para
 * separar as três dificuldades e os quatro números da fase.
 *
 * Todos desenham dentro de `0 0 24 24` e herdam o tamanho do `.gr-icon` que os envolve.
 */
const svg = (body: string): string => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

/** Uma crista de onda; `y` posiciona a crista para empilhar duas ou três. */
const crest = (y: number, color: string, opacity = 1): string =>
  `<path d="M2 ${y}q3.5 -4 7 0t7 0t7 0" fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" opacity="${opacity}"/>`;

export const ICONS = {
  /** Ondas da fase. */
  waves: svg(`${crest(7, "#5fd0f0")}${crest(13, "#8fe6ff", 0.85)}${crest(19, "#bff3ff", 0.6)}`),

  /** Vidas do Recife. */
  heart: svg(
    `<path d="M12 21S3.6 15.4 3.6 9.6A4.6 4.6 0 0 1 12 6.9a4.6 4.6 0 0 1 8.4 2.7C20.4 15.4 12 21 12 21z" fill="#ff5c6b" stroke="#ffb3ba" stroke-width="1.3" stroke-linejoin="round"/>` +
      `<path d="M8.3 8.6a2.4 2.4 0 0 1 2-1.2" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>`,
  ),

  /** Pérolas: a moeda de dentro da partida. */
  pearl: svg(
    `<circle cx="12" cy="12" r="8.4" fill="#e8f4fb" stroke="#9fc4d8" stroke-width="1.2"/>` +
      `<circle cx="12" cy="12" r="8.4" fill="none" stroke="#fff" stroke-width="1.2" opacity="0.5"/>` +
      `<ellipse cx="9.4" cy="9.2" rx="2.6" ry="1.8" fill="#fff" opacity="0.95" transform="rotate(-35 9.4 9.2)"/>`,
  ),

  /** Conchas: a moeda entre partidas, que paga os objetivos. */
  shell: svg(
    `<path d="M12 3.4c4.8 0 8.6 4 8.6 8.8 0 3.4-1.7 6.2-4 7.6H7.4c-2.3-1.4-4-4.2-4-7.6 0-4.8 3.8-8.8 8.6-8.8z" fill="#ffe9b6" stroke="#e0b566" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<g fill="none" stroke="#d8a95e" stroke-width="1.1" stroke-linecap="round"><path d="M12 3.6v16.2"/><path d="M8.2 4.4 6.1 19.4"/><path d="M15.8 4.4l2.1 15"/><path d="M4.6 8.2 4 18.6"/><path d="M19.4 8.2l.6 10.4"/></g>`,
  ),

  /** Estrelas da fase. */
  star: svg(
    `<path d="M12 2.8l2.8 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.4 6.3 20.5l1.1-6.4L2.8 9.6l6.4-.9z" fill="#ffc93c" stroke="#ffe8a8" stroke-width="1.2" stroke-linejoin="round"/>`,
  ),

  /** Estrela vazia do objetivo ainda não cumprido. */
  starOutline: svg(
    `<path d="M12 2.8l2.8 5.9 6.4.9-4.6 4.5 1.1 6.4L12 17.4 6.3 20.5l1.1-6.4L2.8 9.6l6.4-.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  ),

  /** Tridente: cabeçalho da dificuldade. */
  trident: svg(
    `<g fill="none" stroke="#75dff4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M12 3.2v17.6"/><path d="M5.4 6.2v3.4a6.6 6.6 0 0 0 13.2 0V6.2"/>` +
      `<path d="M5.4 6.2 3.6 8.4M18.6 6.2l1.8 2.2"/><path d="M9.6 18.6h4.8"/>` +
      `</g>`,
  ),

  /** Caveira: cabeçalho das ameaças. */
  skull: svg(
    `<path d="M12 2.8c-4.6 0-7.6 3-7.6 7.2 0 2.6 1.1 4.1 2.2 5 .5.4.8 1 .8 1.7v1.5c0 1.1.9 2 2 2h5.2c1.1 0 2-.9 2-2v-1.5c0-.7.3-1.3.8-1.7 1.1-.9 2.2-2.4 2.2-5 0-4.2-3-7.2-7.6-7.2z" fill="#cfe9f5" stroke="#8fbdd2" stroke-width="1.1" stroke-linejoin="round"/>` +
      `<circle cx="9.1" cy="10.4" r="2.1" fill="#123146"/><circle cx="14.9" cy="10.4" r="2.1" fill="#123146"/>` +
      `<path d="M12 13.6l-1 2.2h2z" fill="#123146"/>`,
  ),

  /** Cardume de três: cabeçalho do esquadrão. */
  squad: svg(
    `<g fill="#75dff4">` +
      `<circle cx="8" cy="8.6" r="2.7"/><circle cx="16" cy="8.6" r="2.7" opacity="0.75"/>` +
      `<path d="M2.6 19.4c0-3 2.4-5 5.4-5s5.4 2 5.4 5z"/>` +
      `<path d="M14.4 14.8c2.9.2 5 2.1 5 4.6h-4.2c0-1.7-.6-3.3-1.6-4.4z" opacity="0.75"/>` +
      `</g>`,
  ),

  /** Marcador de dificuldade: uma, duas ou três cristas na cor do nível. */
  difficulty: (count: 1 | 2 | 3, color: string): string =>
    svg(Array.from({ length: count }, (_, index) => crest(12 - (count - 1) * 3 + index * 6, color, 1 - index * 0.18)).join("")),

  chevronLeft: svg(`<path d="M15 4.5 7.5 12 15 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronRight: svg(`<path d="M9 4.5 16.5 12 9 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  close: svg(`<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`),
  plus: svg(`<path d="M12 5.6v12.8M5.6 12h12.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`),
} as const;

/** A onda do logotipo, que é mais larga do que os pictogramas quadrados. */
export const BRAND_WAVE = `<svg viewBox="0 0 120 18" aria-hidden="true" focusable="false"><path d="M2 11c9-9 18 5 27-3s18 5 27-3 18 5 27-3 18 5 27-3" fill="none" stroke="#4bb8e8" stroke-width="4" stroke-linecap="round"/></svg>`;
