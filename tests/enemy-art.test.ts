import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ENEMY_ART_ASSETS, enemyFrameKeys, enemyFramePath, enemyPortraitPath } from "../src/game/assets/enemyArt";
import { ENEMIES, ENEMY_ORDER, resolveEnemy } from "../src/game/data/enemies";
import type { EnemyId } from "../src/game/types";

// Arquivos existentes em `public/assets/enemies/<pasta>/`, enumerados pelo Vite na transformação.
const filesOnDisk = new Set(Object.keys(import.meta.glob("/public/assets/enemies/*/*.png")).map((path) => path.replace("/public/", "")));

describe("enemy art registry", () => {
  it("dá arte própria a todas as oito ameaças", () => {
    for (const enemyId of ENEMY_ORDER) {
      const art = resolveEnemy(ENEMIES[enemyId]).art;
      expect(art.kind, `${enemyId} usa sprite`).toBe("sprite");
      if (art.kind !== "sprite") continue;
      expect(art.frames, enemyId).toBeGreaterThan(0);
      expect(art.scale, enemyId).toBeGreaterThan(0);
      // A forma vetorial continua declarada: se a imagem sumir, o inimigo volta ao desenho antigo.
      expect(art.shapeFallback, `${enemyId} tem plano B`).toBeDefined();
    }
  });

  it("aponta para arquivos que existem em disco", () => {
    expect(ENEMY_ART_ASSETS.length).toBeGreaterThan(0);
    for (const asset of ENEMY_ART_ASSETS) {
      expect(filesOnDisk, `${asset.enemyId}: ${asset.path}`).toContain(asset.path);
    }
    // Chaves únicas: duas espécies não podem disputar a mesma textura.
    const keys = ENEMY_ART_ASSETS.map((asset) => asset.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("declara exatamente os quadros que a pasta tem", () => {
    for (const enemyId of ENEMY_ORDER) {
      const art = resolveEnemy(ENEMIES[enemyId]).art;
      if (art.kind !== "sprite") continue;
      const declared = art.frames;
      const onDisk = [...filesOnDisk].filter((path) => path.startsWith(`assets/enemies/${art.folder}/frame-`)).length;
      expect(declared, `${enemyId} (${art.folder})`).toBeLessThanOrEqual(onDisk);
      // O quadro seguinte ao último declarado não pode existir sem ninguém usá-lo.
      expect(filesOnDisk.has(enemyFramePath(art.folder, declared + 1)), `${art.folder} tem quadro sobrando`).toBe(false);
    }
  });

  it("separa o Peixe-Flecha do Tubarão Corrompido, que herdou a arte antiga", () => {
    const dart = resolveEnemy(ENEMIES.dartfish).art;
    const shark = resolveEnemy(ENEMIES.corruptedShark).art;
    expect(dart.kind === "sprite" && dart.folder).toBe("peixe-flecha");
    // O desenho do peixe-flecha já aponta para a direita; sem isto ele nadaria de ré.
    expect(dart.kind === "sprite" && dart.facing).toBe("right");
    expect(shark.kind === "sprite" && shark.folder).toBe("predador-corrompido");
  });

  it("usa uma pasta diferente para cada espécie", () => {
    const folders = ENEMY_ORDER.map((enemyId) => {
      const art = resolveEnemy(ENEMIES[enemyId]).art;
      return art.kind === "sprite" ? art.folder : enemyId;
    });
    expect(new Set(folders).size).toBe(folders.length);
  });

  it("monta as chaves na ordem da animação e o retrato do bestiário", () => {
    const art = resolveEnemy(ENEMIES.minnow).art;
    expect(enemyFrameKeys(art)).toEqual(["enemy-cardume-invasor-1", "enemy-cardume-invasor-2", "enemy-cardume-invasor-3", "enemy-cardume-invasor-4"]);
    expect(enemyPortraitPath(ENEMIES.minnow)).toBe("assets/enemies/cardume-invasor/frame-1.png");
    // Sem arte de sprite, o bestiário volta para a silhueta vetorial.
    expect(enemyPortraitPath({ ...ENEMIES.minnow, art: { kind: "procedural", shape: "minnow" } })).toBeNull();
    expect(enemyFrameKeys({ kind: "procedural", shape: "fish" })).toEqual([]);
  });

  it("desenha cada espécie num tamanho coerente com o que ela é", () => {
    // Largura real na tela: a imagem em disco vezes a escala da arte vezes a escala do inimigo.
    const widthOnScreen = (enemyId: EnemyId): number => {
      const definition = ENEMIES[enemyId];
      const art = resolveEnemy(definition).art;
      if (art.kind !== "sprite") return 0;
      const header = readFileSync(`public/${enemyFramePath(art.folder, 1)}`).subarray(16, 24);
      const imageWidth = header.readUInt32BE(0);
      return imageWidth * (art.scale ?? 1) * definition.scale;
    };
    expect(widthOnScreen("tidebreaker")).toBeGreaterThan(widthOnScreen("corruptedShark"));
    expect(widthOnScreen("corruptedShark")).toBeGreaterThan(widthOnScreen("moray"));
    expect(widthOnScreen("moray")).toBeGreaterThan(widthOnScreen("swimmer"));
    expect(widthOnScreen("swimmer")).toBeGreaterThan(widthOnScreen("minnow"));
    // Nenhuma criatura vira um borrão que cobre o mapa nem some no fundo.
    for (const enemyId of ENEMY_ORDER) {
      const width = widthOnScreen(enemyId);
      expect(width, `${enemyId} não é grande demais`).toBeLessThan(140);
      expect(width, `${enemyId} não é pequeno demais`).toBeGreaterThan(15);
    }
  });
});
