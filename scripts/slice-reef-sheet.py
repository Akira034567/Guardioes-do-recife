"""Fatia as folhas de decoração do Meu Recife em PNGs soltos.

As folhas vêm em 3 colunas x 2 linhas de 512px. Duas delas trazem o nome da peça numa pílula escura
embaixo do desenho — a faixa do rótulo é recortada fora pelo `object_bottom` de cada linha, medido na
folha. Depois o recorte é aparado no retângulo de pixels visíveis, para o PNG final não carregar
margem transparente à toa (o jogo enquadra a peça pelo `footprint`, não pelo tamanho do arquivo).

Uso:
    python scripts/slice-reef-sheet.py

Os ids seguem `src/game/data/reef/decorations.ts`; a ordem aqui é a ordem visual das folhas.
"""

from pathlib import Path

from PIL import Image

DOWNLOADS = Path.home() / "Downloads"
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "reef"

CELL = 512
COLUMNS = 3

# Maior lado do PNG final. A peça mais larga do jogo aparece com ~230px; 360 dá folga de sobra para
# tela grande e corta o peso do pacote pela metade, que é o que o boot carrega.
MAX_SIDE = 360

# Por folha: arquivo de origem, os ids em ordem de leitura e, por linha, onde o desenho termina
# (antes da pílula do rótulo, quando ela existe).
SHEETS = [
    {
        "file": "b6c07820-bf2b-4a51-9f36-c2ca7b9992e2.png",
        "rows": [
            {"ids": ["coral-cerebro", "coral-chifre", "alga-fita"], "top": 20, "bottom": 514},
            {"ids": ["rocha-musgo", "leito-areia", "alga-bolha"], "top": 570, "bottom": 941},
        ],
    },
    {
        "file": "ecc6d9a9-285a-4478-adf5-bf784f96e9ce.png",
        "rows": [
            {"ids": ["concha-leque", "capim-marinho", "coral-leque-roxo"], "top": 10, "bottom": 452},
            {"ids": ["toca-do-caranguejo", "concha-nautilo", "rocha-arco"], "top": 528, "bottom": 899},
        ],
    },
    {
        # Esta folha não tem rótulo: o corte é só a faixa do desenho.
        "file": "1b6bf1f4-ac64-4e64-8e91-ba73e67977f9.png",
        "rows": [
            {"ids": ["coral-fogo", "lanterna-agua-viva", "ruina-coluna"], "top": 5, "bottom": 490},
            {"ids": ["farol-afundado", "estatua-guardia", "pedra-que-pisca"], "top": 493, "bottom": 1020},
        ],
    },
]


def shrink(image: Image.Image) -> Image.Image:
    """Reduz para `MAX_SIDE` no maior lado; peça nenhuma é exibida perto do tamanho da folha."""
    longest = max(image.width, image.height)
    if longest <= MAX_SIDE:
        return image
    ratio = MAX_SIDE / longest
    return image.resize((round(image.width * ratio), round(image.height * ratio)), Image.LANCZOS)


def trim(image: Image.Image) -> Image.Image:
    """Apara a moldura transparente, mantendo uma folga de 2px para o anti-aliasing."""
    box = image.getbbox()
    if box is None:
        return image
    left, top, right, bottom = box
    pad = 2
    return image.crop(
        (
            max(0, left - pad),
            max(0, top - pad),
            min(image.width, right + pad),
            min(image.height, bottom + pad),
        )
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for sheet in SHEETS:
        source = DOWNLOADS / sheet["file"]
        if not source.exists():
            raise SystemExit(f"folha ausente: {source}")
        image = Image.open(source).convert("RGBA")
        for row in sheet["rows"]:
            for column, name in enumerate(row["ids"]):
                cell = image.crop((column * CELL, row["top"], (column + 1) * CELL, row["bottom"]))
                piece = shrink(trim(cell))
                target = OUT / f"{name}.png"
                piece.save(target, optimize=True)
                print(f"{name:20} {piece.width:4}x{piece.height:4}  -> {target.relative_to(OUT.parent.parent.parent)}")


if __name__ == "__main__":
    main()
