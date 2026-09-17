"""Fatia a prancha de efeitos de status em PNGs com fundo transparente.

A prancha vem com CINCO ícones sobre fundos coloridos sólidos (um gradiente por célula), então não
basta recortar: o fundo precisa sair, senão cada ícone vira um quadrado colorido em cima do inimigo.

Como o fundo sai: ele é um gradiente LISO e o ícone é detalhe de alta frequência. Comparar a célula
com uma versão borrada dela mesma separa os dois. Depois a máscara é fechada, preenchida (para o miolo
liso de uma estrela não virar buraco) e suavizada na borda, para o ícone não ficar recortado a faca.

Uso:
    python scripts/slice-status-sheet.py

Os ids seguem `src/game/assets/statusArt.ts`.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SOURCE = Path(__file__).resolve().parent.parent / "art" / "status" / "status-sheet.png"
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "status"

# Recortes medidos na prancha: três em cima, dois embaixo (a linha de baixo tem células mais largas).
CELLS = [
    ("stun", (0, 0, 512, 512)),
    ("slow", (512, 0, 1024, 512)),
    ("poison", (1024, 0, 1536, 512)),
    ("vulnerable", (96, 512, 744, 1024)),
    ("marked", (760, 512, 1408, 1024)),
]

# Raio do borrão que representa o fundo. Grande demais e o miolo do ícone vira fundo; pequeno demais
# e o gradiente entra junto.
BACKGROUND_BLUR = 14
# Acima disto o pixel é ícone, não fundo (soma das três diferenças de canal).
DETAIL_THRESHOLD = 26
# Suavização da borda da máscara, para o ícone não ficar serrilhado.
EDGE_FEATHER = 2.2

# Buraco maior que isto é FUNDO entre elementos do ícone e continua transparente; menor que isto é o
# miolo liso de uma estrela ou de um escudo, e precisa ser preenchido.
MAX_HOLE = 1500

# O ícone aparece com ~18 px em cima do inimigo; 128 dá folga para tela grande sem inchar o pacote.
MAX_SIDE = 128


def fill_small_holes(mask: np.ndarray, max_area: int) -> np.ndarray:
    """Preenche só os vazios FECHADOS e pequenos; o fundo entre elementos fica de fora."""
    holes, count = ndimage.label(~mask)
    if count == 0:
        return mask
    # Tudo que encosta na borda é fundo de verdade, por maior ou menor que seja.
    border = set(holes[0, :]) | set(holes[-1, :]) | set(holes[:, 0]) | set(holes[:, -1])
    sizes = ndimage.sum(~mask, holes, range(1, count + 1))
    filled = mask.copy()
    for index, size in enumerate(sizes):
        label = index + 1
        if label in border or size > max_area:
            continue
        filled[holes == label] = True
    return filled


def cut(sheet: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    cell = sheet.crop(box)
    pixels = np.asarray(cell, dtype=float)
    background = np.asarray(cell.filter(ImageFilter.GaussianBlur(BACKGROUND_BLUR)), dtype=float)
    detail = np.abs(pixels - background).sum(axis=2)

    mask = detail > DETAIL_THRESHOLD
    # Fechamento CURTO: une o traço consigo mesmo sem construir uma ponte de um elemento ao outro —
    # com um raio grande, o espaço entre dois flocos de neve vira parte do ícone e o fundo volta.
    mask = ndimage.binary_closing(mask, np.ones((5, 5)))
    mask = fill_small_holes(mask, MAX_HOLE)
    mask = ndimage.binary_opening(mask, np.ones((3, 3)))
    # Só o maior aglomerado: partículas soltas do fundo não entram.
    labels, count = ndimage.label(mask)
    if count > 1:
        sizes = ndimage.sum(mask, labels, range(1, count + 1))
        keep = int(np.argmax(sizes)) + 1
        # Mantém também os satélites grandes (o floco de neve solto, a bolha de veneno).
        biggest = sizes.max()
        mask = np.isin(labels, [index + 1 for index, size in enumerate(sizes) if size > biggest * 0.05 or index + 1 == keep])

    alpha = ndimage.gaussian_filter(mask.astype(float), EDGE_FEATHER)
    alpha = np.clip((alpha - 0.35) / 0.4, 0, 1)

    out = cell.convert("RGBA")
    data = np.asarray(out).copy()
    data[:, :, 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(data, "RGBA")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"prancha não encontrada: {SOURCE}")
    sheet = Image.open(SOURCE).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, box in CELLS:
        piece = cut(sheet, box)
        bounds = piece.getchannel("A").point(lambda value: 255 if value > 8 else 0).getbbox()
        if bounds is None:
            raise SystemExit(f"{name}: recorte vazio")
        piece = piece.crop(bounds)
        if max(piece.size) > MAX_SIDE:
            scale = MAX_SIDE / max(piece.size)
            piece = piece.resize((max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS)
        piece.save(OUT / f"{name}.png")
        print(f"{name:12} {piece.width:3}x{piece.height:3}")


if __name__ == "__main__":
    main()
