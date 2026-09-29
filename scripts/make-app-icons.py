"""
Gera os ícones do app (tela inicial do celular, favicon, manifest) a partir da arte da bússola.

Entrada: art/brand/icon-source.png — a bússola já desenhada como um "ícone": quadrado de cantos
         arredondados, com um filete claro na borda, sobre fundo transparente (384x331).
Saída:   public/icons/icon-{180,192,512}.png, icon-maskable-512.png e favicon-32.png.

O ícone sai SANGRADO: quadrado cheio, sem canto arredondado e sem borda. Quem arredonda é o
sistema (o iOS aplica a máscara dele por cima). Usar a arte inteira, com os cantos e o filete dela,
fazia aparecer uma moldura dentro da moldura — e, como a arte não é quadrada, a bússola saía
deslocada. Por isso o recorte (`CROP`) é o maior quadrado centrado que fica DENTRO dos cantos
arredondados e do filete da arte.

O "maskable" do Android pode ser recortado em círculo pelo lançador: nele a arte ocupa só a zona
segura, sobre o mar escuro do tema.

    python scripts/make-app-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "art" / "brand" / "icon-source.png"
OUT = ROOT / "public" / "icons"

# Maior quadrado centrado dentro dos cantos arredondados e do filete claro de `icon-source.png`.
CROP = (62, 29, 331, 298)

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


def square_art() -> Image.Image:
    return Image.open(SRC).convert("RGBA").crop(CROP)


def bleed(size: int) -> Image.Image:
    """Quadrado cheio, borda a borda: é o sistema que arredonda."""
    return square_art().resize((size, size), Image.LANCZOS).convert("RGB")


def maskable(size: int, fill: float) -> Image.Image:
    art = square_art().resize((round(size * fill),) * 2, Image.LANCZOS)
    img = background(size)
    img.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return img.convert("RGB")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (180, 192, 512):
        bleed(size).save(OUT / f"icon-{size}.png", optimize=True)
    maskable(512, 0.84).save(OUT / "icon-maskable-512.png", optimize=True)
    bleed(32).save(OUT / "favicon-32.png", optimize=True)
    print("ícones gerados em", OUT)


if __name__ == "__main__":
    main()
