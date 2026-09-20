/**
 * O contrato de uma aba do Álbum do Recife.
 *
 * O álbum desenha sempre a mesma coisa — uma grade de cartas à esquerda e uma ficha à direita — e
 * cada aba só precisa dizer QUAIS cartas existem e o que a ficha mostra. Por isso a Escola e a
 * Maestria puderam virar abas em vez de telas próprias: elas devolvem esta mesma lista.
 */
export interface AlbumEntry {
  id: string;
  name: string;
  subtitle: string;
  /** Carta acesa (o Guardião já é seu, a aula existe) contra carta apagada. */
  found: boolean;
  /** Sem nenhuma pista, a carta vira "???" e a arte fica em silhueta. */
  hidden: boolean;
  art: string | null;
  /** Pictograma usado quando a entrada não tem arte própria. */
  icon: string;
  /** O que falta para encontrar, quando ainda não foi. */
  hint: string;
  progress: { label: string; current: number; target: number } | null;
  /** Corpo da ficha da direita. */
  sheet(): HTMLElement;
  /** Faixa grande no topo da ficha; ausente = a própria arte da carta. */
  banner?: string | null;
  /**
   * Etiqueta do rodapé da carta. Ausente = "Encontrado" nas abas de coleção. A Escola marca "LIDA"
   * e a Maestria mostra quantos nós já foram comprados, porque nelas "encontrar" não quer dizer nada.
   */
  chip?: { label: string; icon: string; tone?: "read" | "new" | "done" } | null;
  /** Vai para o `data-state` da carta; ausente = `unlocked`/`locked` pelo `found`. */
  state?: string;
  /** Roda quando o jogador escolhe a carta (a Escola marca a aula como lida). */
  onOpen?(): void;
}

/** O que a ficha precisa para se redesenhar sem recriar a tela inteira. */
export interface SheetContext {
  frame: number;
  sheetTab: SheetTab;
  onFrame(next: number): void;
  onSheetTab(next: SheetTab): void;
  /** Redesenha a tela no lugar. Trocar por `host.replace` perderia `nav`, aba e foco. */
  onChanged(): void;
}

export type SheetTab = "info" | "skills" | "tree" | "story";
