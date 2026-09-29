/**
 * ARTE QUE AINDA NÃO CHEGOU, nas telas HTML (Álbum, Preparação, apresentação de Guardião).
 *
 * Os Guardiões dos Canais Profundos entraram com as pastas de arte vazias. No Phaser eles viram o
 * desenho vetorial; aqui, sem isto, cada `<img>` deles seria o ícone de imagem quebrada do
 * navegador. Um único ouvinte de erro (fase de captura, porque `error` de imagem não borbulha)
 * troca qualquer retrato de Guardião que falhar por uma silhueta de peixe — e para de tentar.
 */

const SILHOUETTE =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><ellipse cx="54" cy="46" rx="34" ry="21" fill="#7fb8d6" opacity=".55"/><path d="M86 46 L114 26 L114 66 Z" fill="#7fb8d6" opacity=".45"/><circle cx="36" cy="40" r="5" fill="#032238" opacity=".7"/><text x="54" y="54" font-family="Arial Black,Arial" font-size="22" text-anchor="middle" fill="#e8fbff" opacity=".8">?</text></svg>`,
  );

export function installImageFallback(root: Document = document): () => void {
  const onError = (event: Event): void => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.src.includes("assets/guardians/") || image.dataset.fallback === "on") return;
    image.dataset.fallback = "on";
    image.src = SILHOUETTE;
  };
  root.addEventListener("error", onError, true);
  return () => root.removeEventListener("error", onError, true);
}
