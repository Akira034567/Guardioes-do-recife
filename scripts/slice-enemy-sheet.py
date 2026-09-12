# Corta a prancha de inimigos (art/enemies/enemies-sheet.png) em quadros individuais, um por variação/
# pose de cada inimigo, em public/assets/enemies/<inimigo>/frame-N.png.
#
#   python scripts/slice-enemy-sheet.py
#   SLICE_PREVIEW=<pasta> salva uma prancha de conferência (enemies.png).
#
# Como funciona:
# - A prancha é uma grade 3x4 de grupos; cada grupo tem um título (apagado) e 3 ou 4 sprites lado a lado.
# - Os sprites são componentes conexos do canal alpha. Em cada grupo, os componentes grandes viram quadros;
#   os pequenos (peixinhos do cardume, mergulhador ao lado da baleia) vão para extras.png do grupo, para
#   ajuste manual. Partículas minúsculas dentro do quadro ficam no quadro.
# - Todos os quadros de um mesmo inimigo têm o MESMO tamanho (maior bbox do grupo + margem) e o sprite
#   fica centralizado, então uma animação por troca de quadro não "pula".
# - O título "CHEFE: BALEIA DA MARÉ NEGRA" encosta na baleia e o polvo do Ladrão encosta na nuvem de
#   tinta: esses dois casos são separados por uma linha de corte fixa (TITLE_ERASE e "split").
from PIL import Image
import numpy as np
import os
from scipy import ndimage

SRC = "art/enemies/enemies-sheet.png"
OUT = "public/assets/enemies"
PREVIEW_DIR = os.environ.get("SLICE_PREVIEW")
PAD = 2
MIN_PIECE = 150      # componentes menores que isso são partículas
FRAME_RATIO = 0.35   # componente vira quadro se tiver >= 35% da área do maior do grupo

COLS = [(0, 372), (372, 708), (708, 1080)]
ROWS = [(126, 216), (253, 352), (394, 482), (523, 640)]
# (pasta, linha, coluna, nome na prancha, divisões verticais forçadas em x)
GROUPS = [
    ("cardume-invasor", 0, 0, "Cardume Invasor", []),
    ("caranguejo-eremita", 0, 1, "Caranguejo-Eremita Couraçado", []),
    ("agua-viva-fantasma", 0, 2, "Água-Viva Fantasma", []),
    ("baiacu-corrompido", 1, 0, "Baiacu Corrompido", []),
    ("ladrao-do-recife", 1, 1, "Ladrão do Recife", [624]),
    ("predador-corrompido", 1, 2, "Predador Corrompido", []),
    ("carregador", 2, 0, "O Carregador", []),
    ("moreia-das-correntes", 2, 1, "Moreia das Correntes", []),
    ("raia-espinhosa", 2, 2, "Raia Espinhosa", []),
    ("tartaruga-corrompida", 3, 0, "Tartaruga Corrompida", []),
    ("lider-do-cardume", 3, 1, "Líder do Cardume", []),
    ("baleia-mare-negra", 3, 2, "Chefe: Baleia da Maré Negra", []),
]
TITLE_ERASE = [(708, 1080, 478, 523)]  # x0, x1, y0, y1: título do chefe, colado na baleia
# Peças que nunca entram num quadro (vão para extras.png): mergulhador e peixe de escala sob a baleia.
FORCE_EXTRA = [(980, 1065, 590, 636)]


def merge_stacked(comps):
    """Une peças soltas de um mesmo sprite (coral da baleia, pata do caranguejo) ao melhor vizinho maior.

    Uma peça entra em outra quando fica verticalmente dentro dela (>= 50% da altura da peça) e se
    sobrepõe em x em >= 60% da mais estreita. Sprites vizinhos da prancha se sobrepõem bem menos que isso;
    os peixinhos encostados no Líder do Cardume ficam de fora de propósito (vão para extras.png).
    """
    comps = sorted((dict(c, labels=[c["label"]]) for c in comps), key=lambda c: -c["size"])
    result = []
    for c in comps:
        w, h = c["x1"] - c["x0"] + 1, c["y1"] - c["y0"] + 1
        best, best_score = None, 0
        for p in result:
            xov = min(c["x1"], p["x1"]) - max(c["x0"], p["x0"]) + 1
            yov = min(c["y1"], p["y1"]) - max(c["y0"], p["y0"]) + 1
            if yov < 0.5 * h:
                continue
            if xov >= 0.6 * min(w, p["x1"] - p["x0"] + 1):
                score = max(xov, 1) * yov
                if score > best_score:
                    best, best_score = p, score
        if best is None:
            result.append(c)
            continue
        best.update(x0=min(best["x0"], c["x0"]), x1=max(best["x1"], c["x1"]), y0=min(best["y0"], c["y0"]),
                    y1=max(best["y1"], c["y1"]), size=best["size"] + c["size"], labels=best["labels"] + c["labels"])
        best["cx"], best["cy"] = (best["x0"] + best["x1"]) / 2, (best["y0"] + best["y1"]) / 2
    return result


def main():
    arr = np.array(Image.open(SRC).convert("RGBA"))
    for x0, x1, y0, y1 in TITLE_ERASE:
        arr[y0:y1, x0:x1] = 0
    alpha = arr[:, :, 3]
    op = alpha > 40
    lab, n = ndimage.label(op, structure=np.ones((3, 3)))
    # divisões forçadas: dentro das linhas do grupo, pixels à direita da linha recebem um rótulo novo
    for _, ri, _, _, splits in GROUPS:
        gy0, gy1 = ROWS[ri]
        for sx in splits:
            for l in np.unique(lab[gy0:gy1, sx - 1]):
                if l and (lab[gy0:gy1, sx:] == l).any():
                    n += 1
                    region = lab == l
                    region[:, :sx] = False
                    region[:gy0] = region[gy1:] = False
                    lab[region] = n
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(op, lab, range(1, n + 1))
    comps = []
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        comps.append({
            "label": i + 1, "size": int(sizes[i]),
            "x0": sl[1].start, "x1": sl[1].stop - 1, "y0": sl[0].start, "y1": sl[0].stop - 1,
            "cx": (sl[1].start + sl[1].stop - 1) / 2, "cy": (sl[0].start + sl[0].stop - 1) / 2,
        })

    sheet = Image.new("RGBA", (1400, 1400), (255, 0, 255, 255))
    sy = 6
    report = []
    for folder, ri, ci, title, _ in GROUPS:
        gx0, gx1 = COLS[ci]
        gy0, gy1 = ROWS[ri]
        members = [c for c in comps if gx0 <= c["cx"] < gx1 and gy0 <= c["cy"] < gy1 and c["y0"] >= gy0 - 3]
        def forced(c):
            return any(x0 <= c["x0"] and c["x1"] <= x1 and y0 <= c["y0"] and c["y1"] <= y1 for x0, x1, y0, y1 in FORCE_EXTRA)

        big = merge_stacked([c for c in members if c["size"] >= MIN_PIECE and not forced(c)])
        tiny = [c for c in members if c["size"] < MIN_PIECE and not forced(c)]
        largest = max(c["size"] for c in big)
        frames = sorted([c for c in big if c["size"] >= FRAME_RATIO * largest], key=lambda c: c["cx"])
        extras = [c for c in big if c["size"] < FRAME_RATIO * largest]
        extras += [dict(c, labels=[c["label"]]) for c in members if forced(c)]
        fw = max(c["x1"] - c["x0"] + 1 for c in frames) + 2 * PAD
        fh = max(c["y1"] - c["y0"] + 1 for c in frames) + 2 * PAD
        os.makedirs(f"{OUT}/{folder}", exist_ok=True)
        sx = 6
        for k, c in enumerate(frames, 1):
            w, h = c["x1"] - c["x0"] + 1, c["y1"] - c["y0"] + 1
            ox, oy = (fw - w) // 2, (fh - h) // 2
            # posição do quadro na prancha
            px0, py0 = c["x0"] - ox, c["y0"] - oy
            out = np.zeros((fh, fw, 4), np.uint8)
            keep = c["labels"] + [t["label"] for t in tiny if px0 <= t["cx"] < px0 + fw and py0 <= t["cy"] < py0 + fh]
            ys0, ys1 = max(0, py0), min(arr.shape[0], py0 + fh)
            xs0, xs1 = max(0, px0), min(arr.shape[1], px0 + fw)
            src = arr[ys0:ys1, xs0:xs1]
            mask = np.isin(lab[ys0:ys1, xs0:xs1], keep)
            dst = out[ys0 - py0:ys1 - py0, xs0 - px0:xs1 - px0]
            dst[mask] = src[mask]
            path = f"{OUT}/{folder}/frame-{k}.png"
            Image.fromarray(out).save(path)
            sheet.alpha_composite(Image.fromarray(out), (sx, sy))
            sx += fw + 8
        extra_note = ""
        if extras:
            ex0 = min(c["x0"] for c in extras) - PAD
            ex1 = max(c["x1"] for c in extras) + PAD
            ey0 = min(c["y0"] for c in extras) - PAD
            ey1 = max(c["y1"] for c in extras) + PAD
            crop = arr[ey0:ey1 + 1, ex0:ex1 + 1].copy()
            crop[~np.isin(lab[ey0:ey1 + 1, ex0:ex1 + 1], [l for c in extras for l in c["labels"]])] = 0
            Image.fromarray(crop).save(f"{OUT}/{folder}/extras.png")
            sheet.alpha_composite(Image.fromarray(crop), (sx, sy))
            where = ", ".join(f"x{c['x0']}-{c['x1']} y{c['y0']}-{c['y1']}" for c in extras[:3])
            extra_note = f", extras.png com {len(extras)} peça(s) ({crop.shape[1]}x{crop.shape[0]}: {where}{'...' if len(extras) > 3 else ''})"
        line = f"{folder:22s} {title:30s} {len(frames)} quadros de {fw}x{fh}{extra_note}"
        print(line)
        report.append(line)
        sy += fh + 10
    if PREVIEW_DIR:
        os.makedirs(PREVIEW_DIR, exist_ok=True)
        sheet.crop((0, 0, 1400, sy + 6)).convert("RGB").save(f"{PREVIEW_DIR}/enemies.png")


if __name__ == "__main__":
    main()
