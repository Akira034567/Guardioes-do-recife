"""Fatia a prancha do Peixinho Dourado em PNGs soltos.

A prancha tem duas fileiras. Em cima, os três quadros de nado do peixinho; embaixo, os efeitos:
rastro, redemoinho, o pilar da coroação, o clarão da coroação e a coroa.

Os recortes NÃO saem de uma grade: o brilho de cada peça encosta no vizinho, então os cortes vêm dos
vales medidos na projeção de alfa da prancha (`CUTS_TOP` / `CUTS_BOTTOM`). Depois cada recorte é
aparado no retângulo de pixels visíveis, para o PNG final não carregar margem transparente à toa.

Uso:
    python scripts/slice-golden-sheet.py

Os ids seguem `src/game/assets/goldenArt.ts`.
"""

from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent.parent / "art" / "golden" / "golden-sheet.png"
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "golden"

# Linha que separa as duas fileiras, medida no vale da projeção horizontal.
ROW_SPLIT = 456

# Cortes verticais de cada fileira, nos vales da projeção de alfa.
TOP = [("peixinho-1", 0, 540), ("peixinho-2", 540, 1010), ("peixinho-3", 1010, 1450)]
BOTTOM = [
    ("rastro", 0, 407),
    ("redemoinho", 407, 711),
    ("coroacao-pilar", 711, 1020),
    ("coroacao-flash", 1020, 1318),
    ("coroa", 1318, 1774),
]

# Maior lado do PNG final.
#
# Era 256 e a pasta inteira ficou em 728 KB — carregados em TODA partida, quase o peso da arte de um
# Guardião inteiro. Nada aqui passa de ~78 px na tela (a coroa tem 30), então 128 já é o dobro do
# necessário e corta o pacote em ~4x.
MAX_SIDE = 128

# Abaixo disto o pixel é só halo e não conta para o recorte útil.
ALPHA_FLOOR = 8


def export(sheet: Image.Image, name: str, box: tuple[int, int, int, int]) -> None:
    piece = sheet.crop(box)
    # Apara no conteúdo real: o alfa fraco do halo entra no PNG, mas não define o enquadramento.
    alpha = piece.getchannel("A").point(lambda value: 255 if value > ALPHA_FLOOR else 0)
    bounds = alpha.getbbox()
    if bounds is None:
        raise SystemExit(f"{name}: recorte vazio em {box}")
    piece = piece.crop(bounds)
    if max(piece.size) > MAX_SIDE:
        scale = MAX_SIDE / max(piece.size)
        piece = piece.resize((max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    piece.save(OUT / f"{name}.png")
    print(f"{name:18} {piece.width:3}x{piece.height:3}")


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"prancha não encontrada: {SOURCE}")
    sheet = Image.open(SOURCE).convert("RGBA")
    for name, x0, x1 in TOP:
        export(sheet, name, (x0, 0, x1, ROW_SPLIT))
    for name, x0, x1 in BOTTOM:
        export(sheet, name, (x0, ROW_SPLIT, x1, sheet.height))


if __name__ == "__main__":
    main()
