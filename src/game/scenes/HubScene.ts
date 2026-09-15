import Phaser from "phaser";
import { preloadReefArt, REEF_BACKDROP_KEY } from "../assets/reefArt";
import { GAME_HEIGHT, GAME_WIDTH, HUB_DEPTH } from "../constants";
import type { LevelProgressApi } from "../core/LevelProgress";
import { guardianRank } from "../core/reef/guardianRank";
import { reefGrowth, type ReefGrowth } from "../core/reef/growth";
import { reconcileReef } from "../core/reef/planting";
import { ReefLife } from "../core/reef/ReefLife";
import type { InhabitantSnapshot } from "../core/reef/ReefInhabitant";
import { GUARDIANS } from "../data/guardians";
import { decoration } from "../data/reef/decorations";
import { hubBehavior } from "../data/reef/hubBehaviors";
import { REEF_LANDMARKS, type ReefLandmark, type ReefLandmarkId } from "../data/reef/layout";
import { GUARDIAN_UNLOCKS } from "../data/unlocks";
import { LEVEL_IDS } from "../data/levels";
import { HubDecorationView } from "../objects/HubDecorationView";
import { HubGuardianView } from "../objects/HubGuardianView";
import { drawHubBackdrop, type HubBackdrop } from "../systems/HubBackdrop";
import { HubBubbles } from "../systems/HubBubbles";
import { currentAccount } from "../systems/accounts";
import { createLevelProgress, getSaveManager } from "../systems/ProgressStore";
import { getProgression } from "../systems/progression";
import { fadeInScene, prefersReducedMotion, transitionTo } from "../systems/sceneTransition";
import { getSettings, onSettingsChanged } from "../systems/settings";
import { getScreenHost } from "../ui/dom/host";
import { openSection, sectionNav, type SectionRouter } from "../ui/dom/sections";
import { hubScreen, type HubOverlay } from "../ui/dom/screens/HubScreen";
import type { GuardianId } from "../types";

/**
 * Meu Recife: a tela inicial e a casa do jogador.
 *
 * O cenário É a interface. Cada lugar do Recife leva a uma tela, e os Guardiões que o jogador
 * encontrou moram aqui de verdade — nadam, reparam no cursor e reagem ao clique.
 *
 * A divisão de trabalho:
 *
 * - o comportamento das criaturas é PURO (`core/reef`), testado sem Phaser; a cena só transforma o
 *   retrato de cada uma em pixel;
 * - o Recife em si (fundo, decoração, criaturas, brilho) é Phaser;
 * - o texto (rótulo, ficha, Conchas, atalhos de teclado) é a camada HTML de `ui/dom`, que precisa
 *   ser NÃO modal — uma tela modal desligaria o input do Phaser e o Recife ficaria morto ao toque.
 */

/** Quanto o cursor precisa chegar perto (em px do mundo) para acender o rótulo de um lugar. */
const LANDMARK_FOCUS_SCALE = (GAME_WIDTH / 100) * 1.15;

/** No toque, o rótulo armado desarma sozinho depois disto. */
const TOUCH_ARM_MS = 3000;

type FocusTarget = { kind: "landmark"; landmark: ReefLandmark } | { kind: "guardian"; view: HubGuardianView };

export class HubScene extends Phaser.Scene {
  private progress!: LevelProgressApi;
  private growth!: ReefGrowth;
  /**
   * Nulo entre uma montagem e outra: a instância da CENA sobrevive ao `restart()`, então guardar a
   * vida do Recife aqui sem limpar faria a conta nova nadar com os peixes da conta anterior.
   */
  private life: ReefLife | null = null;
  private overlay!: HubOverlay;
  private backdrop: HubBackdrop | null = null;
  private bubbles: HubBubbles | null = null;

  private readonly guardianViews = new Map<GuardianId, HubGuardianView>();
  private readonly decorationViews: HubDecorationView[] = [];
  private readonly landmarkViews = new Map<ReefLandmarkId, Phaser.GameObjects.Container>();

  private focus: FocusTarget | null = null;
  /** Onde o ponteiro estava no quadro anterior: sem isto o hover apagaria o foco do teclado. */
  private pointerAt = { x: -1, y: -1 };
  private armedSpot: string | null = null;
  private armedAt = 0;
  private selected: GuardianId | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private unsubscribeTop: (() => void) | null = null;

  constructor() {
    super("HubScene");
  }

  /** Efeitos reduzidos: a configuração do jogador ou a preferência do sistema. */
  private get reduced(): boolean {
    return getSettings().reducedEffects || prefersReducedMotion();
  }

  /**
   * O Recife decide o que precisa ANTES de carregar: reconcilia o save aqui, na frente do `create`,
   * e pede só o fundo e as peças que estão de fato plantadas. O boot continua magro.
   */
  preload(): void {
    this.progress = createLevelProgress();
    const progression = getProgression();
    // Um save migrado pode ter desbloqueios pendentes; sem isto o Recife mostraria o elenco errado.
    progression.reconcile();
    getSaveManager().update((draft) => {
      reconcileReef(draft);
      draft.reef.lastSeenStage = reefGrowth(draft).stage;
    });
    preloadReefArt(this, progression.progress.reef.placed.map((placed) => placed.defId));
  }

  create(): void {
    const progression = getProgression();
    this.growth = reefGrowth(progression.progress);
    this.cameras.main.setBackgroundColor("#02141f");

    this.backdrop = drawHubBackdrop(this, { vitality: this.growth.vitality, reduced: this.reduced });
    this.bubbles = new HubBubbles(this, { vitality: this.growth.vitality });
    this.bubbles.setEnabled(!this.reduced);
    this.drawDecorations();
    this.drawLandmarks();

    const host = getScreenHost(this.game);
    host.clear();
    const { screen, overlay } = hubScreen(
      {
        onOpenLandmark: (id, viaKeyboard) => this.openLandmark(id, viaKeyboard),
        onFocusSpot: (id) => this.focusById(id),
        onSelectGuardian: (id) => this.selectGuardian(id),
        onOpenAlbum: (id) => this.openAlbum(id),
        onCloseCard: () => this.selectGuardian(null),
      },
      sectionNav(this.router()),
    );
    this.overlay = overlay;
    host.push(screen);

    this.syncGuardians();
    this.overlay.setLandmarks(this.growth.activeLandmarks);
    this.publishCounters();
    this.animateBeams();

    // Enquanto uma seção cobre o Recife, a cena não precisa gastar quadro nenhum.
    this.unsubscribeTop = host.onTopChanged((topId) => this.syncPaused(topId));
    this.unsubscribeSettings = onSettingsChanged(() => this.bubbles?.setEnabled(!this.reduced));

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);

    const dataset = this.game.canvas.dataset;
    dataset.screen = "hub";
    dataset.gameState = "hub";
    dataset.unlockedLevels = String(LEVEL_IDS.filter((id) => this.progress.isUnlocked(id)).length);
    dataset.reefStage = String(this.growth.stage);
    dataset.reefDecorations = String(this.decorationViews.length);
    dataset.hubFocus = "";
    dataset.hubReady = "";

    fadeInScene(this, () => {
      this.game.canvas.dataset.hubReady = "true";
    });
  }

  update(_time: number, delta: number): void {
    const now = this.time.now;
    const reduced = this.reduced;
    this.bubbles?.update(delta, now);
    for (const view of this.decorationViews) view.tick(now, reduced);

    const pointer = this.input.activePointer;
    const inside = pointer.x >= 0 && pointer.x <= GAME_WIDTH && pointer.y >= 0 && pointer.y <= GAME_HEIGHT;
    const world = inside ? { x: (pointer.x / GAME_WIDTH) * 100, y: (pointer.y / GAME_HEIGHT) * 100 } : null;

    const snapshots = this.life?.tick(delta, { cover: this.coverForLife(), pointer: reduced ? null : world }) ?? [];
    for (const snapshot of snapshots) {
      this.guardianViews.get(snapshot.guardianId as GuardianId)?.apply(snapshot, reduced);
    }

    if (this.armedSpot && now - this.armedAt > TOUCH_ARM_MS) this.disarm();
    // No toque não existe passar o cursor: o foco só muda por clique ou por teclado. E no mouse, só
    // quando ele de fato andou — senão o hover apagaria, a cada quadro, o foco vindo do teclado.
    const moved = pointer.x !== this.pointerAt.x || pointer.y !== this.pointerAt.y;
    this.pointerAt = { x: pointer.x, y: pointer.y };
    if (!pointer.wasTouch && moved) this.updateHoverFocus(pointer, inside, snapshots);
  }

  // ------------------------------------------------------------------ cenário

  private drawDecorations(): void {
    for (const placed of getProgression().progress.reef.placed) {
      const definition = decoration(placed.defId);
      if (!definition) continue;
      this.decorationViews.push(new HubDecorationView(this, definition, placed));
    }
  }

  /**
   * Os lugares do Recife. São desenhos simples com um brilho por baixo: o realce sutil que o
   * briefing pede, sem card nenhum tapando o cenário.
   */
  private drawLandmarks(): void {
    for (const landmark of REEF_LANDMARKS) {
      if (!this.growth.activeLandmarks.includes(landmark.id)) continue;
      const x = (landmark.at.x / 100) * GAME_WIDTH;
      const y = (landmark.at.y / 100) * GAME_HEIGHT;
      const container = this.add.container(x, y).setDepth(HUB_DEPTH.landmark);

      const glow = this.add.circle(0, 0, landmark.radius * LANDMARK_FOCUS_SCALE * 0.5, 0x9fe9ff, 0.0);
      container.add(glow);
      // Com o fundo pintado o lugar JÁ está desenhado: só o brilho e o alvo entram por cima.
      const art = this.landmarkArt(landmark);
      if (art) container.add(art);
      container.setData("glow", glow);

      if (!this.reduced && !this.textures.exists(REEF_BACKDROP_KEY)) {
        glow.setFillStyle(0x75dff4, 0.1);
        this.tweens.add({ targets: glow, scale: 1.18, alpha: 0.2, duration: 1600, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      }
      this.landmarkViews.set(landmark.id, container);
    }
  }

  /**
   * A arte de um lugar: a imagem pintada quando ela existir, senão a forma vetorial. Mesmo idioma de
   * degradação graciosa do resto do projeto — arte que falta nunca derruba a tela.
   */
  private landmarkArt(landmark: ReefLandmark): Phaser.GameObjects.GameObject | null {
    if (this.textures.exists(REEF_BACKDROP_KEY) && !landmark.art) return null;
    if (landmark.art && this.textures.exists(landmark.art.key)) {
      const image = this.add.image(0, 0, landmark.art.key).setOrigin(0.5);
      const box = landmark.radius * LANDMARK_FOCUS_SCALE * 1.6;
      image.setScale(Math.min(box / image.width, box / image.height) * (landmark.art.scale ?? 1));
      return image;
    }
    const graphics = this.add.graphics();
    drawLandmarkShape(graphics, landmark);
    return graphics;
  }

  private animateBeams(): void {
    if (this.reduced || !this.backdrop) return;
    this.backdrop.beams.forEach((beam, index) => {
      this.tweens.add({
        targets: beam,
        alpha: 0.55,
        duration: 4200 + index * 700,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    });
  }

  /** Os Guardiões que moram aqui agora. Entra e sai sem recriar quem já estava nadando. */
  private syncGuardians(): void {
    const unlocked = getProgression().progress.unlockedGuardians.filter((id): id is GuardianId => id in GUARDIANS);
    for (const [id, view] of [...this.guardianViews]) {
      if (unlocked.includes(id)) continue;
      view.destroy();
      this.guardianViews.delete(id);
    }
    for (const id of unlocked) {
      if (this.guardianViews.has(id)) continue;
      this.guardianViews.set(id, new HubGuardianView(this, id, hubBehavior(id), (picked) => this.selectGuardian(picked)));
    }

    if (!this.life) this.life = new ReefLife({ guardianIds: unlocked, seed: getProgression().progress.profileId });
    else this.life.setResidents(unlocked);

    this.game.canvas.dataset.hubGuardians = String(this.guardianViews.size);
    this.overlay?.setGuardianSpots(unlocked.map((id) => ({ id, name: GUARDIANS[id].shortName })));
  }

  /** As decorações viram abrigo para quem foge do cursor. */
  private coverForLife(): ReadonlyArray<{ x: number; y: number; kind: ReturnType<typeof decoration> extends undefined ? never : NonNullable<ReturnType<typeof decoration>>["kind"] }> {
    return this.decorationViews.map((view) => ({ x: view.placed.x, y: view.placed.y, kind: view.definition.kind }));
  }

  // ----------------------------------------------------------------- interação

  private updateHoverFocus(pointer: Phaser.Input.Pointer, inside: boolean, snapshots: readonly InhabitantSnapshot[]): void {
    if (!inside) {
      this.setFocus(null);
      return;
    }
    // O Guardião mais perto ganha do lugar: ele se move, então errar nele incomoda mais.
    let best: { target: FocusTarget; distance: number } | null = null;
    for (const snapshot of snapshots) {
      const view = this.guardianViews.get(snapshot.guardianId as GuardianId);
      if (!view) continue;
      const distance = Phaser.Math.Distance.Between(pointer.x, pointer.y, view.x, view.y);
      if (distance < 60 && (!best || distance < best.distance)) best = { target: { kind: "guardian", view }, distance };
    }
    // Lugar nenhum entra aqui: quem cuida deles é o alvo em HTML, por cima do desenho. Se o cursor
    // não está em cima de um Guardião, o foco atual (que pode ser de um lugar) fica como está.
    if (!best && this.focus?.kind === "landmark") return;
    this.setFocus(best?.target ?? null);
  }

  private setFocus(next: FocusTarget | null): void {
    if (focusId(next) === focusId(this.focus)) return;
    if (this.focus?.kind === "guardian") this.focus.view.setHighlight(false);
    if (this.focus?.kind === "landmark") this.setLandmarkGlow(this.focus.landmark.id, false);

    this.focus = next;
    this.game.canvas.dataset.hubFocus = focusId(next) ?? "";

    if (!next) {
      this.overlay.showLabel(null);
      return;
    }
    if (next.kind === "guardian") {
      next.view.setHighlight(true);
      this.overlay.showLabel({
        id: `guardian:${next.view.guardianId}`,
        text: next.view.definition.shortName,
        hint: next.view.definition.role,
        x: next.view.x,
        y: next.view.y - 46,
      });
      return;
    }
    this.setLandmarkGlow(next.landmark.id, true);
    this.overlay.showLabel({
      id: next.landmark.id,
      text: next.landmark.hint,
      x: (next.landmark.at.x / 100) * GAME_WIDTH,
      y: (next.landmark.at.y / 100) * GAME_HEIGHT - 50,
      armed: this.armedSpot === next.landmark.id,
    });
  }

  /** O foco vindo do teclado, pelos atalhos da camada HTML. */
  private focusById(id: string | null): void {
    if (!id) {
      this.setFocus(null);
      return;
    }
    if (id.startsWith("guardian:")) {
      const view = this.guardianViews.get(id.slice("guardian:".length) as GuardianId);
      this.setFocus(view ? { kind: "guardian", view } : null);
      return;
    }
    const landmark = REEF_LANDMARKS.find((candidate) => candidate.id === id);
    this.setFocus(landmark && this.landmarkViews.has(landmark.id) ? { kind: "landmark", landmark } : null);
  }

  private setLandmarkGlow(id: ReefLandmarkId, on: boolean): void {
    const glow = this.landmarkViews.get(id)?.getData("glow") as Phaser.GameObjects.Arc | undefined;
    if (!glow) return;
    const resting = this.textures.exists(REEF_BACKDROP_KEY) ? 0 : 0.1;
    glow.setFillStyle(0x9fe9ff, on ? 0.26 : resting);
  }

  /**
   * Clique no cenário. No toque não existe aproximar o cursor, então o primeiro toque num lugar
   * mostra o nome e o segundo entra — ninguém cai numa tela sem saber para onde ia.
   */
  private onPointerDown(): void {
    // Clicar na água limpa o que estava aberto. Os lugares e os Guardiões têm alvo próprio.
    this.disarm();
    if (this.focus === null) this.selectGuardian(null);
  }

  private disarm(): void {
    if (!this.armedSpot) return;
    this.armedSpot = null;
    const current = this.focus;
    this.focus = null;
    this.setFocus(current);
  }

  /** Clique num Guardião: uma reação curta e a ficha pequena. Nada de janela enorme. */
  private selectGuardian(guardianId: GuardianId | null): void {
    if (!guardianId) {
      this.selected = null;
      this.overlay.showGuardian(null);
      return;
    }
    const view = this.guardianViews.get(guardianId);
    if (!view) return;
    view.react();
    if (this.selected === guardianId) return;
    this.selected = guardianId;

    const progress = getProgression().progress;
    const career = progress.guardianStats[guardianId] ?? { matches: 0, kills: 0, damage: 0, placements: 0, upgrades: 0 };
    this.overlay.showGuardian({
      id: guardianId,
      name: view.definition.name,
      role: view.definition.role,
      origin: originOf(guardianId),
      rank: guardianRank(career).label,
      career: { matches: Math.round(career.matches), kills: Math.round(career.kills) },
    });
  }

  // ---------------------------------------------------------------- navegação

  private router(): SectionRouter {
    return {
      game: this.game,
      home: "hub",
      isUnlocked: (levelId) => this.progress.isUnlocked(levelId),
      goHub: () => {},
      goMap: () => transitionTo(this, "LevelSelectScene"),
      // A conta mudou: o save é outro, então o Recife inteiro é montado de novo do zero.
      reboot: () => {
        getScreenHost(this.game).clear();
        this.scene.restart();
      },
      onSectionClosed: () => {
        // Uma seção pode ter desbloqueado alguém (o álbum compra Guardião); o Recife reconfere.
        this.syncGuardians();
        this.publishCounters();
      },
    };
  }

  /**
   * Entrar num lugar do Recife. Onde não existe aproximar o cursor (toque), o primeiro toque mostra
   * o nome e o segundo entra — ninguém cai numa tela sem saber para onde ia.
   */
  private openLandmark(id: ReefLandmarkId, viaKeyboard = false): void {
    if (!viaKeyboard && hoverless() && this.armedSpot !== id) {
      const landmark = REEF_LANDMARKS.find((candidate) => candidate.id === id);
      if (landmark) {
        this.armedSpot = id;
        this.armedAt = this.time.now;
        this.focus = null;
        this.setFocus({ kind: "landmark", landmark });
        return;
      }
    }
    this.disarm();
    this.selectGuardian(null);
    openSection(id, this.router());
  }

  private openAlbum(guardianId: GuardianId): void {
    this.selectGuardian(null);
    openSection("collection", this.router(), { collectionFocus: guardianId });
  }

  private publishCounters(): void {
    const progress = getProgression().progress;
    const stars = Object.values(progress.levelStars).reduce((total, record) => total + record.stars, 0);
    const account = currentAccount();
    this.overlay.setCounters({ shells: progress.currency.shells, stars, guardians: this.guardianViews.size, account: account?.name ?? null });
    const dataset = this.game.canvas.dataset;
    dataset.shells = String(progress.currency.shells);
    dataset.stars = String(stars);
    dataset.account = account?.name ?? "";
  }

  private syncPaused(topId: string | null): void {
    const covered = topId !== null && topId !== "hub";
    if (covered && !this.scene.isPaused()) this.scene.pause();
    else if (!covered && this.scene.isPaused()) this.scene.resume();
  }

  private teardown(): void {
    this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.unsubscribeSettings?.();
    this.unsubscribeSettings = null;
    this.unsubscribeTop?.();
    this.unsubscribeTop = null;
    this.bubbles?.destroy();
    this.bubbles = null;
    this.life = null;
    this.backdrop?.destroy();
    this.backdrop = null;
    this.guardianViews.clear();
    this.decorationViews.length = 0;
    this.landmarkViews.clear();
    this.game.canvas.dataset.hubReady = "";
    this.game.canvas.dataset.hubFocus = "";
  }
}

/** O aparelho tem como passar o cursor por cima? Sem isso, a regra dos dois toques entra. */
function hoverless(): boolean {
  try {
    return window.matchMedia("(hover: none)").matches;
  } catch {
    return false;
  }
}

function focusId(target: FocusTarget | null): string | null {
  if (!target) return null;
  return target.kind === "guardian" ? `guardian:${target.view.guardianId}` : target.landmark.id;
}

/**
 * De onde o Guardião veio. Os upgrades de unidade são escopo de partida e não persistem, então a
 * ficha do hub conta a HISTÓRIA dele em vez de inventar um nível que não existe no save.
 */
function originOf(guardianId: GuardianId): string {
  const definition = GUARDIAN_UNLOCKS.find((candidate) => candidate.guardianId === guardianId);
  if (!definition) return "Mora no Recife";
  if (definition.conditions.some((condition) => condition.type === "default")) return "Fundador do Recife";
  const encounter = definition.conditions.find((condition) => condition.type === "encounterCompleted");
  if (encounter && encounter.type === "encounterCompleted") return `Encontrado em ${encounterName(encounter.encounterId)}`;
  return definition.reveal.role;
}

function encounterName(encounterId: string): string {
  return encounterId
    .split("-")
    .map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

/** O desenho de cada lugar: simples, legível de longe e sem competir com os Guardiões. */
function drawLandmarkShape(graphics: Phaser.GameObjects.Graphics, landmark: ReefLandmark): void {
  const size = landmark.radius * LANDMARK_FOCUS_SCALE * 0.42;
  switch (landmark.id) {
    case "map": {
      // Arco de pedra com uma esfera brilhando no vão: as regiões protegidas.
      graphics.fillStyle(0x3f5561, 1);
      graphics.fillRect(-size * 0.85, -size * 0.2, size * 0.26, size * 1.2);
      graphics.fillRect(size * 0.59, -size * 0.2, size * 0.26, size * 1.2);
      graphics.fillEllipse(0, -size * 0.2, size * 1.9, size * 0.7);
      graphics.fillStyle(0x69d8ff, 0.9);
      graphics.fillCircle(0, size * 0.12, size * 0.42);
      graphics.fillStyle(0xc9f4ff, 0.8);
      graphics.fillCircle(-size * 0.12, size * 0.02, size * 0.14);
      break;
    }
    case "collection": {
      // Jardim de corais com nichos: o ponto de encontro dos Guardiões.
      graphics.fillStyle(0x2d6f7f, 1);
      graphics.fillEllipse(0, size * 0.6, size * 2, size * 0.7);
      graphics.fillStyle(0xe98a7b, 1);
      for (let index = -1; index <= 1; index += 1) {
        graphics.fillCircle(index * size * 0.6, size * 0.05 - Math.abs(index) * size * 0.18, size * 0.36);
      }
      graphics.fillStyle(0xffe69a, 0.9);
      graphics.fillCircle(0, -size * 0.35, size * 0.18);
      break;
    }
    case "bestiary": {
      // Fenda escura com a rede fantasma presa: a área de observação.
      graphics.fillStyle(0x14222c, 1);
      graphics.fillEllipse(0, size * 0.2, size * 1.7, size * 1.1);
      graphics.lineStyle(2, 0x8aa6b4, 0.55);
      for (let index = -2; index <= 2; index += 1) {
        graphics.lineBetween(index * size * 0.3, -size * 0.4, index * size * 0.3 + size * 0.16, size * 0.7);
      }
      graphics.lineBetween(-size * 0.7, size * 0.1, size * 0.7, size * 0.1);
      break;
    }
    case "stories": {
      // Mastro do naufrágio com um livro aberto.
      graphics.fillStyle(0x6a5647, 1);
      graphics.fillRect(-size * 0.1, -size * 0.9, size * 0.2, size * 1.6);
      graphics.fillStyle(0x8fd7ea, 0.9);
      graphics.fillTriangle(-size * 0.1, -size * 0.8, -size * 0.1, -size * 0.1, -size * 0.85, -size * 0.45);
      graphics.fillTriangle(size * 0.1, -size * 0.8, size * 0.1, -size * 0.1, size * 0.85, -size * 0.45);
      break;
    }
    case "achievements": {
      // Pedestal de pérolas.
      graphics.fillStyle(0x53707c, 1);
      graphics.fillRect(-size * 0.6, size * 0.2, size * 1.2, size * 0.5);
      graphics.fillRect(-size * 0.34, -size * 0.3, size * 0.68, size * 0.6);
      graphics.fillStyle(0xffe69a, 1);
      graphics.fillCircle(0, -size * 0.55, size * 0.34);
      graphics.fillStyle(0xfff6d8, 0.85);
      graphics.fillCircle(-size * 0.1, -size * 0.64, size * 0.12);
      break;
    }
    default: {
      // Boia de superfície: as configurações.
      graphics.fillStyle(0xd9584f, 1);
      graphics.fillCircle(0, 0, size * 0.5);
      graphics.fillStyle(0xf3efe6, 1);
      graphics.fillRect(-size * 0.5, -size * 0.12, size, size * 0.24);
      graphics.fillStyle(0x53707c, 1);
      graphics.fillRect(-size * 0.06, size * 0.4, size * 0.12, size * 0.7);
      break;
    }
  }
}
