import type Phaser from "phaser";

/**
 * Ícones dos efeitos de status (`art/status/`, preparados por `scripts/prepare-status-icons.py`).
 *
 * Substituem os círculos e pontinhos vetoriais que marcavam status antes: com cinco efeitos podendo
 * coexistir, aquilo virava uma sopa de anéis coloridos em volta da criatura e ninguém distinguia
 * "lento" de "vulnerável". O ícone diz o que é de longe, sem precisar decorar a cor.
 *
 * A mira é REVELADO — o camuflado exposto —, não "marcado". A marca do Tubarão Alfa continua sendo o
 * triângulo vetorial apontando para a presa, e a prioridade do sonar o losango: as duas dizem "mire
 * aqui" para o JOGADOR, enquanto os ícones dizem o que a criatura está sofrendo. São coisas
 * diferentes e um ícone comum apagaria a diferença.
 */
export type StatusIcon = "stun" | "slow" | "poison" | "vulnerable" | "revealed";

export const STATUS_ICONS: readonly StatusIcon[] = ["stun", "slow", "poison", "vulnerable", "revealed"];

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
export const STATUS_ICON_SIZE = 21;

/** Espaço entre ícones quando mais de um está ativo. */
export const STATUS_ICON_GAP = 16;

/**
 * Transparência do ícone. Ele fica EM CIMA do corpo do inimigo, não flutuando acima da cabeça — é
 * assim que ele diz "esta criatura está envenenada" em vez de "existe um ícone por perto". Um pouco
 * de transparência mantém a silhueta do bicho legível por baixo.
 */
export const STATUS_ICON_ALPHA = 0.88;

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
