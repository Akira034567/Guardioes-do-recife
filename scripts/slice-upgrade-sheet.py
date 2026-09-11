# Corta as tabelas de upgrade (art/guardians/<guardiao>/upgrade-sheet.png, grade 5x5) em sprites
# individuais em public/assets/guardians/<guardiao>/<variante>/. Rodar da raiz:
#   python scripts/slice-upgrade-sheet.py            # todas as pranchas
#   python scripts/slice-upgrade-sheet.py reef-crab  # só uma
# Requer Pillow, numpy e scipy. SLICE_PREVIEW=<pasta> salva uma prancha de conferência por guardião.
#
# Como funciona:
# - As linhas da moldura (dupla, ciano/azul-marinho, R ~ 0) são detectadas pelo canal alpha: linhas e
#   colunas quase inteiramente opacas.
# - Os sprites vão até a linha interna da moldura e às vezes passam POR CIMA dela (antenas dos retratos,
#   garras à direita). Cada pixel da faixa da moldura recebe um "dono": a partir de cada lado da faixa, a
#   sequência contígua de pixels com cor de sprite, ancorada em um pixel do interior, pertence à célula
#   daquele lado. Onde os dois lados se encontram, divide-se no meio da faixa.
# - Entre retrato e idle, qualquer pixel nos primeiros SPILL px do idle ou na faixa é do retrato (os
#   sprites do idle nunca encostam na moldura esquerda).
# - Rótulos "1. IDLE" etc. e os textos dos retratos são apagados antes de tudo.
from PIL import Image
import numpy as np
import os
import sys
from scipy import ndimage

SHEETS = {
    "pistol-shrimp": ["base", "perfuracao-1", "perfuracao-2", "impacto-1", "impacto-2"],
    "jellyfish": ["base", "eletrico-1", "eletrico-2", "controle-1", "controle-2"],
    "pufferfish": ["base", "perfuracao-1", "perfuracao-2", "pulso-1", "pulso-2"],
    "ink-octopus": ["base", "debuff-1", "debuff-2", "buff-1", "buff-2"],
    "reef-crab": ["base", "quebra-casco-1", "quebra-casco-2", "area-1", "area-2"],
}
NAMES = ["portrait", "idle", "attack", "projectile", "impact"]
PREVIEW_DIR = os.environ.get("SLICE_PREVIEW")

PAD = 2      # margem transparente em volta do bbox final
SPILL = 16   # quantos px uma garra pode invadir a célula vizinha (só na horizontal)
TEXT_X = 104 # largura da área de texto dos retratos (bolinhas + descrição)
TEXT_Y = 41  # altura do bloco de título/subtítulo


def detect_bands(mask, along_axis, lo, hi, frac):
    """Índices (agrupados) de linhas/colunas quase inteiramente opacas dentro de [lo, hi] no outro eixo."""
    sample = mask[:, lo:hi + 1] if along_axis == 0 else mask[lo:hi + 1, :]
    counts = sample.sum(axis=1 - along_axis) / (hi - lo + 1)
    idx = np.where(counts > frac)[0]
    bands = []
    for i in idx:
        if bands and i <= bands[-1][1] + 2:
            bands[-1][1] = i
        else:
            bands.append([i, i])
    # anti-alias das linhas: estende até 2 px para cada lado enquanto ainda for bem opaco
    for b in bands:
        for _ in range(2):
            if b[0] - 1 >= 0 and counts[b[0] - 1] > frac / 2:
                b[0] -= 1
            if b[1] + 1 < len(counts) and counts[b[1] + 1] > frac / 2:
                b[1] += 1
    return [tuple(b) for b in bands]


def orange_like(px):  # não usado para decidir moldura; só para não apagar anti-alias colorido
    r, g, b = px[..., 0].astype(int), px[..., 1].astype(int), px[..., 2].astype(int)
    return (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) > 60  # saturado


def runs(band, anchor_lo, anchor_hi):
    n = band.shape[0]
    from_lo = np.zeros_like(band)
    from_hi = np.zeros_like(band)
    run = anchor_lo.copy()
    for i in range(n):
        run &= band[i]
        from_lo[i] = run
    run = anchor_hi.copy()
    for i in range(n - 1, -1, -1):
        run &= band[i]
        from_hi[i] = run
    return from_lo, from_hi


def slice_sheet(guardian, variants):
    src = f"art/guardians/{guardian}/upgrade-sheet.png"
    out = f"public/assets/guardians/{guardian}"
    arr = np.array(Image.open(src).convert("RGBA"))
    H, W = arr.shape[:2]
    alpha = arr[:, :, 3]
    R = arr[:, :, 0].astype(int)
    G = arr[:, :, 1].astype(int)
    B = arr[:, :, 2].astype(int)

    # ------------------------------------------------------------ moldura
    solid = alpha > 150
    row_bands = detect_bands(solid, 0, 340, 1050, 0.6)
    col_bands = detect_bands(solid, 1, 80, 634, 0.6)
    row_bands = [b for b in row_bands if b[0] > 60 and b[1] < 660]   # fora: cabeçalho e rodapé
    col_bands = [b for b in col_bands if b[0] > 15 and b[1] < 1070]
    assert len(row_bands) == 6 and len(col_bands) == 6, (guardian, row_bands, col_bands)
    ROWS = [(row_bands[i][1] + 1, row_bands[i + 1][0] - 1) for i in range(5)]
    COLS = [(col_bands[i][1] + 1, col_bands[i + 1][0] - 1) for i in range(5)]
    print(f"[{guardian}] faixas linhas {row_bands} colunas {col_bands}")

    def index_of(v, ranges):
        for i, (a, b) in enumerate(ranges):
            if a <= v <= b:
                return i
        return -1

    row_of = np.array([index_of(y, ROWS) for y in range(H)])
    col_of = np.array([index_of(x, COLS) for x in range(W)])

    border_like = (R <= 45) & (B >= G) & (G < 215)
    sprite_like = (alpha > 150) & ~border_like

    owner = np.full((H, W), -1, np.int16)
    for ri, (y0, y1) in enumerate(ROWS):
        for ci, (x0, x1) in enumerate(COLS):
            owner[y0:y1 + 1, x0:x1 + 1] = ri * 5 + ci

    for k, (y0, y1) in enumerate(row_bands):
        n = y1 - y0 + 1
        from_lo, from_hi = runs(sprite_like[y0:y1 + 1], sprite_like[y0 - 1], sprite_like[y1 + 1])
        upper = k - 1 if k >= 1 else -1
        lower = k if k <= 4 else -1
        mid = n // 2
        for i in range(n):
            for x in np.where(from_lo[i] | from_hi[i])[0]:
                ci = col_of[x]
                if ci < 0:
                    continue
                lo, hi = from_lo[i, x], from_hi[i, x]
                ri = (upper if i < mid else lower) if (lo and hi) else (upper if lo else lower)
                if ri >= 0:
                    owner[y0 + i, x] = ri * 5 + ci

    for k, (x0, x1) in enumerate(col_bands):
        n = x1 - x0 + 1
        from_lo, from_hi = runs(sprite_like[:, x0:x1 + 1].T, sprite_like[:, x0 - 1], sprite_like[:, x1 + 1])
        left = k - 1 if k >= 1 else -1
        right = k if k <= 4 else -1
        mid = n // 2
        for i in range(n):
            for y in np.where(from_lo[i] | from_hi[i])[0]:
                ri = row_of[y]
                if ri < 0:
                    continue
                lo, hi = from_lo[i, y], from_hi[i, y]
                ci = (left if i < mid else right) if (lo and hi) else (left if lo else right)
                if ci >= 0:
                    owner[y, x0 + i] = ri * 5 + ci

    clean = arr.copy()
    clean[owner < 0] = 0
    clean[clean[:, :, 3] <= 8] = 0
    band_px = np.zeros((H, W), bool)
    for y0, y1 in row_bands:
        band_px[y0:y1 + 1] = True
    for x0, x1 in col_bands:
        band_px[:, x0:x1 + 1] = True
    # Sombra translúcida da moldura que entra até 2px no interior: translúcida e sem saturação.
    fringe = ndimage.binary_dilation(band_px, iterations=2) & (clean[:, :, 3] < 170) & ~orange_like(clean)
    clean[fringe] = 0

    # ------------------------------------------------------------ textos e rótulos
    for ri in range(5):
        y0, y1 = ROWS[ri]
        x0, x1 = COLS[0]
        cell = clean[y0:y1 + 1, x0:x1 + 1]
        op = cell[:, :, 3] > 30
        lab, n = ndimage.label(op, structure=np.ones((3, 3)))
        for i, sl in enumerate(ndimage.find_objects(lab)):
            if sl[0].start < 8 and sl[1].start < 12 and sl[1].stop <= 175 and sl[0].stop <= TEXT_Y + 4:
                cell[lab == i + 1] = 0                       # título + subtítulo
        cell[TEXT_Y:, :TEXT_X] = 0                           # bolinhas e descrição
        zone = cell[TEXT_Y:, TEXT_X:TEXT_X + 40]
        rgb = zone[:, :, :3].astype(int)
        whiteish = (rgb.min(axis=2) > 170) & (zone[:, :, 3] > 60)  # letras brancas que passam da área
        zone[whiteish] = 0
        zop = zone[:, :, 3] > 20                             # restos pequenos de letras
        zlab, zn = ndimage.label(zop, structure=np.ones((3, 3)))
        for i, sz in enumerate(ndimage.sum(zop, zlab, range(1, zn + 1))):
            sl = ndimage.find_objects(zlab == i + 1)[0]
            if sz < 120 and sl[1].stop < 36:
                zone[zlab == i + 1] = 0

    for ci in range(1, 5):
        x0, x1 = COLS[ci]
        y0, y1 = ROWS[0]
        mask = ndimage.binary_dilation(clean[y0:y0 + 20, x0:x1 + 1, 3] > 30, iterations=1)
        for ri in range(5):
            ry0 = ROWS[ri][0]
            clean[ry0:ry0 + 20, x0:x1 + 1][mask] = 0

    opaque = clean[:, :, 3] > 20

    # ------------------------------------------------------------ transbordo retrato -> idle
    x0, x1 = col_bands[1]
    mid_x = x0 + (x1 - x0 + 1) // 2
    for ri in range(5):
        y0, y1 = ROWS[ri]
        me, neigh = ri * 5 + 0, ri * 5 + 1
        rows = slice(y0, y1 + 1)
        strip = (rows, slice(x1 + 1, x1 + 1 + SPILL))
        owner[strip][opaque[strip] & (owner[strip] == neigh)] = me
        band = (rows, slice(x0, x1 + 1))
        owner[band][owner[band] == neigh] = me
        full = (owner[rows, mid_x:x1 + 1] == me).any(axis=1) & (owner[rows, x1 + 1] == me)
        for y in np.where(full)[0] + y0:
            sel = alpha[y, x0:x1 + 1] > 20
            owner[y, x0:x1 + 1][sel] = me
            clean[y, x0:x1 + 1][sel] = arr[y, x0:x1 + 1][sel]

    def autocrop(c):
        a = c[:, :, 3] > 20
        ys, xs = np.where(a)
        h, w = a.shape
        yy0, yy1 = max(0, ys.min() - PAD), min(h - 1, ys.max() + PAD)
        xx0, xx1 = max(0, xs.min() - PAD), min(w - 1, xs.max() + PAD)
        return c[yy0:yy1 + 1, xx0:xx1 + 1]

    sheet = Image.new("RGBA", (1150, 720), (255, 0, 255, 255))
    sy = 10
    for ri, var in enumerate(variants):
        os.makedirs(f"{out}/{var}", exist_ok=True)
        sx, rowh = 10, 0
        for ci, name in enumerate(NAMES):
            me = ri * 5 + ci
            y0, y1 = ROWS[ri]
            x0, x1 = COLS[ci]
            Y0, Y1 = y0 - 10, y1 + 10
            X0, X1 = x0 - 10, x1 + 10 + SPILL
            c = clean[Y0:Y1 + 1, X0:X1 + 1].copy()
            c[owner[Y0:Y1 + 1, X0:X1 + 1] != me] = 0
            minsz = 100 if name in ("portrait", "idle", "attack") else 12
            op = c[:, :, 3] > 20
            lab, n = ndimage.label(op, structure=np.ones((3, 3)))
            for i, sz in enumerate(ndimage.sum(op, lab, range(1, n + 1))):
                if sz < minsz:
                    c[ndimage.binary_dilation(lab == i + 1, iterations=2)] = 0
            c = autocrop(c)
            img = Image.fromarray(c)
            path = f"{out}/{var}/{name}.png"
            img.save(path)
            a = c[:, :, 3] > 128
            touch = "".join(
                s for s, hit in zip("TBLR", (a[PAD].any(), a[-1 - PAD].any(), a[:, PAD].any(), a[:, -1 - PAD].any())) if hit
            )
            print(f"{img.size[0]:4d}x{img.size[1]:<4d} encosta={touch or '-':<4} {path}")
            sheet.alpha_composite(img, (sx, sy))
            sx += img.size[0] + 12
            rowh = max(rowh, img.size[1])
        sy += rowh + 14
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        sheet.convert("RGB").save(f"{PREVIEW_DIR}/{guardian}.png")


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(SHEETS)
    for g in wanted:
        slice_sheet(g, SHEETS[g])
