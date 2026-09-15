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

  /** Rosa dos ventos: o mapa. */
  compass: svg(
    `<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M15.4 8.6 13 13l-4.4 2.4L11 11z" fill="currentColor"/>` +
      `<circle cx="12" cy="12" r="1.1" fill="#02141f"/>`,
  ),

  /** Peixe de perfil: os Guardiões. */
  fish: svg(
    `<path d="M9.4 5.6c4.2 0 8 2.4 10.4 6.4-2.4 4-6.2 6.4-10.4 6.4-3 0-5.4-1.4-6.8-3.6l2.4-2.8-2.4-2.8c1.4-2.2 3.8-3.6 6.8-3.6z" fill="currentColor"/>` +
      `<path d="m19.8 12 2.6-3.2v6.4z" fill="currentColor"/>` +
      `<circle cx="7.6" cy="10.4" r="1.2" fill="#02141f"/>`,
  ),

  /** Baiacu espinhoso: as ameaças. */
  spiky: svg(
    `<g stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 1.6v2.6M12 19.8v2.6M1.6 12h2.6M19.8 12h2.6M4.6 4.6l1.9 1.9M17.5 17.5l1.9 1.9M19.4 4.6l-1.9 1.9M6.5 17.5l-1.9 1.9"/></g>` +
      `<circle cx="12" cy="12" r="6.2" fill="currentColor"/><circle cx="9.9" cy="10.6" r="1.1" fill="#02141f"/><circle cx="14.1" cy="10.6" r="1.1" fill="#02141f"/>`,
  ),

  /** Livro aberto: as histórias. */
  book: svg(
    `<path d="M3 5.2h5.4c1.6 0 2.9.8 3.6 1.9.7-1.1 2-1.9 3.6-1.9H21v13h-5.4c-1.6 0-2.9.8-3.6 1.9-.7-1.1-2-1.9-3.6-1.9H3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M12 7.1v12.9" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
  ),

  /** Troféu: as conquistas. */
  trophy: svg(
    `<path d="M7 3.4h10v5.2a5 5 0 0 1-10 0z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>` +
      `<path d="M7 5.2H4.2v1.6A3.4 3.4 0 0 0 7.2 10M17 5.2h2.8v1.6A3.4 3.4 0 0 1 16.8 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>` +
      `<path d="M12 13.8v3.4M8.6 20.6h6.8M9.6 17.2h4.8l1 3.4H8.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>`,
  ),

  /** Engrenagem: as configurações. */
  gear: svg(
    `<path d="M12 8.2A3.8 3.8 0 1 0 12 15.8 3.8 3.8 0 0 0 12 8.2z" fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M19.4 14.6a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.6 1.1v.3a1.8 1.8 0 0 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1.1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1.1-2.6h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1.1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.6-1.1v-.3a1.8 1.8 0 0 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1.1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1.1 2.6h.3a1.8 1.8 0 0 1 0 3.6h-.2a1.5 1.5 0 0 0-1.4.9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>`,
  ),

  /** Coral ramificado: os lugares do Recife. */
  coral: svg(
    `<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">` +
      `<path d="M12 21.4v-7.2M12 14.2 8.4 10.6M12 14.2l3.8-3.8M8.4 10.6V6.8M15.8 10.4V7M8.4 10.6 5.4 8.2M15.8 10.4l2.8-2.4"/>` +
      `<path d="M4.4 21.4h15.2"/></g>` +
      `<g fill="currentColor"><circle cx="8.4" cy="5.8" r="1.7"/><circle cx="15.8" cy="6" r="1.7"/><circle cx="4.6" cy="7.4" r="1.5"/><circle cx="19.4" cy="7" r="1.5"/></g>`,
  ),

  /** Baú: os achados escondidos no mapa. */
  chest: svg(
    `<path d="M3.4 10.4a8.6 8.6 0 0 1 17.2 0v1.2H3.4z" fill="currentColor"/>` +
      `<rect x="3.4" y="11.6" width="17.2" height="8.4" rx="1.8" fill="currentColor"/>` +
      `<rect x="10.4" y="9.2" width="3.2" height="6" rx="1.1" fill="#02141f"/>`,
  ),

  /** Lâminas cruzadas: as conquistas de combate. */
  swords: svg(
    `<g fill="currentColor">` +
      `<path d="M18.6 2.6h2.8v2.8l-8.1 8.1-2.8-2.8z"/><path d="M5.4 2.6H2.6v2.8l8.1 8.1 2.8-2.8z"/>` +
      `</g>` +
      `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">` +
      `<path d="M14.6 16.2 20 21.6M9.4 16.2 4 21.6"/><path d="M13.4 19.4 16.6 16.2M10.6 19.4 7.4 16.2"/></g>`,
  ),

  /** Cadeado: região ou fase ainda fechada. */
  lock: svg(
    `<rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.4" fill="currentColor"/>` +
      `<path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" fill="none" stroke="currentColor" stroke-width="2"/>` +
      `<circle cx="12" cy="15.2" r="1.5" fill="#02141f"/>`,
  ),

  /** Alvo: o desafio do dia. */
  target: svg(
    `<g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4"/></g><circle cx="12" cy="12" r="1.3" fill="currentColor"/>`,
  ),

  /** Calendário: o desafio da semana. */
  calendar: svg(
    `<rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M3.4 10.2h17.2M8 3.4v4M16 3.4v4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  ),

  /** Ampulheta: o prazo do desafio. */
  timer: svg(
    `<circle cx="12" cy="13.4" r="7.4" fill="none" stroke="currentColor" stroke-width="1.8"/>` +
      `<path d="M12 9.2v4.2l2.8 1.8M9.4 2.6h5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  ),

  /** Triângulo cheio: entrar na fase. */
  /** Um mergulhador de perfil: a conta é a pessoa que joga, não mais um bicho do Recife. */
  account: svg(
    `<circle cx="12" cy="8" r="3.6" fill="currentColor"/>` +
      `<path d="M4.8 20c0-3.8 3.2-6.2 7.2-6.2s7.2 2.4 7.2 6.2z" fill="currentColor" opacity="0.85"/>` +
      `<path d="M3 21.4c1.8-1.2 3.2-1.2 5 0 1.8 1.2 3.2 1.2 5 0 1.8-1.2 3.2-1.2 5 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>`,
  ),

  play: svg(`<path d="M7.6 4.6 19 12 7.6 19.4z" fill="currentColor"/>`),

  chevronLeft: svg(`<path d="M15 4.5 7.5 12 15 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  chevronRight: svg(`<path d="M9 4.5 16.5 12 9 19.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`),
  close: svg(`<path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`),
  menu: svg(`<path d="M4.5 7h15M4.5 12h15M4.5 17h15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`),
  plus: svg(`<path d="M12 5.6v12.8M5.6 12h12.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>`),
} as const;

/** Rosa dos ventos do canto do mapa, com as letras em português (N, S, L, O). */
export const MAP_COMPASS =
  `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">` +
  `<g fill="none" stroke="#bfe8f7" stroke-width="1.6" opacity="0.75"><circle cx="32" cy="32" r="15"/><circle cx="32" cy="32" r="19.5" stroke-dasharray="2 4"/></g>` +
  `<path d="M32 17.5 35.4 30 32 46.5 28.6 30z" fill="#f2fbff" opacity="0.9"/>` +
  `<path d="M17.5 32 30 28.6 46.5 32 30 35.4z" fill="#7fd7f0" opacity="0.8"/>` +
  `<g fill="#e9fbff" font-family="Arial, sans-serif" font-size="10" font-weight="bold" text-anchor="middle">` +
  `<text x="32" y="9">N</text><text x="32" y="62">S</text><text x="58" y="36">L</text><text x="6" y="36">O</text></g></svg>`;

/** A onda do logotipo, que é mais larga do que os pictogramas quadrados. */
export const BRAND_WAVE = `<svg viewBox="0 0 120 18" aria-hidden="true" focusable="false"><path d="M2 11c9-9 18 5 27-3s18 5 27-3 18 5 27-3 18 5 27-3" fill="none" stroke="#4bb8e8" stroke-width="4" stroke-linecap="round"/></svg>`;
