# Encaixe dos dez quadros soltos do canto do Golfinho / Coro II.
#
#   python scripts/fit-dolphin-chorus-frames.py [pasta com os dez PNG]
#
# Substitui `slice-dolphin-chorus-sheet.py` quando os quadros chegam como ARQUIVOS SOLTOS em vez da
# prancha 5x2. É o caso da exportação limpa: a prancha cortada na grade trazia pedaços da célula
# vizinha (meia nadadeira do quadro do lado aparecia na borda do quadro), e os soltos não têm isso.
#
# Aqui não se retoca arte nenhuma: só tamanho e enquadramento.
#
# Três coisas precisam ser resolvidas, e nenhuma delas é "redimensionar":
#
# - A ORDEM. Direto do exportador os arquivos chegam com nome de cópia do Windows ("... - Copia
#   (7).png"), que não diz nada sobre a animação; nesse caso vale a ordem de GRAVAÇÃO, que é a ordem
#   em que foram exportados. Por isso as fontes entram no repositório já renomeadas para `frame-01`…
#   `frame-10` (`art/guardians/golfinho/coro_2-canto/`): a ordem, uma vez conferida a olho, fica
#   gravada no nome e não depende mais de data de arquivo, que qualquer cópia de pasta embaralha.
# - O ALINHAMENTO. Cada PNG vem recortado rente ao conteúdo, e o conteúdo muda de tamanho a cada
#   quadro (os anéis do canto crescem e somem). Encostar todos pelo recorte faria o golfinho andar
#   para trás enquanto canta. O alinhamento é pelo CORPO — correlação na metade da cauda, que é a
#   parte que não muda —, nunca pela caixa do recorte.
# - A ÂNCORA. `GuardianView` desenha o sprite por `setOrigin(0.5, 1)`: quem manda no lugar da criatura
#   é o centro da BASE do canvas. Por isso o encaixe é calibrado contra o `attack-1.png` que já está
#   no jogo (o mesmo quadro, conferido por correlação) e o canvas só cresce em par para os lados e
#   para cima — as direções que não movem o centro da base.
from PIL import Image
import numpy as np
import os
import re
import sys
from scipy.signal import fftconvolve

SRC = "art/guardians/golfinho/coro_2-canto"
OUT = "public/assets/guardians/golfinho/coro_2"
# Quadro do jogo cujo lugar na tela está certo e deve ser preservado.
ANCHOR = f"{OUT}/attack-1.png"
# Mesma escala de `slice-dolphin-chorus-sheet.py`: os PNG soltos vieram na resolução da prancha, e a
# criatura não pode mudar de tamanho ao atacar — a escala do Guardião é uma só para idle e golpe.
SCALE = 0.39
# Folga em volta do conteúdo, em pixels do jogo. Sem ela o anel mais largo encosta na borda.
MARGIN = 3


def load(path: str) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA")).astype(float)


def luma(rgba: np.ndarray) -> np.ndarray:
    """Luminância pré-multiplicada: o fundo transparente vira zero e não puxa a correlação."""
    return rgba[:, :, :3].mean(axis=2) * (rgba[:, :, 3] / 255.0)


def content_box(rgba: np.ndarray, threshold: int = 16) -> tuple[int, int, int, int]:
    ys, xs = np.where(rgba[:, :, 3] >= threshold)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def match(image: np.ndarray, template: np.ndarray) -> tuple[int, int, float]:
    """
    Canto superior esquerdo de onde o `template` encaixa em `image`, por correlação normalizada.

    A normalização pelo desvio LOCAL é o que impede o casamento de escorregar para o anel mais
    brilhante do quadro: sem ela a conta premia região clara, não região parecida.
    """
    ones = np.ones_like(template)
    n = template.size
    centred = template - template.mean()
    num = fftconvolve(image, centred[::-1, ::-1], mode="same")
    sum1 = fftconvolve(image, ones, mode="same")
    sum2 = fftconvolve(image**2, ones, mode="same")
    variance = np.maximum(sum2 - sum1**2 / n, 1e-6)
    ncc = num / np.sqrt(variance * (centred**2).sum())
    iy, ix = np.unravel_index(int(np.argmax(ncc)), ncc.shape)
    # `mode="same"` devolve o casamento pelo CENTRO do template; o canto é o que interessa aqui.
    return int(ix) - template.shape[1] // 2, int(iy) - template.shape[0] // 2, float(ncc[iy, ix])


def tail_template(rgba: np.ndarray) -> tuple[np.ndarray, int, int]:
    """A metade esquerda do corpo (a cauda), longe da boca e dos anéis: é o que não muda no canto."""
    x0, y0, x1, y1 = content_box(rgba)
    return luma(rgba)[y0:y1, x0 : x0 + int((x1 - x0) * 0.45)], x0, y0


def scaled(rgba: np.ndarray) -> Image.Image:
    image = Image.fromarray(rgba.astype(np.uint8), "RGBA")
    return image.resize((round(image.width * SCALE), round(image.height * SCALE)), Image.LANCZOS)


def main(folder: str) -> None:
    paths = [entry.path for entry in os.scandir(folder) if entry.name.lower().endswith(".png")]
    numbered = {path: re.search(r"frame-(\d+)", os.path.basename(path)) for path in paths}
    if all(numbered.values()):
        files = sorted(paths, key=lambda path: int(numbered[path].group(1)))
    else:
        # Nomes de exportador: só a data de gravação sabe a ordem dos quadros.
        print("quadros sem numeração no nome — usando a ordem de gravação; confira o casamento abaixo")
        files = sorted(paths, key=os.path.getmtime)
    if len(files) != 10:
        raise SystemExit(f"esperava 10 quadros em {folder}, achei {len(files)}")
    frames = [load(path) for path in files]

    # 1. Mundo comum, na resolução nativa: `shift` leva o pixel de cada quadro para o quadro 1.
    template, tx, ty = tail_template(frames[0])
    shifts = [(0, 0)]
    for index, frame in enumerate(frames[1:], start=2):
        mx, my, score = match(luma(frame), template)
        shifts.append((tx - mx, ty - my))
        if score < 0.8:
            print(f"  aviso: quadro {index} casou fraco ({score:.2f}) — confira o alinhamento")

    boxes = [content_box(frame) for frame in frames]
    left = min(box[0] + sx for box, (sx, _) in zip(boxes, shifts))
    top = min(box[1] + sy for box, (_, sy) in zip(boxes, shifts))
    right = max(box[2] + sx for box, (sx, _) in zip(boxes, shifts))
    bottom = max(box[3] + sy for box, (_, sy) in zip(boxes, shifts))

    # 2. Onde esse mundo cai no canvas que o jogo já usa: casamento do quadro 1 contra o âncora.
    anchor = load(ANCHOR)
    template, sx, sy = tail_template(np.array(scaled(frames[0])).astype(float))
    mx, my, score = match(luma(anchor), template)
    origin_x, origin_y = mx - sx, my - sy
    print(f"calibragem contra {ANCHOR}: correlação {score:.3f}")
    if score < 0.8:
        print("  aviso: calibragem fraca — o golfinho pode mudar de lugar ao atacar")

    # 3. A tela de saída. Cresce em par para os lados (o centro não pode escorregar) e só para cima
    #    (a base é a âncora do sprite). O que passar por baixo da base é cortado, com aviso.
    anchor_h, anchor_w = anchor.shape[0], anchor.shape[1]
    grow_x = max(0, round(max(MARGIN - (left * SCALE + origin_x), right * SCALE + origin_x + MARGIN - anchor_w)))
    grow_y = max(0, round(MARGIN - (top * SCALE + origin_y)))
    width, height = anchor_w + 2 * grow_x, anchor_h + grow_y
    spill = bottom * SCALE + origin_y - anchor_h
    if spill > 0:
        print(f"  aviso: {spill:.1f}px de conteúdo abaixo da base do canvas serão cortados")
    print(f"tela de saída {width}x{height} (âncora {anchor_w}x{anchor_h}), escala {SCALE}")

    os.makedirs(OUT, exist_ok=True)
    for index, (frame, (sx, sy), path) in enumerate(zip(frames, shifts, files), start=1):
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        canvas.alpha_composite(scaled(frame), (round(sx * SCALE + origin_x + grow_x), round(sy * SCALE + origin_y + grow_y)))
        canvas.save(f"{OUT}/attack-{index}.png")
        print(f"  attack-{index:<2d} <- {os.path.basename(path)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else SRC)
