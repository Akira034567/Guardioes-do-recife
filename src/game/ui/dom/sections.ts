import type Phaser from "phaser";
import type { GuardianId } from "../../types";
import { getProgression } from "../../systems/progression";
import { getScreenHost } from "./host";
import { appShell, type AppShellHandle, type ShellContent, type ShellView } from "./AppShell";
import { levelBackgroundPath } from "../../assets/levelBackgrounds";
import { LEVELS } from "../../data/levels";
import { accountScreen } from "./screens/AccountScreen";
import { achievementsScreen } from "./screens/AchievementsScreen";
import { bestiaryScreen } from "./screens/BestiaryScreen";
import { collectionScreen } from "./screens/CollectionScreen";
import { masteryScreen } from "./screens/MasteryScreen";
import { settingsScreen } from "./screens/SettingsScreen";
import { storyIndexScreen } from "./screens/StoryScreen";
import type { ShellNav, ShellSection } from "./shell";

/**
 * As seções (álbum, bestiário, histórias, conquistas, configurações) são as mesmas vindas do Meu
 * Recife ou do mapa. O que muda é só a tela que fica no fundo da pilha: cada cena injeta o próprio
 * `home`, e a regra "nunca empilhar mais de duas telas" vale para as duas.
 */
export interface SectionRouter {
  game: Phaser.Game;
  /** Id da tela que fica no fundo da pilha nesta cena. */
  home: "hub" | "map";
  isUnlocked(levelId: string): boolean;
  /** Troca de cena para o Meu Recife. */
  goHub(): void;
  /** Troca de cena para o mapa das fases. */
  goMap(): void;
  /** Chamado quando a pilha volta ao `home` (o hub reconfere os Guardiões). */
  onSectionClosed?(): void;
  /**
   * Refaz a cena do zero. A troca de conta abre OUTRO save: cenário, Conchas, Guardiões e HUD
   * precisam ser lidos de novo, e nenhuma tela aberta pode continuar mostrando o save anterior.
   */
  reboot(): void;
}

/** O que a seção precisa saber além de qual é. */
export interface SectionOptions {
  /** Abre o álbum já com este Guardião escolhido. */
  collectionFocus?: GuardianId;
}

/** A navegação lateral desta cena, pronta para entregar a qualquer tela. */
export function sectionNav(router: SectionRouter): ShellNav {
  return {
    onGoHub: () => openSection("hub", router),
    onGoMap: () => openSection("map", router),
    onOpenCollection: () => openSection("collection", router),
    onOpenMastery: () => openSection("mastery", router),
    onOpenBestiary: () => openSection("bestiary", router),
    onOpenStories: () => openSection("stories", router),
    onOpenAchievements: () => openSection("achievements", router),
    onOpenAccount: () => openSection("account", router),
    onOpenSettings: () => openSection("settings", router),
  };
}

/**
 * Uma moldura por instância de jogo (item 2). Ela sobrevive à troca de seção; quem a derruba é o
 * `host.clear()` das cenas, que dispara o `onClose` e limpa este registro.
 */
const SHELLS = new WeakMap<Phaser.Game, AppShellHandle>();

/** O fundo de cada seção: cada uma empresta a arte de uma fase diferente, como antes. */
const BACKDROPS: Record<ShellView, number> = {
  collection: 0,
  mastery: 2,
  bestiary: 3,
  stories: 2,
  achievements: 5,
  account: 4,
  settings: 1,
};

function contentFor(section: ShellView, router: SectionRouter, options: SectionOptions, back: () => void, nav: ShellNav): ShellContent {
  const progression = getProgression();
  const screen =
    section === "collection"
      ? collectionScreen(progression, back, nav, { focus: options.collectionFocus }, true)
      : section === "mastery"
        ? masteryScreen(progression, back, nav, true)
        : section === "bestiary"
        ? bestiaryScreen(progression, back, nav, true)
        : section === "stories"
          ? storyIndexScreen(back, nav, (levelId) => router.isUnlocked(levelId), true)
          : section === "achievements"
            ? achievementsScreen(progression, back, nav, true)
            : section === "account"
              ? accountScreen(back, nav, true, () => router.reboot())
              : settingsScreen(back, nav, true);
  const host = getScreenHost(router.game);
  return {
    view: section,
    element: screen.render(host),
    backdrop: levelBackgroundPath(LEVELS[BACKDROPS[section]].backgroundKey),
    navId: (item) => `${NAV_PREFIX[section]}-nav-${item}`,
    backId: `${BACK_ID[section]}`,
    onBack: back,
    motto: section === "settings" ? "Ajuste do seu jeito. O importante é continuar no mar." : undefined,
    onClose: screen.onClose?.bind(screen),
  };
}

/**
 * Os `data-testid` continuam os mesmos de sempre, por seção — só que agora aplicados a botões que
 * NÃO são recriados. Manter os nomes evita reescrever os testes por uma mudança que é de estrutura.
 */
const NAV_PREFIX: Record<ShellView, string> = {
  collection: "album",
  mastery: "mastery",
  bestiary: "bestiary",
  stories: "stories",
  achievements: "achievements",
  account: "account",
  settings: "settings",
};

const BACK_ID: Record<ShellView, string> = {
  collection: "collection-back",
  mastery: "mastery-back",
  bestiary: "bestiary-back",
  stories: "story-index-back",
  achievements: "achievements-back",
  account: "account-back",
  settings: "settings-back",
};

/**
 * Abre uma seção por cima da tela raiz. A pilha nunca passa de duas telas, e trocar de seção NÃO
 * remonta a moldura: a coluna da esquerda continua a mesma e só o miolo é substituído.
 */
export function openSection(section: ShellSection, router: SectionRouter, options: SectionOptions = {}): void {
  const host = getScreenHost(router.game);
  if (section === router.home) {
    while (host.isOpen && host.topId !== router.home) host.pop();
    router.onSectionClosed?.();
    return;
  }
  if (section === "hub") {
    router.goHub();
    return;
  }
  if (section === "map") {
    router.goMap();
    return;
  }

  const back = (): void => openSection(router.home, router);
  const nav = sectionNav(router);
  const content = contentFor(section, router, options, back, nav);
  const existing = SHELLS.get(router.game);
  if (existing && host.topId === "shell") {
    existing.show(content);
    return;
  }
  while (host.isOpen && host.topId !== router.home) host.pop();
  const handle = appShell(content, nav);
  SHELLS.set(router.game, handle);
  host.push({
    ...handle.screen,
    onClose: () => {
      handle.screen.onClose?.();
      SHELLS.delete(router.game);
    },
  });
}
