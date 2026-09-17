# Onda da Correnteza II (Tartaruga): a arte vem com fundo branco chapado e precisa virar PNG com alfa
# para `ArtEffects.travel` poder correr com ela pela rota.
#
#   python scripts/prepare-turtle-wave.py art/guardians/tartaruga/corrente_2-onda.png
#
# O fundo NÃO sai por "todo pixel branco vira transparente": a crista e a espuma da própria onda são
# brancas, e essa regra abriria buracos justamente no que importa. Sai por preenchimento a partir da
# borda — só o branco CONECTADO à moldura da imagem é fundo —, com uma franja de alfa parcial nos
# pixels de transição para a silhueta não ficar serrilhada.
from PIL import Image
import numpy as np
import os
import sys
from scipy import ndimage

OUT = "public/assets/guardians/tartaruga/corrente_2/ability.png"
# Largura final. A onda é esticada em tempo de jogo até o raio do empurrão (~200px), então isto é folga
# de sobra e mantém o arquivo no tamanho dos outros assets de Guardião.
WIDTH = 480
NEAR_WHITE = 232  # a partir daqui um pixel conta como candidato a fundo
SOLID_WHITE = 250  # daqui para cima o fundo é branco puro (alfa 0); entre os dois, franja


def main(src: str) -> None:
    rgb = np.array(Image.open(src).convert("RGB")).astype(int)
    darkest = rgb.min(axis=2)
    # Fundo = branco que se alcança a partir da borda sem atravessar a onda.
    candidate = darkest >= NEAR_WHITE
    labels, _ = ndimage.label(candidate)
    border = set(labels[0].tolist() + labels[-1].tolist() + labels[:, 0].tolist() + labels[:, -1].tolist())
    border.discard(0)
    background = np.isin(labels, list(border))

    alpha = np.full(darkest.shape, 255, np.uint8)
    # Franja: quanto mais perto do branco puro, mais transparente. Sem isto a borda da onda fica em
    # degraus, porque o desenho chega ao fundo por um gradiente de dois ou três pixels.
    fringe = np.clip((SOLID_WHITE - darkest) * (255 / (SOLID_WHITE - NEAR_WHITE)), 0, 255)
    alpha[background] = fringe[background].astype(np.uint8)

    out = np.dstack([rgb.astype(np.uint8), alpha])
    ys, xs = np.where(alpha > 8)
    out = out[ys.min() : ys.max() + 1, xs.min() : xs.max() + 1]
    image = Image.fromarray(out, "RGBA")
    image = image.resize((WIDTH, round(image.height * WIDTH / image.width)), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    image.save(OUT)
    print(f"{image.size[0]}x{image.size[1]} {OUT}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "art/guardians/tartaruga/corrente_2-onda.png")
