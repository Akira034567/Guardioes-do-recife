"""Fatia a prancha do Peixe-Pedra (V3.2) nas 25 imagens do jogo.

A prancha (`art/peixe_pedra/peixe-pedra-prancha-v3.png`) veio do card oficial que está ao lado dela
(`peixe-pedra-card.png`) e tem grade fechada: 5 colunas — uma por variante — e 5 fileiras.

    coluna 1  BASE                  "Emboscada Natural"    -> base
    coluna 2  TOXINA VIVA           "Névoa Corrosiva"      -> veneno_1
    coluna 3  JARDIM ABISSAL        "Propagação Tóxica"    -> veneno_2
    coluna 4  ESPINHOS CORTANTES    "Investida Perfurante" -> emboscada_1
    coluna 5  CAÇADOR DA CORRENTE   "Presas Maiores"       -> emboscada_2

    fileira 1  o bicho grande do topo (não usada: ver abaixo)
    fileira 2  1. IDLE                                      -> idle
    fileira 3  2. ATAQUE                                    -> attack
    fileira 4  3. HABILIDADE                                -> ability
    fileira 5  4. IMPACTO                                   -> impact

O `portrait` NÃO sai da prancha: sai do card, recortando o painel de cada variante do topo até o fim
dos bullets. É que o retrato dos outros sete Guardiões é exatamente isso — moldura, cabeçalho, bicho e
os três bullets —, e a Coleção põe os oito lado a lado. Um Peixe-Pedra recortado só no bicho, sem
moldura, destoaria da fileira inteira. A fileira 1 da prancha (o mesmo bicho, maior e sem moldura)
fica de reserva.

Duas coisas que o script faz e que não são óbvias:

1. O fundo é BRANCO, não transparente. Recortar por limiar de brilho comeria os realces claros dentro
   do bicho (as bolhas, o creme da barriga). O que some é só o branco LIGADO À BORDA da prancha — o
   resto, mesmo branco, é desenho.

2. Todas as 25 peças saem com UMA escala só. `guardianArt.ts` conta com isso: as variantes preservam
   o tamanho relativo entre si, então é a base ser menor que o upgrade que faz o bicho "crescer" ao
   evoluir. Aparar e reescalar cada peça para um tamanho fixo destruiria exatamente esse efeito.

Uso:
    python scripts/slice-stonefish-sheet.py
"""

from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "art" / "peixe_pedra" / "peixe-pedra-prancha-v3.png"
CARD = ROOT / "art" / "peixe_pedra" / "peixe-pedra-card.png"
OUT = ROOT / "public" / "assets" / "guardians" / "peixe_pedra"

VARIANTS = ["base", "veneno_1", "veneno_2", "emboscada_1", "emboscada_2"]

# Faixas verticais de cada fileira, medidas nos vales da projeção de tinta da prancha. Não são
# uniformes: a nuvem da habilidade quase encosta na explosão do impacto (o vale está em y=750).
BANDS = [
    ("idle", 280, 435),
    ("attack", 435, 571),
    ("ability", 571, 751),
    ("impact", 751, 1000),
]

# Painéis do card, medidos nas molduras: do topo (y=99) até a borda de cima da caixa "1. IDLE" (y=446).
CARD_PANELS = [(46, 328), (340, 618), (629, 910), (920, 1201), (1210, 1490)]
CARD_TOP, CARD_BOTTOM = 99, 446

# Largura do retrato. Os outros Guardiões têm 196 px; o recorte do card tem a mesma proporção, então
# só falta igualar a largura para a Coleção ficar com os oito cards do mesmo tamanho.
PORTRAIT_WIDTH = 199

# Acima disto o pixel é candidato a fundo. 238 e não 250: a borda do branco tem antisserrilhado.
WHITE_FLOOR = 238

# Largura que o idle tinha antes desta prancha. Manter o número faz a troca de arte não mexer no
# tamanho do bicho em campo — a escala 0.72 do `guardianArt.ts` continua valendo.
TARGET_IDLE_WIDTH = 199.0

# Blobs mais estreitos que isto são respingo, não peça.
MIN_BLOB_WIDTH = 8


def save(image: Image.Image, path: Path) -> int:
    """Grava a peça com paleta de 255 cores.

    A arte dos Guardiões inteira é pré-carregada no boot, então o peso aqui é tempo de abertura de
    partida — foi o que derrubou um e2e quando o Peixinho Dourado entrou a 256px. Estes desenhos em
    RGBA cheio ficavam em ~1,9 MB só de Peixe-Pedra; com paleta caem para ~520 KB, menos do que os
    1,2 MB da arte que eles substituem. A 2x de zoom não dá para distinguir os dois, e em campo a
    imagem ainda encolhe para 72%.
    """
    image.quantize(colors=255, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    return path.stat().st_size


def cut_background(sheet: Image.Image) -> np.ndarray:
    """Devolve o alfa da prancha: 0 no fundo branco, 255 no desenho, rampa na borda."""
    rgb = np.asarray(sheet.convert("RGB")).astype(np.int16)
    whiteness = rgb.min(axis=2)
    candidates = whiteness >= WHITE_FLOOR

    labels, count = ndimage.label(candidates)
    if count == 0:
        return np.full(whiteness.shape, 255, dtype=np.uint8)
    # Só é fundo o branco que encosta na moldura da prancha. O branco preso dentro do bicho fica.
    border = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    background = np.isin(labels, np.unique(border[border > 0]))

    alpha = np.where(background, 0, 255).astype(np.uint8)
    # Suaviza a borda: onde o desenho encosta no fundo, o alfa acompanha o quanto o pixel é branco.
    fringe = ndimage.binary_dilation(background, iterations=2) & ~background
    ramp = np.clip((255 - whiteness) * (255.0 / (255 - WHITE_FLOOR)), 0, 255).astype(np.uint8)
    alpha[fringe] = np.minimum(alpha[fringe], ramp[fringe])
    return alpha


def blobs_in(alpha: np.ndarray, y0: int, y1: int) -> list[tuple[int, int]]:
    """As 5 colunas de conteúdo de uma fileira, achadas pelos vazios verticais entre elas."""
    columns = (alpha[y0:y1] > 0).sum(axis=0)
    found: list[tuple[int, int]] = []
    start: int | None = None
    for x, value in enumerate(columns):
        if value > 0:
            if start is None:
                start = x
        elif start is not None:
            if x - start >= MIN_BLOB_WIDTH:
                found.append((start, x))
            start = None
    if start is not None:
        found.append((start, len(columns)))
    return found


def export_portraits() -> None:
    """Recorta o painel de cada variante no card — mesma moldura dos outros sete Guardiões."""
    card = Image.open(CARD).convert("RGBA")
    for variant, (x0, x1) in zip(VARIANTS, CARD_PANELS):
        panel = card.crop((x0, CARD_TOP, x1, CARD_BOTTOM))
        scale = PORTRAIT_WIDTH / panel.width
        panel = panel.resize((PORTRAIT_WIDTH, max(1, round(panel.height * scale))), Image.LANCZOS)
        folder = OUT / variant
        folder.mkdir(parents=True, exist_ok=True)
        size = save(panel, folder / "portrait.png")
        print(f"{variant:12}  portrait={panel.width}x{panel.height}  {size / 1024:.0f} KB")


def main() -> None:
    for path in (SOURCE, CARD):
        if not path.exists():
            raise SystemExit(f"arte não encontrada: {path}")
    export_portraits()
    print()
    sheet = Image.open(SOURCE).convert("RGBA")
    alpha = cut_background(sheet)
    sheet.putalpha(Image.fromarray(alpha))

    # Primeiro mede tudo, depois corta: a escala precisa ser a mesma para as 25 peças.
    boxes: dict[tuple[str, str], tuple[int, int, int, int]] = {}
    for kind, y0, y1 in BANDS:
        found = blobs_in(alpha, y0, y1)
        if len(found) != len(VARIANTS):
            raise SystemExit(f"{kind}: achei {len(found)} colunas em y[{y0},{y1}), esperava {len(VARIANTS)}")
        for variant, (x0, x1) in zip(VARIANTS, found):
            band = alpha[y0:y1, x0:x1]
            rows = np.flatnonzero((band > 0).any(axis=1))
            boxes[(variant, kind)] = (x0, y0 + int(rows[0]), x1, y0 + int(rows[-1]) + 1)

    idle_widths = [boxes[(variant, "idle")][2] - boxes[(variant, "idle")][0] for variant in VARIANTS]
    scale = TARGET_IDLE_WIDTH / (sum(idle_widths) / len(idle_widths))
    print(f"escala única: {scale:.4f} (idle médio {sum(idle_widths) / len(idle_widths):.0f}px na prancha)\n")

    for variant in VARIANTS:
        folder = OUT / variant
        folder.mkdir(parents=True, exist_ok=True)
        line = [f"{variant:12}"]
        for kind, *_ in BANDS:
            piece = sheet.crop(boxes[(variant, kind)])
            piece = piece.resize(
                (max(1, round(piece.width * scale)), max(1, round(piece.height * scale))), Image.LANCZOS
            )
            size = save(piece, folder / f"{kind}.png")
            line.append(f"{kind}={piece.width}x{piece.height} ({size / 1024:.0f}KB)")
        print("  ".join(line))


if __name__ == "__main__":
    main()
