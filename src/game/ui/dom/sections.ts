import type Phaser from "phaser";
import type { GuardianId } from "../../types";
import { getProgression } from "../../systems/progression";
import { getScreenHost } from "./host";
import type { Screen } from "./ScreenHost";
import { achievementsScreen } from "./screens/AchievementsScreen";
import { bestiaryScreen } from "./screens/BestiaryScreen";
import { collectionScreen } from "./screens/CollectionScreen";
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
    onOpenBestiary: () => openSection("bestiary", router),
    onOpenStories: () => openSection("stories", router),
    onOpenAchievements: () => openSection("achievements", router),
    onOpenSettings: () => openSection("settings", router),
  };
}

/**
 * Abre uma seção por cima da tela raiz. A pilha nunca passa de duas telas: trocar de seção pelo menu
 * lateral volta à raiz e abre a nova, em vez de empilhar mais uma. Pedir a raiz, ou a outra cena,
 * despilha e (quando for o caso) troca de cena.
 */
export function openSection(section: ShellSection, router: SectionRouter, options: SectionOptions = {}): void {
  const host = getScreenHost(router.game);
  while (host.isOpen && host.topId !== router.home) host.pop();
  if (section === router.home) {
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
  const progression = getProgression();
  const back = (): void => openSection(router.home, router);
  const nav = sectionNav(router);
  const screens: Record<Exclude<ShellSection, "hub" | "map">, () => Screen> = {
    collection: () => collectionScreen(progression, back, nav, { focus: options.collectionFocus }),
    bestiary: () => bestiaryScreen(progression, back, nav),
    stories: () => storyIndexScreen(back, nav, (levelId) => router.isUnlocked(levelId)),
    achievements: () => achievementsScreen(progression, back, nav),
    settings: () => settingsScreen(back, nav),
  };
  host.push(screens[section]());
}
