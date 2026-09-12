# Corta as tabelas de upgrade dos novos guardiões (art/guardians/<pasta>/upgrade-sheet.png), que têm
# moldura amarela neon (#FFF01F), em public/assets/guardians/<pasta>/<variante>/{portrait,idle,attack,
# ability,impact}.png. As pastas e nomes seguem GUARDIAN_ART em src/game/assets/guardianArt.ts.
#
#   python scripts/slice-neon-sheet.py               # todas as pranchas
#   python scripts/slice-neon-sheet.py tubarao       # só uma
#   SLICE_PREVIEW=<pasta> salva uma prancha de conferência por guardião.
#
# Como funciona:
# - A prancha tem 5 painéis verticais (um por variante) com cantos arredondados e 4 divisórias horizontais
#   por painel (card, idle, attack, habilidade, impacto). As linhas amarelas são detectadas por cor.
# - Cada célula é recortada 1 px para dentro da linha amarela (a linha e o anti-alias ficam de fora).
# - Se algum sprite passa POR CIMA da linha amarela, a célula é recortada 1 px para FORA da moldura (a
#   linha fica na imagem) e o arquivo é listado como "SOBREPOSTO" para ajuste manual.
# - Nos cantos arredondados dos painéis (linhas 0 e 4) o resto do arco amarelo é apagado, e em todos os
#   cantos o filete amarelo onde as linhas se encontram.
from PIL import Image
import numpy as np
import os
import sys
from scipy import ndimage

SHEETS = {
    "tubarao": ["base", "frenesi_1", "frenesi_2", "alfa_1", "alfa_2"],
    "tartaruga": ["base", "casco_1", "casco_2", "corrente_1", "corrente_2"],
    "peixe_pedra": ["base", "veneno_1", "veneno_2", "emboscada_1", "emboscada_2"],
    "golfinho": ["base", "coro_1", "coro_2", "sonar_1", "sonar_2"],
}
NAMES = ["portrait", "idle", "attack", "ability", "impact"]
PREVIEW_DIR = os.environ.get("SLICE_PREVIEW")
INSET = 2        # depois da linha amarela (medida por célula), 1 px de anti-alias + 1 px de folga
EXTEND_FRAC = 0.25  # a linha continua enquanto >= 25% do vão da célula ainda for amarelo forte
EXTEND_MAX = 3      # e no máximo por 3 px (areia do peixe-pedra também é amarelada, mas mais fraca)
OVERLAP_MIN = 8  # px opacos não amarelos dentro da linha para considerar sobreposição
CORNER = 18      # tamanho do quadrado de canto onde o arco amarelo é apagado


def bands(frac, thr, gap):
    out = []
    for i in np.where(frac > thr)[0]:
        if out and i <= out[-1][1] + gap:
            out[-1][1] = i
        else:
            out.append([i, i])
    return [tuple(b) for b in out]


def merge(bs, dist):
    out = []
    for b in bs:
        if out and b[0] - out[-1][-1][1] <= dist:
            out[-1].append(b)
        else:
            out.append([b])
    return out


def slice_sheet(folder, variants):
    src = f"art/guardians/{folder}/upgrade-sheet.png"
    out = f"public/assets/guardians/{folder}"
    arr = np.array(Image.open(src).convert("RGBA"))
    H, W = arr.shape[:2]
    R, G, B, A = (arr[:, :, i].astype(int) for i in range(4))
    yellow = (A > 120) & (R >= 140) & (G >= 140) & (B <= 90)
    yellowish = (A > 60) & (R >= 110) & (G >= 110) & (B <= 120)
    line = (A > 100) & (R >= 180) & (G >= 180) & (B <= 100)  # a linha em si (240,245,0) e seu anti-alias forte
    # cor de moldura: amarelo, o miolo escuro do traço duplo e o anti-alias esverdeado
    borderish = (A <= 150) | ((B <= 110) & (R >= B) & (G >= B))

    # ------------------------------------------------------------ separadores verticais
    col_bands = bands(yellow[80:640].mean(axis=0), 0.5, 3)
    seps = merge(col_bands, 12)
    assert len(seps) == 6, (folder, seps)
    left_border = [s[-1] for s in seps[:-1]]    # borda esquerda de cada painel
    right_border = [s[0] for s in seps[1:]]     # borda direita de cada painel
    inner_x = [(left_border[c][1] + 1, right_border[c][0] - 1) for c in range(5)]

    # ------------------------------------------------------------ divisórias horizontais por painel
    per_col = []
    for c, (x0, x1) in enumerate(inner_x):
        per_col.append(bands(yellow[:, x0 + 3:x1 - 2].mean(axis=1), 0.5, 3))
    allb = sorted((b, c) for c in range(5) for b in per_col[c])
    clusters = []
    for b, c in allb:
        center = (b[0] + b[1]) / 2
        if clusters and abs(center - clusters[-1]["center"]) <= 8:
            clusters[-1]["items"].append((b, c))
        else:
            clusters.append({"center": center, "items": [(b, c)]})
    clusters = [k for k in clusters if len(k["items"]) >= 3]
    assert len(clusters) == 6, (folder, [(k["center"], len(k["items"])) for k in clusters])
    row_bands = []
    for c in range(5):
        mine = []
        for k in clusters:
            hit = [b for b, cc in k["items"] if cc == c]
            if hit:
                mine.append(hit[0])
            else:
                ys = sorted(b for b, _ in k["items"])
                mine.append(ys[len(ys) // 2])
        row_bands.append(mine)
    print(f"[{folder}] painéis x={[(l[0], r[1]) for l, r in zip(left_border, right_border)]}")
    for c in range(5):
        print(f"  painel {c} divisórias y={row_bands[c]}")

    def extend(band, frac):
        """Alarga uma faixa da moldura enquanto as linhas vizinhas ainda forem amareladas: a linha
        oscila 1-2 px ao longo do painel (traço duplo do tubarão) e a detecção global pega só o miolo."""
        lo, hi = band
        for _ in range(EXTEND_MAX):
            if lo - 1 >= 0 and frac[lo - 1] > EXTEND_FRAC:
                lo -= 1
            if hi + 1 < len(frac) and frac[hi + 1] > EXTEND_FRAC:
                hi += 1
        return lo, hi

    def cell_box(ri, c):
        """Retângulo interno da célula: 1 px depois do anti-alias da linha amarela medida naquela célula."""
        rb = row_bands[c]
        ix0, ix1 = inner_x[c]
        top = extend(rb[ri], line[:, ix0 + 3:ix1 - 2].mean(axis=1))
        bot = extend(rb[ri + 1], line[:, ix0 + 3:ix1 - 2].mean(axis=1))
        yy0, yy1 = rb[ri][1] + 1, rb[ri + 1][0] - 1
        left = extend(left_border[c], line[yy0 + 3:yy1 - 2].mean(axis=0))
        right = extend(right_border[c], line[yy0 + 3:yy1 - 2].mean(axis=0))
        return top[1] + INSET, bot[0] - INSET, left[1] + INSET, right[0] - INSET

    # ------------------------------------------------------------ sobreposições
    overlaps = {}  # (ri, ci) -> lista de lados

    def flag(ri, ci, side, n, lo, hi):
        overlaps.setdefault((ri, ci), []).append(f"{side}({n}px em {lo}-{hi})")

    opaque = A > 150
    for c in range(5):
        x0, x1 = inner_x[c]
        rb = row_bands[c]
        for k, (y0, y1) in enumerate(rb):
            seg = ~borderish[y0:y1 + 1, x0 + INSET:x1 - INSET + 1]
            hit = np.where(seg.any(axis=0))[0] + x0 + INSET
            # k == 0 é a linha de cima do painel: o logo e o título do cabeçalho passam por ela, e o card
            # nunca transborda para cima, então ela não conta como sobreposição.
            if len(hit) < OVERLAP_MIN or k == 0:
                continue
            lo, hi = int(hit.min()), int(hit.max())
            if k == 5:
                flag(4, c, "bottom", len(hit), lo, hi)
                continue
            # Divisória compartilhada: o pixel invasor é da célula cujo vizinho (3 px para o lado) tem a
            # cor mais parecida com ele. Só o lado opaco conta.
            mid = (y0 + y1) // 2
            rgb = arr[:, :, :3].astype(int)
            d_above = np.abs(rgb[mid, hit] - rgb[y0 - 3, hit]).sum(axis=1)
            d_below = np.abs(rgb[mid, hit] - rgb[y1 + 3, hit]).sum(axis=1)
            d_above[~opaque[y0 - 3, hit]] = 10 ** 6
            d_below[~opaque[y1 + 3, hit]] = 10 ** 6
            n_above = int(((d_above <= d_below) & opaque[y0 - 3, hit]).sum())
            n_below = int(((d_below < d_above) & opaque[y1 + 3, hit]).sum())
            if n_above >= OVERLAP_MIN:
                flag(k - 1, c, "bottom", n_above, lo, hi)
            if n_below >= OVERLAP_MIN:
                flag(k, c, "top", n_below, lo, hi)
        for side, (bx0, bx1) in (("left", left_border[c]), ("right", right_border[c])):
            for ri in range(5):
                y0, y1 = rb[ri][1] + INSET, rb[ri + 1][0] - INSET
                hit = np.where((~borderish[y0:y1 + 1, bx0:bx1 + 1]).any(axis=1))[0] + y0
                if len(hit) >= OVERLAP_MIN:
                    flag(ri, c, side, len(hit), int(hit.min()), int(hit.max()))

    # ------------------------------------------------------------ recorte
    sheet = Image.new("RGBA", (1100, 720), (255, 0, 255, 255))
    sy = 6
    results = []
    for ri, name in enumerate(NAMES):
        sx, rowh = 6, 0
        for c, var in enumerate(variants):
            os.makedirs(f"{out}/{var}", exist_ok=True)
            rb = row_bands[c]
            sides = overlaps.get((ri, c))
            if sides:
                y0, y1 = rb[ri][0] - 1, rb[ri + 1][1] + 1
                x0, x1 = left_border[c][0] - 1, right_border[c][1] + 1
                cell = arr[y0:y1 + 1, x0:x1 + 1].copy()
            else:
                y0, y1, x0, x1 = cell_box(ri, c)
                cell = arr[y0:y1 + 1, x0:x1 + 1].copy()
                h, w = cell.shape[:2]
                # anel de 1 px: sobras translúcidas do anti-alias
                ring = np.zeros((h, w), bool)
                ring[0] = ring[-1] = True
                ring[:, 0] = ring[:, -1] = True
                cell[ring & (cell[:, :, 3] < 120)] = 0
                # nos 4 cantos da célula, o encontro das linhas deixa um filete amarelo de 3-5 px em diagonal
                for cy, cx in ((0, 0), (0, w - 8), (h - 8, 0), (h - 8, w - 8)):
                    sq = cell[cy:cy + 8, cx:cx + 8]
                    sq[line[y0 + cy:y0 + cy + 8, x0 + cx:x0 + cx + 8]] = 0
                # cantos arredondados dos painéis: apaga o arco amarelo e o que fica fora dele
                corners = []
                if ri == 0:
                    corners += [(0, 0), (0, w - CORNER)]
                if ri == 4:
                    corners += [(h - CORNER, 0), (h - CORNER, w - CORNER)]
                for cy, cx in corners:
                    sq = cell[cy:cy + CORNER, cx:cx + CORNER]
                    low = (sq[:, :, 3] < 200) | yellowish[y0 + cy:y0 + cy + CORNER, x0 + cx:x0 + cx + CORNER]
                    lab, _ = ndimage.label(low)
                    py, px = (0 if cy == 0 else CORNER - 1), (0 if cx == 0 else CORNER - 1)
                    if lab[py, px]:
                        sq[lab == lab[py, px]] = 0
            cell[cell[:, :, 3] <= 8] = 0
            img = Image.fromarray(cell)
            path = f"{out}/{var}/{name}.png"
            img.save(path)
            tag = "SOBREPOSTO " + "/".join(sides) if sides else ""
            results.append((path, img.size, tag))
            print(f"{img.size[0]:4d}x{img.size[1]:<4d} {path} {tag}")
            sheet.alpha_composite(img, (sx, sy))
            sx += img.size[0] + 8
            rowh = max(rowh, img.size[1])
        sy += rowh + 8
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        sheet.convert("RGB").save(f"{PREVIEW_DIR}/{folder}.png")
    return results


if __name__ == "__main__":
    wanted = sys.argv[1:] or list(SHEETS)
    flagged = []
    for g in wanted:
        flagged += [(p, t) for p, _, t in slice_sheet(g, SHEETS[g]) if t]
    print("\nCélulas com sprite por cima da moldura (recortadas por fora da linha amarela):")
    for p, t in flagged:
        print(f"  {p}  {t}")
