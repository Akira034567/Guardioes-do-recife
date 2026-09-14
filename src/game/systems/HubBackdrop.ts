import Phaser from "phaser";
import { REEF_BACKDROP_KEY } from "../assets/reefArt";
import { GAME_HEIGHT, GAME_WIDTH, HUB_DEPTH } from "../constants";
import { mixColor, seededRandom } from "./LevelBackdrop";

/**
 * O fundo do Meu Recife: água, luz, silhueta ao longe e o leito de areia.
 *
 * Desenhado UMA vez, na entrada da cena, e nunca redesenhado — o que respira depois é a
 * transparência dos feixes de luz. A paleta e a densidade vêm do crescimento, então o mesmo desenho
 * serve para o Recife pequeno do começo e para o Recife cheio do fim, sem trocar de cenário.
 */

export interface HubBackdropOptions {
  /** 0..1 de `reefGrowth`: quanto mais vivo, mais clara e saturada a água, mais silhueta ao fundo. */
  vitality: number;
  reduced: boolean;
}

export interface HubBackdrop {
  /** Os feixes de luz, para a cena parar de animá-los quando os efeitos são reduzidos. */
  beams: Phaser.GameObjects.Graphics[];
  destroy(): void;
}

/** O fundo pintado, esticado para cobrir a tela sem deformar. */
function paintedBackdrop(scene: Phaser.Scene): HubBackdrop {
  const image = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, REEF_BACKDROP_KEY).setDepth(HUB_DEPTH.water);
  image.setScale(Math.max(GAME_WIDTH / image.width, GAME_HEIGHT / image.height));
  return { beams: [], destroy: () => image.destroy() };
}

/** Água rasa e apagada no começo; funda e viva no Recife crescido. */
const WATER_TOP_EMPTY = 0x0a4a68;
const WATER_TOP_ALIVE = 0x0d6f96;
const WATER_BOTTOM = 0x021520;
const SAND = 0xd9c49a;
const ROCK = 0x2c4757;

export function drawHubBackdrop(scene: Phaser.Scene, options: HubBackdropOptions): HubBackdrop {
  // Com a arte pintada, o Recife inteiro (inclusive os seis lugares) vem da imagem. O desenho
  // procedural abaixo continua como reserva: arte que falta nunca deixa a tela vazia.
  if (scene.textures.exists(REEF_BACKDROP_KEY)) return paintedBackdrop(scene);
  const random = seededRandom("meu-recife");
  const vitality = Math.max(0, Math.min(1, options.vitality));
  const created: Phaser.GameObjects.GameObject[] = [];
  const beams: Phaser.GameObjects.Graphics[] = [];

  const add = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
    created.push(object);
    return object;
  };

  // 1. A água.
  const water = add(scene.add.graphics().setDepth(HUB_DEPTH.water));
  const top = mixColor(WATER_TOP_EMPTY, WATER_TOP_ALIVE, vitality);
  water.fillGradientStyle(top, top, WATER_BOTTOM, WATER_BOTTOM, 1);
  water.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 2. Feixes de luz vindos da superfície. A cena anima a transparência; a forma é fixa.
  const beamCount = 4;
  for (let index = 0; index < beamCount; index += 1) {
    const beam = add(scene.add.graphics().setDepth(HUB_DEPTH.bands));
    const x = (GAME_WIDTH / (beamCount + 1)) * (index + 1) + (random() - 0.5) * 90;
    const width = 60 + random() * 70;
    beam.fillStyle(0xbdf0ff, 0.05 + vitality * 0.03);
    beam.fillPoints(
      [
        { x: x - width * 0.28, y: -20 },
        { x: x + width * 0.28, y: -20 },
        { x: x + width, y: GAME_HEIGHT * 0.86 },
        { x: x - width * 0.55, y: GAME_HEIGHT * 0.86 },
      ],
      true,
      true,
    );
    beams.push(beam);
  }

  // 3. As faixas senoidais de cáustica, herdadas do menu antigo.
  const bands = add(scene.add.graphics().setDepth(HUB_DEPTH.bands));
  for (let index = 0; index < 7; index += 1) {
    const y = 70 + index * 88;
    bands.lineStyle(2, 0x1581a3, 0.1 + (index % 2) * 0.05 + vitality * 0.04);
    bands.beginPath();
    bands.moveTo(-20, y);
    for (let x = -20; x <= GAME_WIDTH + 20; x += 40) bands.lineTo(x, y + Math.sin(x / 110 + index) * 14);
    bands.strokePath();
  }

  // 4. A silhueta do Recife ao longe. Cores pré-misturadas e opacas: discos com transparência
  //    sobrepostos deixariam as juntas à mostra (mesmo truque de `LevelBackdrop`).
  const far = add(scene.add.graphics().setDepth(HUB_DEPTH.farReef));
  const humps = 7 + Math.round(vitality * 6);
  for (let index = 0; index < humps; index += 1) {
    const x = random() * GAME_WIDTH;
    const height = 70 + random() * (90 + vitality * 90);
    const width = 150 + random() * 220;
    far.fillStyle(mixColor(WATER_BOTTOM, ROCK, 0.35 + random() * 0.25), 1);
    far.fillEllipse(x, GAME_HEIGHT * 0.78 + random() * 40, width, height);
  }

  // 5. O leito de areia.
  const floor = add(scene.add.graphics().setDepth(HUB_DEPTH.farReef + 1));
  const floorTop = GAME_HEIGHT * 0.82;
  floor.fillStyle(mixColor(WATER_BOTTOM, SAND, 0.45 + vitality * 0.2), 1);
  const shore: Phaser.Types.Math.Vector2Like[] = [];
  for (let x = -20; x <= GAME_WIDTH + 20; x += 40) shore.push({ x, y: floorTop + Math.sin(x / 180) * 16 });
  shore.push({ x: GAME_WIDTH + 20, y: GAME_HEIGHT + 20 }, { x: -20, y: GAME_HEIGHT + 20 });
  floor.fillPoints(shore, true, true);
  for (let index = 0; index < 18; index += 1) {
    const x = random() * GAME_WIDTH;
    const y = floorTop + 20 + random() * (GAME_HEIGHT - floorTop - 30);
    floor.fillStyle(mixColor(SAND, ROCK, 0.35 + random() * 0.4), 1);
    floor.fillEllipse(x, y, 26 + random() * 54, 12 + random() * 22);
  }

  // 6. Vinheta: escurece as bordas para o texto da camada HTML ler bem por cima.
  const vignette = add(scene.add.graphics().setDepth(HUB_DEPTH.vignette));
  vignette.fillGradientStyle(0x000913, 0x000913, 0x000913, 0x000913, 0.55, 0.55, 0, 0);
  vignette.fillRect(0, 0, GAME_WIDTH, 150);
  vignette.fillGradientStyle(0x000913, 0x000913, 0x000913, 0x000913, 0, 0, 0.5, 0.5);
  vignette.fillRect(0, GAME_HEIGHT - 140, GAME_WIDTH, 140);

  return {
    beams,
    destroy: () => created.forEach((object) => object.destroy()),
  };
}
