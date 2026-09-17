"""Prepara a pedra do Peixe-Pedra camuflado e corrige a escala do idle do Golfinho Maestro.

Duas peças avulsas que chegaram fora do fluxo das pranchas, cada uma com um problema próprio.

1. `art/peixe_pedra/pedra-oculta.png` — o monte de pedra que o Peixe-Pedra VIRA enquanto está
   camuflado ou se recuperando do bote. Antes disso o jogo mostrava o peixe translúcido, que é uma
   forma fraca de dizer "ele sumiu": o bicho continuava com silhueta de peixe e o jogador continuava
   vendo um peixe. Uma pedra é uma pedra.

2. `golfinho/coro_2/idle.png` — a arte retocada à mão chegou em 1774x887, enquanto TODA a família do
   Golfinho tem ~200x60. Como `GuardianView` aplica uma escala única por Guardião, aquilo aparecia
   com mais de 1200 px de largura em campo. Aqui ela é reenquadrada no mesmo gabarito dos irmãos:
   bicho com a largura de um upgrade de nível 2 e encostado na base do canvas, que é onde a âncora
   (0.5, 1) espera encontrá-lo.

Uso:
    python scripts/prepare-stonefish-hidden.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GUARDIANS = ROOT / "public" / "assets" / "guardians"

ALPHA_FLOOR = 8


def trim(image: Image.Image) -> Image.Image:
    bounds = image.getchannel("A").point(lambda value: 255 if value > ALPHA_FLOOR else 0).getbbox()
    if bounds is None:
        raise SystemExit("imagem vazia")
    return image.crop(bounds)


def save(image: Image.Image, path: Path) -> None:
    """Paleta de 255 cores, como o resto da arte de Guardião: tudo isto é pré-carregado no boot."""
    path.parent.mkdir(parents=True, exist_ok=True)
    image.quantize(colors=255, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    print(f"{path.relative_to(ROOT).as_posix():54} {image.width}x{image.height}  {path.stat().st_size / 1024:.0f} KB")


def stonefish_hidden() -> None:
    source = ROOT / "art" / "peixe_pedra" / "pedra-oculta.png"
    if not source.exists():
        raise SystemExit(f"faltando: {source}")
    rock = trim(Image.open(source).convert("RGBA"))
    # A pedra fica um pouco MENOR que o peixe: ela tem de passar por cenário, não por unidade. O peixe
    # camuflado tem ~195 px de largura; 168 deixa a pedra discreta sem sumir no fundo.
    width = 168
    rock = rock.resize((width, max(1, round(rock.height * width / rock.width))), Image.LANCZOS)
    # Mesmo gabarito das outras peças do Peixe-Pedra: largura da célula e bicho encostado na base.
    canvas = Image.new("RGBA", (199, rock.height + 1), (0, 0, 0, 0))
    canvas.alpha_composite(rock, ((canvas.width - rock.width) // 2, 0))
    save(canvas, GUARDIANS / "peixe_pedra" / "oculto.png")


def dolphin_choir_idle() -> None:
    path = GUARDIANS / "golfinho" / "coro_2" / "idle.png"
    dolphin = trim(Image.open(path).convert("RGBA"))
    if dolphin.width <= 300:
        print(f"{path.name}: já está no gabarito ({dolphin.width}px), nada a fazer")
        return
    # Largura do bicho num upgrade de nível 2 do Golfinho: o Sonar II tem 141 px. O Maestro fica um
    # fio maior, porque ele É a forma mais vistosa do ramo — mas na mesma ordem de grandeza.
    width = 148
    dolphin = dolphin.resize((width, max(1, round(dolphin.height * width / dolphin.width))), Image.LANCZOS)
    # 206 é a largura das outras peças do `coro_2`; a escala única do Guardião conta com isso.
    canvas = Image.new("RGBA", (206, dolphin.height + 1), (0, 0, 0, 0))
    canvas.alpha_composite(dolphin, ((canvas.width - dolphin.width) // 2, 0))
    save(canvas, path)


def main() -> None:
    stonefish_hidden()
    dolphin_choir_idle()


if __name__ == "__main__":
    main()
