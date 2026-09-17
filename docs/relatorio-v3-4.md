# Relatório — rodada V3.4 (pausa, velocidade e a paciência do Peixe-Pedra)

Continuação de [`relatorio-v3-3.md`](relatorio-v3-3.md). Planilha atualizada: `balanceamento.xlsx`.

**Testes unitários: 598 passando, 0 falhando.**
**E2E: suíte completa rodada.**

---

## 1. O Peixinho Dourado parou de acelerar

A 2× ele nadava duas vezes mais rápido no canto da tela. A causa: a apresentação recebia o delta da
SIMULAÇÃO — já multiplicado pela velocidade da partida — e o badge usava esse número.

Faz sentido para quase tudo: o inimigo a 2× anda mesmo duas vezes mais rápido. Não faz para a
interface. O Peixinho esperando para ser arrastado não está na partida; acelerar o nado dele é dizer
que a UI também está em 2×.

Agora `syncViews` recebe os dois tempos — o de simulação e o de relógio — e o badge usa o de relógio.

---

## 2. Velocidade: um botão que alterna

Eram dois botões lado a lado, 1× e 2×, e um deles estava **sempre apagado sem fazer nada** — metade
do espaço da barra servia para mostrar a opção que não estava valendo.

Agora é um só. Ele mostra a velocidade **atual** e troca ao toque. Mostrar a atual (e não "o que vai
acontecer se eu clicar") é o que mantém a barra de cima legível de relance: ela responde "como está a
partida agora", não "o que este botão faz".

O controle registrado passou de `speed:1`/`speed:2` para `speed`; o passo do tutorial que apontava
para o botão 2× foi reescrito.

---

## 3. Pausa: uma gaveta ao lado do mapa

Era um painel centralizado com véu escuro por cima de tudo. O jogador pausava para **estudar o
campo** e a primeira coisa que o jogo fazia era esconder o campo.

Agora a partida congela e o mapa continua à vista. Tudo mora numa coluna encostada num dos lados:

- estado da partida (fase, onda, Recife, pérolas);
- CONTINUAR, ESCOLA DO RECIFE, REINICIAR FASE, FASES, SAIR PARA O RECIFE;
- **todas as opções de configuração**, inline e roláveis — áudio, vídeo, jogabilidade,
  acessibilidade e dados. Não abre outra tela por cima do mapa.

As seções de configuração não foram copiadas: `SettingsScreen` passou a exportar `settingsSections()`
e os dois lugares usam a mesma fonte. Duplicar garantiria que as duas versões divergissem no primeiro
ajuste novo.

### De que lado a gaveta encosta

A cena mede **quanto de rota cai em cada faixa candidata**, andando pelo traçado (não só pelos nós,
porque dois waypoints distantes podem ter um trecho inteiro entre eles), e encosta no lado com menos
rota. Empate vai para a direita, onde o bloco de comandos já mora.

**Onde isso não basta:** em fases como o Recife 1 a rota atravessa a tela inteira e **não existe lado
livre**. Para esses casos a gaveta é semitransparente com desfoque — o trecho coberto continua
legível por baixo. É um acordo, não uma solução: se você preferir, dá para deixá-la mais estreita ou
recolhível.

---

## 4. Reiniciar e Fases saíram do HUD

Os dois jogam a partida fora e estavam a um toque de distância de PRÓXIMA ONDA, que é o botão mais
apertado do jogo. Foram para a gaveta, e lá **pedem confirmação**: o primeiro toque arma o botão (ele
fica vermelho e troca para "TOQUE DE NOVO PARA CONFIRMAR"), o segundo executa.

PRÓXIMA ONDA ficou com o bloco de comandos inteiro.

As sondas e2e que clicavam nesses botões agora passam pela gaveta, por dois atalhos novos em
`helpers.ts` (`restartViaPause`, `levelsViaPause`) que fazem o caminho completo, confirmação inclusa.

---

## 5. Recarga do Peixe-Pedra: 4,5s → 7s

Pedido direto ("bastante"). O efeito no papel:

| | 3s (V3.2) | 4,5s (V3.3) | **7s (agora)** |
|---|---|---|---|
| Base | 27,3/s | 18,2/s | **11,7/s** |
| A2 Jardim Abissal | 33,3/s | 22,2/s | **14,3/s** |
| B1 Espinhos Cortantes | 39,3/s | 26,2/s | **16,9/s** |
| B2 Caçador da Corrente | 44,0/s | 29,3/s | **18,9/s** |

Contra um chefe, o B2 com o bônus de vida máxima chega a 30,3/s.

**O que a simulação disse:** nada. As três builds que usam o Peixe-Pedra fecharam **exatamente
iguais** — mesmas vidas, mesmas pérolas, mesmas ondas, e o golden nem precisou ser atualizado. Isso
não é a simulação dizendo "está tudo bem"; é ela dizendo que **ele nunca foi o pilar de dano de
nenhuma dessas builds**, então cortar a cadência dele não muda o resultado delas.

**A leitura honesta:** a 11,7/s de base ele deixou de ser uma unidade de dano. A conta dele agora é
"quanto dano cabe num bote", não "quantos botes cabem numa onda" — é controle e veneno pontual, com
um golpe pesado a cada 7 segundos. Isso é coerente com a fantasia de emboscador, mas é uma mudança de
PAPEL, não só de ritmo.

**Pendência que eu deixo explícita:** se a intenção era manter o peso dele e só esticar a espera, o
caminho é subir o dano do bote junto — algo como 46 → 70 na base recolocaria o DPS perto do que era a
4,5s mantendo os 7s de espera. Não fiz porque você pediu a espera, não o dano, e essa é uma decisão
de desenho sua.

---

## 6. O que ficou de fora

| Item | Por quê |
|---|---|
| Compensar o dano do bote | Ver acima: é decisão sua se ele deve continuar pesando o mesmo. |
| Gaveta recolhível / mais estreita | A translucidez resolve o caso do Recife 1 razoavelmente; se não bastar, dá para encolher ou pôr um botão de recolher. |
| Nuvem de tinta do Polvo | Continua com o mesmo problema de sobreposição da névoa, ainda não apontado. |
