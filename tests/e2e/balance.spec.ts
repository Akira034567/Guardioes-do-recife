import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Sondas de balanceamento (@balance): cada build joga uma fase inteira e precisa
 * vencer perdendo poucas vidas, sem que a fase fique fácil demais. Rode com
 * `npm run test:balance`; os resultados (vidas e pérolas) saem no console.
 */

const CARD_Y = 672;
const CARD_X = { shrimp: 62, jellyfish: 180, pufferfish: 298, crab: 416, octopus: 534 } as const;
const OPTION = { a: { x: 690, y: 692 }, b: { x: 800, y: 692 } } as const;
const REEF_MAX = 20;

type GuardianKey = keyof typeof CARD_X;
type Step =
  | { waitPearls: number; place: GuardianKey; at: [number, number] }
  | { waitPearls: number; upgrade: [number, number]; branch: "a" | "b" };

interface Build {
  name: string;
  level: string;
  /** Vidas mínimas no fim para a fase contar como "vencível sem sofrer". */
  minReef: number;
  steps: Step[];
}

const BUILDS: Build[] = [
  {
    name: "concentrado + quebra-casco (referência)",
    level: "recife-1",
    minReef: 10,
    steps: [
      { waitPearls: 0, place: "shrimp", at: [375, 245] },
      { waitPearls: 0, place: "crab", at: [330, 388] },
      { waitPearls: 80, place: "shrimp", at: [925, 500] },
      { waitPearls: 70, upgrade: [375, 245], branch: "b" },
      { waitPearls: 70, upgrade: [925, 500], branch: "b" },
      { waitPearls: 80, upgrade: [330, 388], branch: "a" },
    ],
  },
  {
    name: "perfuração + água-viva controle",
    level: "recife-1",
    minReef: 6,
    steps: [
      { waitPearls: 0, place: "shrimp", at: [375, 245] },
      { waitPearls: 0, place: "jellyfish", at: [245, 255] },
      { waitPearls: 80, place: "shrimp", at: [925, 500] },
      { waitPearls: 70, upgrade: [375, 245], branch: "a" },
      { waitPearls: 85, upgrade: [245, 255], branch: "b" },
      { waitPearls: 70, upgrade: [925, 500], branch: "a" },
    ],
  },
  {
    name: "contenção com baiacu",
    level: "recife-1",
    minReef: 6,
    steps: [
      { waitPearls: 0, place: "shrimp", at: [925, 500] },
      { waitPearls: 110, place: "pufferfish", at: [860, 372] },
      { waitPearls: 90, place: "crab", at: [330, 388] },
      { waitPearls: 90, upgrade: [860, 372], branch: "b" },
      { waitPearls: 70, upgrade: [925, 500], branch: "b" },
      { waitPearls: 80, upgrade: [330, 388], branch: "a" },
    ],
  },
  {
    name: "suporte com polvo (tinta)",
    level: "recife-1",
    minReef: 6,
    steps: [
      { waitPearls: 0, place: "shrimp", at: [925, 500] },
      { waitPearls: 0, place: "crab", at: [350, 389] },
      { waitPearls: 120, place: "octopus", at: [375, 245] },
      { waitPearls: 80, upgrade: [350, 389], branch: "a" },
      { waitPearls: 100, upgrade: [375, 245], branch: "a" },
      { waitPearls: 70, upgrade: [925, 500], branch: "b" },
    ],
  },
];

async function openLevel(page: Page, levelId: string) {
  await page.goto(`/?level=${levelId}`);
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-level", levelId);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas bounds unavailable");
  const clickGame = (x: number, y: number) => page.mouse.click(box.x + (x * box.width) / 1280, box.y + (y * box.height) / 720);
  return { canvas, clickGame };
}

const isOver = (state: string | null): boolean => state === "victory" || state === "defeat";

/** Espera pérolas suficientes, mas desiste assim que a partida termina. */
async function waitForPearls(page: Page, canvas: Locator, minimum: number, timeoutMs = 120_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const [pearls, state] = await Promise.all([canvas.getAttribute("data-pearls"), canvas.getAttribute("data-game-state")]);
    if (isOver(state)) return false;
    if (Number(pearls) >= minimum) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function playBuild(page: Page, build: Build) {
  const { canvas, clickGame } = await openLevel(page, build.level);
  for (const step of build.steps) {
    const ready = await waitForPearls(page, canvas, step.waitPearls);
    if (!ready) break;
    if ("place" in step) {
      const before = Number(await canvas.getAttribute("data-guardians"));
      await clickGame(CARD_X[step.place], CARD_Y);
      await clickGame(step.at[0], step.at[1]);
      await expect(canvas).toHaveAttribute("data-guardians", String(before + 1));
    } else {
      const before = Number(await canvas.getAttribute("data-upgrades"));
      await clickGame(step.upgrade[0], step.upgrade[1]);
      await expect(canvas).toHaveAttribute("data-selected", /G\d+/);
      await clickGame(OPTION[step.branch].x, OPTION[step.branch].y);
      await expect(canvas).toHaveAttribute("data-upgrades", String(before + 1));
    }
  }
  // Uma partida em que pouco morre leva ~250 s; folga para máquinas lentas.
  await expect(canvas).toHaveAttribute("data-game-state", /victory|defeat/, { timeout: 420_000 });
  const result = {
    state: await canvas.getAttribute("data-game-state"),
    reef: Number(await canvas.getAttribute("data-reef")),
    pearls: Number(await canvas.getAttribute("data-pearls")),
    guardians: Number(await canvas.getAttribute("data-guardians")),
    upgrades: Number(await canvas.getAttribute("data-upgrades")),
  };
  console.log(
    `[balance] ${build.level} · ${build.name} · ${result.state} · vidas ${result.reef}/${REEF_MAX} · pérolas ${result.pearls} · ${result.guardians} unidades / ${result.upgrades} upgrades`,
  );
  return result;
}

for (const build of BUILDS) {
  test(`@balance ${build.level} é vencível com poucas perdas: ${build.name}`, async ({ page }) => {
    test.setTimeout(600_000);
    const result = await playBuild(page, build);
    expect(result.state, `${build.name} deveria vencer`).toBe("victory");
    expect(result.reef, `${build.name} perdeu vidas demais`).toBeGreaterThanOrEqual(build.minReef);
  });
}

test("@balance recife-1 não é fácil demais: duas unidades sem upgrades não vencem sem perder vidas", async ({ page }) => {
  test.setTimeout(600_000);
  const result = await playBuild(page, {
    name: "duas unidades cruas",
    level: "recife-1",
    minReef: 0,
    steps: [
      { waitPearls: 0, place: "shrimp", at: [375, 245] },
      { waitPearls: 0, place: "crab", at: [330, 388] },
    ],
  });
  expect(result.state === "victory" && result.reef === REEF_MAX, "fase 1 está fácil demais").toBe(false);
});
