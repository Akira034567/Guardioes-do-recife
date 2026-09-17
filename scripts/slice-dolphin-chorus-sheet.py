# Corte da prancha de animação do Golfinho / Coro II (art/guardians/golfinho/coro_2-canto-sheet.png).
#
# A prancha é uma grade 5x2 lida da esquerda para a direita, de cima para baixo: dez quadros do dueto
# cantando, das primeiras notas até o eco se apagando. Vira `coro_2/attack-1.png` ... `attack-10.png`,
# os quadros que `GuardianView` percorre no golpe e no canto.
#
#   python scripts/slice-dolphin-chorus-sheet.py
#
# O corte é a grade crua: quadros vizinhos invadem a célula do lado (os anéis passam da borda) e isso
# fica de propósito — o retoque de sobras é manual, aqui só entra o que dá para fazer sem julgar arte.
#
# Duas coisas NÃO são grade crua, porque decidem o encaixe no jogo e não a arte:
#
# - a janela vertical. As duas fileiras foram desenhadas em alturas diferentes (o dueto da fileira de
#   baixo está ~45px mais alto dentro da célula). Como o sprite é ancorado pela BASE, cortar a célula
#   inteira faria o golfinho pular meio corpo na metade da animação; cada fileira tem a sua janela,
#   escolhida para a barriga cair sempre na mesma linha.
# - a escala. A âncora é a base do canvas e a escala do Guardião é uma só, então os quadros precisam
#   sair no tamanho das outras imagens de `coro_2` (~206px de célula) ou a criatura mudaria de tamanho
#   ao atacar.
from PIL import Image
import os

SRC = "art/guardians/golfinho/coro_2-canto-sheet.png"
OUT = "public/assets/guardians/golfinho/coro_2"
COLS, ROWS = 5, 2
# Topo da janela de cada fileira, em pixels da célula: a diferença é o desalinhamento da prancha.
ROW_TOP = [45, 0]
WINDOW_H = 260
SCALE = 0.39


def main() -> None:
    sheet = Image.open(SRC).convert("RGBA")
    cell_w = sheet.width / COLS
    cell_h = sheet.height / ROWS
    # Largura INTEIRA e igual para os dez: a âncora do sprite é o centro da base, e um quadro 1px mais
    # largo que o vizinho desloca a criatura meio pixel no meio da animação.
    width = int(cell_w)
    os.makedirs(OUT, exist_ok=True)
    for row in range(ROWS):
        for col in range(COLS):
            x0 = round(col * cell_w)
            y0 = round(row * cell_h) + ROW_TOP[row]
            frame = sheet.crop((x0, y0, x0 + width, y0 + WINDOW_H))
            frame = frame.resize((round(frame.width * SCALE), round(frame.height * SCALE)), Image.LANCZOS)
            index = row * COLS + col + 1
            path = f"{OUT}/attack-{index}.png"
            frame.save(path)
            print(f"{frame.size[0]:4d}x{frame.size[1]:<4d} {path}")


if __name__ == "__main__":
    main()
