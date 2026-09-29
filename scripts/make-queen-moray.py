"""
Moreia-Rainha (chefe dos Canais Profundos): placeholder derivado da Moreia das Correntes.

Lê `public/assets/enemies/moreia-das-correntes/frame-N.png` (sem alterar) e grava uma versão
recolorida — verde-abismo com brilho dourado — em `public/assets/enemies/rainha-moreia/`. Quando a
arte própria do chefe chegar, é só substituir os arquivos dessa pasta.

    python scripts/make-queen-moray.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "assets" / "enemies" / "moreia-das-correntes"
OUT = ROOT / "public" / "assets" / "enemies" / "rainha-moreia"


def recolor(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA")).astype(np.float32) / 255.0
    rgb, alpha = rgba[..., :3], rgba[..., 3:]
    luminance = (rgb * np.array([0.299, 0.587, 0.114])).sum(axis=-1, keepdims=True)
    # Sombra verde-abismo, luz dourada: a mesma moreia, mas "coroada".
    dark = np.array([0.05, 0.22, 0.2])
    light = np.array([1.0, 0.86, 0.35])
    tinted = dark + (light - dark) * np.clip(luminance * 1.15, 0, 1)
    mixed = rgb * 0.25 + tinted * 0.75
    return Image.fromarray((np.concatenate([mixed, alpha], axis=-1) * 255).astype(np.uint8), "RGBA")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    frames = sorted(SRC.glob("frame-*.png"))
    for frame in frames:
        recolor(Image.open(frame)).save(OUT / frame.name, optimize=True)
    print(f"{len(frames)} quadros em {OUT}")


if __name__ == "__main__":
    main()
