# Corte simples das tabelas de upgrade (art/guardians/<guardiao>/upgrade-sheet.png, grade 5x5):
# cada célula vira um PNG com o retângulo interno inteiro da célula, sem a moldura. Nada é reposicionado
# nem recortado no bbox, então todas as células de uma coluna têm o mesmo tamanho e os sprites mantêm a
# posição e a proporção da prancha. Rótulos, tiras e textos ficam para ajuste manual.
#
#   python scripts/slice-upgrade-cells.py                # todas as pranchas listadas em SHEETS
#   python scripts/slice-upgrade-cells.py reef-crab      # só uma
#   SLICE_PREVIEW=<pasta> salva uma prancha de conferência por guardião.
#
# O camarão-pistola tem o próprio script (slice-upgrade-sheet.py) e não passa por aqui.
from PIL import Image
import numpy as np
import os
import sys
from scipy import ndimage

SHEETS = {
    "jellyfish": ["base", "eletrico-1", "eletrico-2", "controle-1", "controle-2"],
    "pufferfish": ["base", "perfuracao-1", "perfuracao-2", "pulso-1", "pulso-2"],
    "ink-octopus": ["base", "debuff-1", "debuff-2", "buff-1", "buff-2"],
    "reef-crab": ["base", "quebra-casco-1", "quebra-casco-2", "area-1", "area-2"],
}
NAMES = ["portrait", "idle", "attack", "projectile", "impact"]
PREVIEW_DIR = os.environ.get("SLICE_PREVIEW")
EDGE = 2  # até quantos px da borda interna um resto de linha da moldura é apagado


def group_lines(idx, gap_ok, max_gap=8, max_thick=14):
    bands = []
    for i in idx:
        if bands and i - bands[-1][1] <= max_gap and i - bands[-1][0] < max_thick and gap_ok(bands[-1][1] + 1, i):
            bands[-1][1] = i
        else:
            bands.append([i, i])
    return [b for b in bands if b[1] - b[0] + 1 <= max_thick]


def detect_bands(line_frac, sprite_frac, frame_frac, lo_lim, hi_lim):
    """Faixas da moldura ao longo de um eixo: linhas/colunas com alta cobertura de pixels ciano de linha.

    Um par de linhas de células vizinhas (com o vão transparente entre elas) vira uma faixa só quando o vão
    não tem sprite. As faixas são estendidas em até 2px enquanto ainda houver cor de moldura (anti-alias).
    """
    idx = np.where(line_frac > 0.6)[0]
    bands = group_lines(idx, lambda a, b: sprite_frac[a:b].max(initial=0) < 0.03)
    for b in bands:
        for _ in range(2):
            if frame_frac[b[0] - 1] > 0.3:
                b[0] -= 1
            if frame_frac[b[1] + 1] > 0.3:
                b[1] += 1
    bands = [tuple(b) for b in bands if b[0] > lo_lim and b[1] < hi_lim]
    spaced = []
    for b in bands:
        if spaced and b[0] - spaced[-1][1] < 20:
            prev = spaced[-1]
            if b[1] - prev[0] + 1 <= 14:
                spaced[-1] = (prev[0], b[1])
            elif line_frac[b[0]:b[1] + 1].mean() > line_frac[prev[0]:prev[1] + 1].mean():
                spaced[-1] = b
            continue
        spaced.append(b)
    return spaced


def slice_sheet(guardian, variants):
    src = f"art/guardians/{guardian}/upgrade-sheet.png"
    out = f"public/assets/guardians/{guardian}"
    arr = np.array(Image.open(src).convert("RGBA"))
    H, W = arr.shape[:2]
    alpha = arr[:, :, 3]
    R = arr[:, :, 0].astype(int)
    G = arr[:, :, 1].astype(int)
    B = arr[:, :, 2].astype(int)

    cyan_line = (alpha > 60) & (R <= 60) & (G >= 100) & (B > 150)
    frame_colored = cyan_line | ((alpha > 60) & (R <= 25) & (B >= G) & (G < 215))
    sprite_like = (alpha > 150) & ~frame_colored

    def fracs(mask, axis, lo, hi):
        sample = mask[:, lo:hi + 1] if axis == 0 else mask[lo:hi + 1, :]
        return sample.sum(axis=1 - axis) / (hi - lo + 1)

    row_bands = detect_bands(fracs(cyan_line, 0, 340, 1050), fracs(sprite_like, 0, 340, 1050),
                             fracs(frame_colored, 0, 340, 1050), 60, 660)
    assert len(row_bands) == 6, (guardian, row_bands)
    rows = [(row_bands[i][1] + 1, row_bands[i + 1][0] - 1) for i in range(5)]
    y_lo, y_hi = rows[0][0], rows[4][1]
    col_bands = detect_bands(fracs(cyan_line, 1, y_lo, y_hi), fracs(sprite_like, 1, y_lo, y_hi),
                             fracs(frame_colored, 1, y_lo, y_hi), 8, 1072)
    assert len(col_bands) == 6, (guardian, col_bands)
    cols = [(col_bands[i][1] + 1, col_bands[i + 1][0] - 1) for i in range(5)]
    print(f"[{guardian}] faixas linhas {row_bands} colunas {col_bands}")

    sheet = Image.new("RGBA", (1100, 720), (255, 0, 255, 255))
    sy = 10
    for ri, var in enumerate(variants):
        os.makedirs(f"{out}/{var}", exist_ok=True)
        y0, y1 = rows[ri]
        sx = 10
        for ci, name in enumerate(NAMES):
            x0, x1 = cols[ci]
            c = arr[y0:y1 + 1, x0:x1 + 1].copy()
            # Resto de linha da moldura colado à borda interna (anti-alias, sombra): só cor de moldura.
            h, w = c.shape[:2]
            ring = np.zeros((h, w), bool)
            ring[:EDGE] = ring[-EDGE:] = True
            ring[:, :EDGE] = ring[:, -EDGE:] = True
            c[ring & frame_colored[y0:y1 + 1, x0:x1 + 1]] = 0
            c[c[:, :, 3] <= 8] = 0
            img = Image.fromarray(c)
            path = f"{out}/{var}/{name}.png"
            img.save(path)
            print(f"{img.size[0]:4d}x{img.size[1]:<4d} {path}")
            sheet.alpha_composite(img, (sx, sy))
            sx += img.size[0] + 8
        sy += (y1 - y0 + 1) + 10
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        sheet.convert("RGB").save(f"{PREVIEW_DIR}/{guardian}.png")


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(SHEETS)
    for g in wanted:
        slice_sheet(g, SHEETS[g])
