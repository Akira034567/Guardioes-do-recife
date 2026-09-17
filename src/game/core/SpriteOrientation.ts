import type { EnemyArtRef } from "../types";

/**
 * Para que lado a criatura olha (item 9).
 *
 * A prancha inteira de inimigos (`art/enemies/enemies-sheet.png`) foi desenhada apontando para a
 * DIREITA, mas a view assumia o contrário e espelhava tudo no construtor. Sete dos oito inimigos
 * nadavam de ré; só o Peixe-Flecha escapava, por declarar `facing: "right"` explicitamente.
 *
 * Vive em `core/` e não na view porque a mesma transformação prende os pontos fracos ao dorso do
 * chefe: motor e desenho precisam concordar no pixel, senão os corais descolam da baleia.
 */

/** Quanto da inclinação real da rota entra no desenho. 🔶 placeholder de apresentação. */
const TILT_GAIN = 0.6;
/** Teto da inclinação, em radianos (~28°). Acima disso a silhueta fica ilegível. 🔶 placeholder. */
const MAX_TILT = 0.5;
/**
 * Faixa em torno da vertical onde o lado não é decidido de novo. Sem ela, um trecho quase vertical
 * da rota faz `cos(heading)` cruzar o zero várias vezes e a criatura pisca de um lado para o outro.
 * 🔶 placeholder.
 */
const DEADZONE = 0.15;

export interface SpriteOrientation {
  flipX: boolean;
  rotation: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/**
 * Inclinação de nado, independente do lado. `asin(sin(h))` dobra o ângulo para `[-π/2, π/2]`: o que
 * sobra é só o quanto a criatura sobe ou desce, que é exatamente o que o desenho precisa mostrar.
 * Girar pelo `heading` cru colocaria o bicho de cabeça para baixo na metade esquerda da rota.
 */
export function spriteTilt(heading: number): number {
  return clamp(Math.asin(clamp(Math.sin(heading), -1, 1)) * TILT_GAIN, -MAX_TILT, MAX_TILT);
}

/** O lado do movimento, mantendo o anterior dentro da zona morta em torno da vertical. */
export function facesLeft(heading: number, previousFlipX: boolean): boolean {
  const horizontal = Math.cos(heading);
  if (Math.abs(horizontal) < DEADZONE) return previousFlipX;
  return horizontal < 0;
}

/**
 * Faixa em pixels, à esquerda e à direita do Guardião, onde o lado NÃO é decidido de novo. Um alvo
 * quase em cima da unidade tem `dx` oscilando em torno de zero a cada quadro; sem isto o Guardião
 * tremeria entre os dois lados. 🔶 placeholder de apresentação.
 */
const AIM_DEADZONE_PX = 8;

/**
 * Para que lado o GUARDIÃO olha ao atacar (item 9, segunda metade).
 *
 * Os inimigos decidem o lado pelo rumo do nado; um Guardião fica parado no posto, então o que decide
 * é para onde está o ALVO. `dx` é a distância horizontal até ele. Sem alvo, `previousFlipX`: virar
 * de volta para a direita ao fim de cada onda seria um solavanco sem motivo na tela.
 *
 * Toda a arte dos Guardiões, como a prancha de inimigos, foi desenhada apontando para a DIREITA —
 * por isso "olhar para a esquerda" é exatamente `flipX`, sem rotação nenhuma.
 */
export function facesLeftToward(dx: number, previousFlipX: boolean, deadzonePx = AIM_DEADZONE_PX): boolean {
  if (Math.abs(dx) < deadzonePx) return previousFlipX;
  return dx < 0;
}

/**
 * Como desenhar a criatura para que a cabeça aponte para onde ela vai.
 *
 * O sinal invertido da rotação quando há espelho é a parte que engana: `flipX` espelha a textura,
 * mas a rotação continua em espaço de mundo. Sem inverter, um peixe espelhado descendo apareceria
 * apontando para cima.
 */
export function orientationFor(art: EnemyArtRef, heading: number, previousFlipX = false): SpriteOrientation {
  // Ausente significa "direita": é como a prancha inteira foi desenhada.
  const facingRight = art.kind !== "sprite" || (art.facing ?? "right") === "right";
  const swimmingLeft = facesLeft(heading, previousFlipX);
  const flipX = facingRight ? swimmingLeft : !swimmingLeft;
  if (art.kind === "sprite" && art.rotate === "upright") return { flipX, rotation: 0 };
  const tilt = spriteTilt(heading);
  return { flipX, rotation: flipX ? -tilt : tilt };
}

/**
 * Como desenhar uma FRENTE DE ONDA que corre por um rumo (a Repulsa da Tartaruga).
 *
 * Difere de `orientationFor`: uma criatura só se inclina um pouco, porque a silhueta precisa
 * continuar legível; a onda gira o rumo inteiro, porque ela é o próprio deslocamento desenhado.
 *
 * Por isso o espelho aqui é no eixo Y, não no X. `flipX` inverteria junto o sentido do desenho e a
 * rotação teria de compensar — compensação que só fecha em trecho horizontal e joga a crista para o
 * lado refletido em qualquer diagonal. `flipY` não mexe no rumo: serve só para a espuma não ficar de
 * cabeça para baixo quando a correnteza corre para a esquerda.
 */
export function waveOrientation(heading: number): { flipY: boolean; rotation: number } {
  return { flipY: Math.cos(heading) < 0, rotation: heading };
}
