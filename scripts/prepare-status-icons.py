"""Prepara os ícones de efeito de status para o runtime.

Substitui o corte da prancha antiga (`status-sheet.png`, mantida em `art/status/` como histórico): os
ícones agora chegam já recortados e com transparência, um arquivo por efeito. O que sobra para este
script é o trabalho chato: aparar a moldura vazia e reduzir para o tamanho que o jogo realmente usa —
os originais têm ~500 px e aparecem com ~30 px em cima do inimigo.

Uso:
    python scripts/prepare-status-icons.py

Os ids seguem `src/game/assets/statusArt.ts`.
"""

from pathlib import Path

from PIL import Image

ART = Path(__file__).resolve().parent.parent / "art" / "status"
OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "status"

# Arquivo de origem → id no jogo. A mira é REVELADO (camuflado exposto), não "marcado": a marca do
# Tubarão Alfa continua sendo o triângulo vetorial, que aponta para a presa e diz outra coisa.
ICONS = {
    "stun": "stun",
    "slow": "slow",
    "poison": "poison",
    "vulneravel": "vulnerable",
    "revelado": "revealed",
}

# Maior lado do PNG final. O ícone aparece sobre o inimigo com ~30 px; 96 dá o dobro de folga para
# tela grande e mantém a pasta leve — ela é carregada em toda partida.
MAX_SIDE = 96

# Abaixo disto o pixel é só halo e não define o enquadramento.
ALPHA_FLOOR = 8


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for source, name in ICONS.items():
        path = ART / f"{source}.png"
        if not path.exists():
            raise SystemExit(f"faltando: {path}")
        icon = Image.open(path).convert("RGBA")
        bounds = icon.getchannel("A").point(lambda value: 255 if value > ALPHA_FLOOR else 0).getbbox()
        if bounds is None:
            raise SystemExit(f"{name}: imagem vazia")
        icon = icon.crop(bounds)
        if max(icon.size) > MAX_SIDE:
            scale = MAX_SIDE / max(icon.size)
            icon = icon.resize((max(1, round(icon.width * scale)), max(1, round(icon.height * scale))), Image.LANCZOS)
        icon.save(OUT / f"{name}.png")
        print(f"{name:12} {icon.width:3}x{icon.height:3}")


if __name__ == "__main__":
    main()
