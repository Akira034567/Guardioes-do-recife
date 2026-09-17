import type Phaser from "phaser";

/**
 * Ícones dos efeitos de status, fatiados de uma prancha só
 * (`art/status/status-sheet.png`, cortada por `scripts/slice-status-sheet.py`).
 *
 * Substituem os círculos e pontinhos vetoriais que marcavam status antes: com cinco efeitos podendo
 * coexistir, aquilo virava uma sopa de anéis coloridos em volta da criatura e ninguém distinguia
 * "lento" de "vulnerável". O ícone diz o que é de longe, sem precisar decorar a cor.
 *
 * Nem todo marcador virou ícone: `revealed` (camuflado exposto) e `priority` (ameaça marcada pelo
 * sonar) continuam anéis, porque falam da LEITURA do campo, não de um efeito sofrido pela criatura —
 * misturar os dois na mesma fileira apagaria justamente a diferença.
 */
export type StatusIcon = "stun" | "slow" | "poison" | "vulnerable" | "marked";

export const STATUS_ICONS: readonly StatusIcon[] = ["stun", "slow", "poison", "vulnerable", "marked"];

export function statusIconKey(icon: StatusIcon): string {
  return `status-${icon}`;
}

export function statusIconPath(icon: StatusIcon): string {
  return `assets/status/${icon}.png`;
}

/**
 * Lado do ícone em pixels de jogo. A 15 px o floco de neve virava uma mancha azul — estes desenhos
 * têm detalhe demais para ficarem menores que isto e ainda serem reconhecíveis de relance.
 */
export const STATUS_ICON_SIZE = 19;

/** Espaço entre ícones quando mais de um está ativo. */
export const STATUS_ICON_GAP = 17;

/**
 * Quantos cabem ao mesmo tempo sobre uma criatura.
 *
 * Três é o teto de propósito: com cinco, a fileira fica mais larga que o inimigo e passa a cobrir os
 * vizinhos. A ordem de `STATUS_ICONS` é a de prioridade, então o que sobra é sempre o menos urgente.
 */
export const STATUS_ICON_MAX = 3;

export function preloadStatusArt(scene: Phaser.Scene): void {
  for (const icon of STATUS_ICONS) {
    const key = statusIconKey(icon);
    if (!scene.textures.exists(key)) scene.load.image(key, statusIconPath(icon));
  }
}
