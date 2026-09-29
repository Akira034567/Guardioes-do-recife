"""
Corta as pranchas de quadrinhos das fases em páginas soltas para o visualizador de histórias.

Entrada: art/story/fase-N.png — uma prancha 1536x1024 com três páginas lado a lado, separadas por
         calhas brancas, e o número da página numa faixa branca embaixo.
Saída:   public/assets/story/fase-N/page-{1,2,3}.webp — cada página sem calha nem numeração.

As calhas são achadas pela imagem (colunas quase todas brancas), não por posição fixa: cada prancha
foi desenhada com a divisão alguns pixels para um lado.

    python scripts/slice-story-pages.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "story"
OUT = ROOT / "public" / "assets" / "story"

WHITE = 235
PAGES = 3
# Uma borda de papel em volta da página, para os quadros não encostarem na moldura da tela.
MARGIN = 4


def white_runs(ratio: np.ndarray) -> list[tuple[int, int]]:
    runs: list[tuple[int, int]] = []
    start = prev = None
    for index in np.flatnonzero(ratio > 0.97):
        if start is None:
            start = prev = index
        elif index == prev + 1:
            prev = index
        else:
            runs.append((start, prev))
            start = prev = index
    if start is not None:
        runs.append((start, prev))
    return runs


def slice_sheet(path: Path) -> None:
    image = Image.open(path).convert("RGB")
    gray = np.asarray(image.convert("L")).astype(int)
    height, width = gray.shape

    rows = white_runs((gray > WHITE).mean(axis=1))
    top = next((end + 1 for start, end in rows if start == 0), 0)
    bottom = next((start for start, end in rows if end == height - 1), height)

    # A faixa de baixo tem os números das páginas; as colunas só contam a área dos quadros.
    columns = white_runs((gray[top:bottom] > WHITE).mean(axis=0))
    # A moldura pode ter listras brancas soltas perto da borda: calha é só o que fica no miolo.
    edge = width * 0.05
    left = max((end + 1 for start, end in columns if start < edge), default=0)
    right = min((start for start, end in columns if end > width - 1 - edge), default=width)
    gutters = [(start, end) for start, end in columns if edge <= start and end <= width - 1 - edge]
    if len(gutters) != PAGES - 1:
        raise SystemExit(f"{path.name}: esperava {PAGES - 1} calhas, achei {gutters}")

    bounds = [left] + [x for gutter in gutters for x in (gutter[0], gutter[1] + 1)] + [right]
    folder = OUT / path.stem
    folder.mkdir(parents=True, exist_ok=True)
    for page in range(PAGES):
        x0, x1 = bounds[page * 2], bounds[page * 2 + 1]
        box = (max(0, x0 - MARGIN), max(0, top - MARGIN), min(width, x1 + MARGIN), min(height, bottom + MARGIN))
        target = folder / f"page-{page + 1}.webp"
        image.crop(box).save(target, "WEBP", quality=88, method=6)
        print(f"{target.relative_to(ROOT)}  {box[2] - box[0]}x{box[3] - box[1]}")


def main() -> None:
    sheets = sorted(SRC.glob("fase-*.png"))
    if not sheets:
        raise SystemExit(f"nenhuma prancha em {SRC}")
    for sheet in sheets:
        slice_sheet(sheet)


if __name__ == "__main__":
    main()
