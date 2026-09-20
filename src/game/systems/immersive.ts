import { getSettings } from "./settings";

/**
 * MODO IMERSIVO NO CELULAR — tirar a barra do navegador da frente do jogo.
 *
 * No Chrome do Android em paisagem, a barra de endereço come uma faixa do topo e só some depois de
 * uma rolagem que esta página nunca tem (o corpo não rola: `overflow: hidden`). O resultado é um
 * jogo espremido, com a barra de cima do HUD escondida atrás da barra de pesquisa.
 *
 * A única saída que os navegadores dão é a API de tela cheia — e ela EXIGE um gesto do jogador.
 * Então é isso que acontece aqui: no primeiro toque em um aparelho de toque, o jogo pede tela cheia
 * uma vez. Não insiste: se o pedido falhar, ou se o jogador sair da tela cheia depois, ninguém
 * pergunta de novo nesta visita — ficar recapturando a tela a cada toque seria sequestrar o
 * aparelho.
 *
 * O jogador pode desligar isto em Configurações (`immersiveMobile`), e o botão de tela cheia do HUD
 * continua valendo para quem quiser entrar e sair à mão.
 */

/** Aparelho de toque? É só nele que a barra do navegador é o problema descrito acima. */
function isTouchDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Deita a tela, quando o aparelho deixa. Falha em silêncio: em iOS a API nem existe. */
async function lockLandscape(): Promise<void> {
  const orientation = screen.orientation as (ScreenOrientation & { lock?: (value: string) => Promise<void> }) | undefined;
  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Recusado pelo navegador (ou aparelho sem trava). O jogo funciona em pé do mesmo jeito.
  }
}

/**
 * Arma o pedido de tela cheia para o PRIMEIRO gesto do jogador. Devolve a função de limpeza.
 *
 * `target` é o elemento que vai para tela cheia — sempre o `#game`, que contém o canvas E a camada
 * de telas HTML. Mandar só o canvas é o que fazia a pausa sumir em tela cheia.
 */
export function armImmersiveFullscreen(target: HTMLElement): () => void {
  if (!isTouchDevice()) return () => {};
  let done = false;

  const request = (): void => {
    if (done) return;
    done = true;
    window.removeEventListener("pointerdown", request);
    window.removeEventListener("touchend", request);
    if (!getSettings().immersiveMobile || isFullscreen()) return;
    target
      .requestFullscreen?.({ navigationUI: "hide" })
      .then(() => lockLandscape())
      .catch(() => {
        // Navegador recusou (iPhone, por exemplo, não dá tela cheia para elemento qualquer).
        // Nada a fazer: o jogo continua na área que sobrar.
      });
  };

  // `pointerdown` pega quase todo mundo; `touchend` é a rede de segurança de navegadores antigos.
  window.addEventListener("pointerdown", request, { once: true });
  window.addEventListener("touchend", request, { once: true });
  return () => {
    window.removeEventListener("pointerdown", request);
    window.removeEventListener("touchend", request);
  };
}
