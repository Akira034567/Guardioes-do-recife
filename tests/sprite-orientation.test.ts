import { describe, expect, it } from "vitest";
import { facesLeft, orientationFor, spriteTilt } from "../src/game/core/SpriteOrientation";
import { ENEMIES, ENEMY_ORDER, resolveEnemy } from "../src/game/data/enemies";
import type { EnemyArtRef } from "../src/game/types";

const sprite = (overrides: Partial<Extract<EnemyArtRef, { kind: "sprite" }>> = {}): EnemyArtRef => ({
  kind: "sprite",
  folder: "teste",
  frames: 1,
  ...overrides,
});

/** Oito direções, cobrindo os dois semiplanos e os dois eixos. */
const HEADINGS = Array.from({ length: 8 }, (_, index) => (index * Math.PI) / 4);

describe("orientação dos sprites", () => {
  it("espelha na horizontal para o lado do movimento", () => {
    expect(orientationFor(sprite(), 0).flipX).toBe(false);
    expect(orientationFor(sprite(), Math.PI).flipX).toBe(true);
  });

  it("trata `facing` ausente como direita", () => {
    expect(orientationFor(sprite(), Math.PI).flipX).toBe(orientationFor(sprite({ facing: "right" }), Math.PI).flipX);
    // Arte desenhada para a esquerda inverte a regra, e só ela.
    expect(orientationFor(sprite({ facing: "left" }), Math.PI).flipX).toBe(false);
  });

  it("não inclina quem anda no leito", () => {
    for (const heading of HEADINGS) {
      expect(orientationFor(sprite({ rotate: "upright" }), heading).rotation).toBe(0);
    }
  });

  it("mantém o nariz no mesmo semiplano vertical do movimento", () => {
    // A armadilha clássica: `flipX` espelha a textura, mas a rotação continua em espaço de mundo.
    // Sem inverter o sinal, um peixe espelhado descendo apareceria apontando para cima.
    for (const heading of HEADINGS) {
      const { flipX, rotation } = orientationFor(sprite(), heading);
      // O nariz local é (1,0); o espelho o leva a (-1,0); a rotação vem por cima, em espaço de mundo.
      const noseX = (flipX ? -1 : 1) * Math.cos(rotation);
      const noseY = (flipX ? -1 : 1) * Math.sin(rotation);
      const movingRight = Math.cos(heading);
      const movingDown = Math.sin(heading);
      if (Math.abs(movingRight) >= 1e-6) {
        expect(Math.sign(noseX), `heading ${heading.toFixed(2)} na horizontal`).toBe(Math.sign(movingRight));
      }
      if (Math.abs(movingDown) >= 1e-6) {
        expect(Math.sign(noseY), `heading ${heading.toFixed(2)} na vertical`).toBe(Math.sign(movingDown));
      }
    }
  });

  it("nunca deita a criatura além do teto de inclinação", () => {
    for (const heading of HEADINGS) {
      expect(Math.abs(orientationFor(sprite(), heading).rotation)).toBeLessThanOrEqual(0.5);
    }
  });

  it("não troca de lado em trechos quase verticais", () => {
    // Dois quadros seguidos de um trecho vertical: `cos(heading)` cruza o zero e, sem zona morta,
    // a criatura piscava de um lado para o outro.
    const quaseCima = Math.PI / 2 - 0.02;
    const quaseCimaDoOutroLado = Math.PI / 2 + 0.02;
    expect(facesLeft(quaseCima, false)).toBe(false);
    expect(facesLeft(quaseCimaDoOutroLado, false)).toBe(false);
    expect(facesLeft(quaseCima, true)).toBe(true);
  });

  it("zera a inclinação no horizontal e cresce com a subida", () => {
    expect(spriteTilt(0)).toBeCloseTo(0);
    expect(spriteTilt(Math.PI)).toBeCloseTo(0);
    expect(spriteTilt(Math.PI / 4)).toBeGreaterThan(0);
    expect(spriteTilt(-Math.PI / 4)).toBeLessThan(0);
    // Subir indo para a esquerda inclina igual a subir indo para a direita: o lado é do espelho.
    expect(spriteTilt((3 * Math.PI) / 4)).toBeCloseTo(spriteTilt(Math.PI / 4));
  });

  it("desenha toda espécie de sprite com a cabeça à frente", () => {
    for (const enemyId of ENEMY_ORDER) {
      const art = resolveEnemy(ENEMIES[enemyId]).art;
      if (art.kind !== "sprite") continue;
      expect(orientationFor(art, 0).flipX, `${enemyId} indo para a direita`).toBe(false);
      expect(orientationFor(art, Math.PI).flipX, `${enemyId} indo para a esquerda`).toBe(true);
    }
  });
});
