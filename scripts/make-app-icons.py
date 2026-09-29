"""
Gera os ícones do app (tela inicial do celular, favicon, manifest) a partir da arte da bússola.

Entrada: art/brand/icon-source.png — a bússola com fundo transparente, não quadrada.
Saída:   public/icons/icon-{180,192,512}.png, icon-maskable-512.png e favicon-32.png.

O iOS pinta a transparência de um ícone de tela inicial de PRETO, então todo ícone sai com fundo
próprio (o mesmo mar escuro do tema). O "maskable" do Android pode ser recortado em círculo pelo
lançador: nele a arte ocupa só a zona segura (80% do centro).

    python scripts/make-app-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "brand" / "icon-source.png"
OUT = ROOT / "public" / "icons"

TOP = (10, 90, 128)
BOTTOM = (3, 31, 53)


def background(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size))
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        color = tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3))
        draw.line([(0, y), (size, y)], fill=(*color, 255))
    return img


def compose(size: int, fill: float) -> Image.Image:
    art = Image.open(SRC).convert("RGBA")
    art = art.crop(art.getbbox())
    scale = (size * fill) / max(art.width, art.height)
    art = art.resize((round(art.width * scale), round(art.height * scale)), Image.LANCZOS)
    img = background(size)
    img.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return img.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        compose(size, 0.96).save(OUT / f"icon-{size}.png", optimize=True)
    compose(512, 0.78).save(OUT / "icon-maskable-512.png", optimize=True)
    compose(32, 1.0).save(OUT / "favicon-32.png", optimize=True)
    print("ícones gerados em", OUT)


if __name__ == "__main__":
    main()
