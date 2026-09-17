/**
 * Gera `docs/balanceamento.xlsx` — a planilha de balanceamento que o time lê fora do jogo.
 *
 * Os números NÃO saem daqui automaticamente: esta é uma transcrição de `src/game/data/balance.ts`
 * escrita à mão, com uma coluna de leitura em português para cada linha. Quando o balanceamento muda,
 * a planilha só muda se alguém atualizar este arquivo — é o preço de ter texto explicativo junto do
 * número, e é por isso que ele mora no repositório em vez de num rascunho perdido.
 *
 * Uso:
 *     node scripts/planilha/gerar-planilha.cjs
 */

const fs = require("fs");
const path = require("path");
const { buildWorkbook } = require("./xlsx.cjs");

const d1 = (v) => Math.round(v * 10) / 10;
const dps = (dmg, cd) => d1((dmg / cd) * 1000);

/* ------------------------------------------------------------------ 1. GUARDIÕES (BASE) */
const base = [
  ["Guardião", "Id", "Papel", "Onde coloca", "Custo", "Alcance (px)", "Dano", "Recarga (s)", "DPS base", "Tipo de ataque", "Bloqueia?", "Vagas de bloqueio", "Dano de contato/s", "Efeito da versão base"],
  ["Camarão-Pistola", "pistol-shrimp", "Dano à distância", "Plataforma", 80, 190, 24, 1.1, dps(24, 1100), "Projétil (vel. 460 px/s)", "Não", 0, 0, "Tiro simples em alvo único (o mais avançado na rota). É a régua de dano por pérola do jogo."],
  ["Água-viva", "jellyfish", "Controle", "Água livre", 90, 170, 12, 0.95, dps(12, 950), "Descarga (cadeia)", "Não", 0, 0, "Descarga que deixa o alvo a 70% da velocidade por 1,6s."],
  ["Baiacu", "pufferfish", "Contenção", "Correnteza (rota)", 105, 115, 0, 3.6, 0, "Área / bloqueio", "Sim", 1, 11, "Não ataca. Segura 1 inimigo por 3,5s e causa 11/s de contato. V3.1: o agarrão deixou de ser PERMANENTE — depois de soltar, 1,5s até poder pegar o mesmo de novo."],
  ["Caranguejo-Recife", "reef-crab", "Dano corpo a corpo", "Correnteza (rota)", 90, 78, 34, 1.25, dps(34, 1250), "Corpo a corpo", "Não", 0, 0, "Fica na rota e bate em quem passa. Melhor dano por pérola do jogo em troca de alcance curtíssimo."],
  ["Polvo-Tinteiro", "ink-octopus", "Suporte / debuff", "Plataforma ou água", 105, 155, 14, 1.5, dps(14, 1500), "Jato de tinta", "Não", 0, 0, "Dano fraco + o alvo passa a receber +12% de dano por 3s (vulnerabilidade). V3: dano 12 → 14."],
  ["Tubarão", "shark", "Execução", "Margem da rota", 110, 165, 36, 1.25, dps(36, 1250), "Investida corpo a corpo", "Não", 0, 0, "Sai da margem, morde e volta. Mira sempre o inimigo com MENOS vida ao alcance (lowestHealth)."],
  ["Tartaruga-Marinha", "sea-turtle", "Controle de rota", "Correnteza (rota)", 85, 100, 11, 1.5, dps(11, 1500), "Corpo a corpo", "Sim", 2, 0, "V3.1: bloqueia desde a base — 2 inimigos por 9s — 2,5x mais que o Baiacu: ela SEGURA, ele belisca. A batida deixa o alvo a 75% da velocidade por 1,4s."],
  ["Peixe-Pedra", "stonefish", "Emboscada • Veneno", "Borda da correnteza", 95, 70, 0, 3, d1((46 + 36) / 3), "Emboscada (não usa a FSM de ataque)", "Não", 0, 0, "V3.3: recarga 3s → 4,5s. V3.2 — DEIXOU DE SER ARMADILHA DESCARTÁVEL. Encaixa na BORDA da correnteza, camuflado de pedra, com a zona (raio 70) invadindo a rota. Quando alguém entra, abre os espinhos em 0,42s e dá o bote: 46 em área + veneno de 9/s por 4s (até 2 acúmulos = 72). Recolhe, recarrega 4,5s e repete a partida inteira. O bote é COMPROMETIDO: sai mesmo que o alvo escape no meio da abertura — é o que separa uma emboscada de um tiro teleguiado. Só a primeira camuflagem custa tempo (1,6s); depois o ciclo nunca mais se enterra do zero."],
  ["Golfinho", "dolphin", "Suporte", "Água livre ou margem", 110, 155, 11, 1.4, dps(11, 1400), "Pulso de sonar", "Não", 0, 0, "Pulso fraco + a cada 5,5s emite sonar (raio 155) que revela camuflados por 5s e aplica +10% de dano recebido por 4,5s. V3: dano 9 → 11."],
];

/* ------------------------------------------------------------------ 2. EVOLUÇÕES */
const up = [
  ["Guardião", "Ramo", "Nome do ramo", "Nível", "Upgrade", "Custo", "Investido total", "Dano", "Recarga (s)", "DPS alvo único", "DPS máximo (todos os alvos)", "O que faz exatamente"],

  ["Camarão-Pistola", "A", "Perfuração", 1, "Tiro Perfurante", 70, 150, "24 / 18", 1.1, dps(24, 1100), dps(42, 1100), "O projétil atravessa e acerta um 2º alvo: 24 no primeiro, 18 no segundo. Nunca acerta o mesmo inimigo duas vezes."],
  ["Camarão-Pistola", "A", "Perfuração", 2, "Ricochete Reto", 130, 280, "26 / 21 / 16", 1.1, dps(26, 1100), dps(63, 1100), "Até 3 alvos (26/21/16). Ao atravessar um inimigo, o tiro segue reto procurando um alvo novo em até 260 px."],
  ["Camarão-Pistola", "B", "Dano Concentrado", 1, "Carga Pesada", 70, 150, 44, 1.3, dps(44, 1300), dps(44, 1300), "Tiro único de 44 de dano a cada 1,3s. +83% de DPS sobre a base; ótimo contra armadura, elites e chefes."],
  ["Camarão-Pistola", "B", "Dano Concentrado", 2, "Estampido Abissal", 130, 280, 72, 1.4, dps(72, 1400), dps(72, 1400), "72 de dano a cada 1,4s + explosão de raio 58 px causando 50% do dano (36) em todos os outros dentro do raio."],

  ["Água-viva", "A", "Elétrico", 1, "Salto Elétrico", 80, 170, "14 / 11 / 9", 0.95, dps(14, 950), dps(34, 950), "A descarga salta em até 3 inimigos: 14 no primeiro, 11 no segundo, 9 no terceiro. Mantém o slow de 70%/1,6s."],
  ["Água-viva", "A", "Elétrico", 2, "Campo Elétrico", 135, 305, "14 / 11 / 9 + zona de 8", 0.95, dps(14, 950), dps(34, 950), "Mantém a cadeia e cria uma zona de raio 84 por 3,2s (recarga 5,2s): pulsa 8 de dano a cada 0,45s (≈7 pulsos, TETO de 56 por alvo) e deixa quem está dentro a 62% da velocidade por 0,8s."],
  ["Água-viva", "B", "Controle", 1, "Toque Gélido", 80, 170, 18, 0.95, dps(18, 950), dps(18, 950), "V3: 18 de dano (era 14) e lentidão pesada: o alvo cai para 45% da velocidade por 2,2s (era 70% por 1,6s)."],
  ["Água-viva", "B", "Controle", 2, "Paralisia", 135, 305, 18, 0.95, dps(18, 950), dps(18, 950), "Mantém o slow de 45%/2,2s e PARALISA o alvo por 0,9s. Cada inimigo fica imune a nova paralisia por 3s (não dá para travar em loop)."],

  ["Baiacu", "A", "Fortaleza", 1, "Espinhos Reforçados", 85, 190, "15/s (contato)", "contínuo", 15, 45, "Segura 3 inimigos por 4,5s cada e o contato sobe para 15/s em CADA um preso (45/s com a lotação cheia). Recarga de 1,5s por inimigo solto."],
  ["Baiacu", "A", "Fortaleza", 2, "Fortaleza Espinhosa", 145, 335, "19/s (contato)", "contínuo", 19, 95, "Segura 5 inimigos por 5,5s cada, 19/s em cada um (95/s lotado). Também PAUSA chefes por 1,6s — depois o chefe fica imune a esse agarrão por 8s."],
  ["Baiacu", "B", "Pulso", 1, "Pulso Espinhoso", 85, 190, 34, 3, dps(34, 3000), "11,3/s × nº de alvos", "Pulso de 34 de dano em área (raio 115) a cada 3s. Continua segurando 1 inimigo e causando 11/s de contato."],
  ["Baiacu", "B", "Pulso", 2, "Onda de Espinhos", 145, 335, 58, 2.8, dps(58, 2800), "20,7/s × nº de alvos", "Pulso de 58 em área a cada 2,8s e todos os atingidos ficam a 70% da velocidade por 1,2s."],

  ["Caranguejo-Recife", "A", "Quebra-Casco", 1, "Pinça Perfurante", 80, 170, 40, 1.25, dps(40, 1250), dps(40, 1250), "40 de dano IGNORANDO ARMADURA (o Cascudo, armadura 9, sofre os 40 cheios em vez de 25,6)."],
  ["Caranguejo-Recife", "A", "Quebra-Casco", 2, "Fratura Exposta", 140, 310, 58, 1.25, dps(58, 1250), dps(58, 1250), "58 ignorando armadura + o alvo passa a receber +25% de dano de TODA a equipe por 3,5s."],
  ["Caranguejo-Recife", "B", "Varredura", 1, "Pinçada Ampla", 80, 170, 28, 1.25, dps(28, 1250), "22,4/s × nº de alvos", "28 de dano em TODOS os inimigos dentro do alcance 78 a cada 1,25s. Troca 6 de dano por alvo múltiplo."],
  ["Caranguejo-Recife", "B", "Varredura", 2, "Giro de Carapaça", 140, 310, "28 (56 no giro)", 1.25, d1(((28 * 3 + 56) / 4 / 1250) * 1000), "28,0/s × nº de alvos", "28 em área; a cada 4 ataques gira 360° causando 56 num raio 1,7× maior (132,6 px). Média de 35 de dano por ataque. V3: era a cada 3 ataques (37,3 de média, 29,9 DPS) — implementado."],

  ["Polvo-Tinteiro", "A", "Tinta", 1, "Tinta Corrosiva", 90, 195, 17, 1.5, dps(17, 1500), dps(17, 1500), "V3: 17 de dano (era 15) e +20% de vulnerabilidade por 3s, espalhada num raio de 55 px ao redor do alvo."],
  ["Polvo-Tinteiro", "A", "Tinta", 2, "Nuvem de Tinta", 155, 350, 17, 1.5, dps(17, 1500), dps(17, 1500), "Mantém o jato de 17 e cria uma nuvem de raio 90 por 4s (recarga 6s): quem está dentro fica a 62% da velocidade e com +30% de vulnerabilidade — o TETO do jogo (vulnerabilidades não somam, vale sempre a maior)."],
  ["Polvo-Tinteiro", "B", "Maré Aliada", 1, "Ritmo da Maré", 90, 195, 14, 1.5, dps(14, 1500), dps(14, 1500), "AURA permanente: todo Guardião aliado dentro dos 155 px ataca 18% mais rápido. Auras não acumulam — vale sempre a melhor fonte."],
  ["Polvo-Tinteiro", "B", "Maré Aliada", 2, "Maré Alta", 155, 350, 14, 1.5, dps(14, 1500), dps(14, 1500), "AURA permanente: aliados atacam 25% mais rápido e ganham +15% de alcance."],

  ["Tubarão", "A", "Frenesi", 1, "Faro de Sangue", 90, 200, 36, "1,25 → 0,893", dps(36, 1250), dps(36, 893), "Contra alvos abaixo de 45% de vida ataca 40% mais rápido (recarga cai para 0,89s = 40,3 DPS). Passa a priorizar feridos e, na falta deles, o mais avançado."],
  ["Tubarão", "A", "Frenesi", 2, "Frenesi Predador", 150, 350, 36, "1,25 → 0,758", dps(36, 1250), dps(36, 758), "+12% de velocidade de ataque por inimigo ferido ao alcance, somando com o +40% base, até o teto de +65% (recarga 0,76s = 47,5 DPS)."],
  ["Tubarão", "B", "Investida", 1, "Investida Predadora", 90, 200, 46, 1.25, dps(46, 1250), d1(((46 * 1.35) / 1250) * 1000), "Bote de 46 de dano e alcance 206 px (+25%). A cada 7s marca a maior ameaça ao alcance (ponto fraco de chefe > elite > chefe > mais forte): +35% de dano contra ela por 6s. Passa a mirar por ameaça, não por vida baixa."],
  ["Tubarão", "B", "Investida", 2, "Predador Alfa", 150, 350, 58, 1.25, dps(58, 1250), d1(((58 * 1.85) / 1250) * 1000), "Bote de 58, alcance 206. A marca começa em +35% e cada golpe seguido na mesma presa soma +10%, até +50% (total máximo ×1,85 = 107 de dano por mordida). Se a presa morre, ele marca outra na hora."],

  ["Tartaruga-Marinha", "A", "Casco", 1, "Casco Ancestral", 75, 160, 11, 1.5, dps(11, 1500), dps(11, 1500), "Segura até 4 comuns por 12s (elite ocupa 2 vagas; chefe não é preso, só cai para 60% da velocidade por 1,4s). Depois de soltar, 3s de recarga. V3.1: NÃO mexe mais na água — turbulência virou exclusividade do ramo Correnteza."],
  ["Tartaruga-Marinha", "A", "Casco", 2, "Matriarca do Recife", 130, 290, 11, 1.5, dps(11, 1500), dps(11, 1500), "Segura 6 comuns por 14s (chefe: 50% da velocidade por 1,6s). Repulsa Ancestral a cada 9s: empurra comuns 110 px rota abaixo, elites 66 px (60%), chefes só levam o slow. Sem turbulência: isso é do outro ramo."],
  ["Tartaruga-Marinha", "B", "Correnteza", 1, "Condutora das Águas", 75, 160, 11, 1.5, dps(11, 1500), dps(11, 1500), "Zona de corrente contrária de raio 180 px: TODOS os inimigos dentro andam a 62% da velocidade. V3.1: também SEGURA 3 inimigos por 10s."],
  ["Tartaruga-Marinha", "B", "Correnteza", 2, "Senhora das Correntes", 130, 290, 11, 1.5, dps(11, 1500), dps(11, 1500), "Zona de raio 190 px a 55% da velocidade. Segura 5 inimigos por 11s. A cada 9s uma corrente forte empurra comuns 170 px para trás na rota (elites 102 px); chefes recebem 45% de velocidade por 2s."],

  ["Peixe-Pedra", "A", "Jardim Tóxico", 1, "Toxina Viva", 80, 175, "40 + veneno + névoa", 3, d1((40 + 50) / 3), d1((40 + 100) / 3), "Zona sobe para 78. Bote de 40 + veneno de 10/s por 5s (50 por acúmulo, até 2× = 100). O bote deixa no chão uma NÉVOA de raio 88 por 4s: quem atravessa é envenenado (8/s por 4s = 32) e anda a 85% da velocidade. O custo da névoa não sobe com o nº de alvos — ela cobra o mesmo de todo mundo que passa."],
  ["Peixe-Pedra", "A", "Jardim Tóxico", 2, "Jardim Abissal", 140, 315, "40 + veneno + névoa maior", 3, d1((40 + 60) / 3), d1((40 + 120) / 3), "Zona 86. Veneno de 10/s por 6s (60 por acúmulo, até 2× = 120). Névoa de raio 108 por 5s, agora a 80% da velocidade e envenenando 8/s por 6s (48). Quem MORRE envenenado dentro dela contamina os vizinhos num raio de 72 (8/s por 4s) — UMA vez por morte, sem reação em cadeia."],
  ["Peixe-Pedra", "B", "Predador de Emboscada", 1, "Espinhos Cortantes", 80, 175, "82 + veneno", 3, d1((82 + 36) / 3), "Zona pequena: quase sempre 1 alvo", "A zona ENCOLHE para 54 e o bote sobe para 82 IGNORANDO ARMADURA, mais o veneno da base (9/s por 4s). Contra o Cascudo (armadura 9, −36%) isso vale 82 cheios em vez de 52. Troca área por punição."],
  ["Peixe-Pedra", "B", "Predador de Emboscada", 2, "Caçador da Corrente", 140, 315, "96 + veneno + % da vida do alvo", 3, d1((96 + 36) / 3), "Zona pequena: quase sempre 1 alvo", "96 ignorando armadura + veneno. Quando um alvo FORTE (vida máxima ≥ 150) entra na zona ele TRAVA a presa, carrega os espinhos em 0,24s em vez de 0,42s e cobra pela vida MÁXIMA dela: +10% dessa vida, teto +80. Contra um comum de 90 o bônus é ruído; contra um Cascudo (210) são +21; contra o Quebra-Marés (469) o teto segura em +80 — punição real sem virar execução."],

  ["Golfinho", "A", "Coro", 1, "Chamado do Cardume", 95, 205, 11, 1.4, dps(11, 1400), dps(11, 1400), "A cada 11s, por 6s, num raio de 201 px (1,3×): aliados atacam +30% mais rápido, recarregam habilidades 20% antes e ganham +15% de alcance. Cada ESPÉCIE diferente de Guardião na área soma +3% de eficiência ao buff (máx. 5 espécies = ×1,15, ou seja +34,5% de velocidade)."],
  ["Golfinho", "A", "Coro", 2, "Maestro do Recife", 160, 365, 11, 1.4, dps(11, 1400), dps(11, 1400), "A cada 10,5s, por 6,5s, raio 248 px: +38% de velocidade de ataque, −25% de recarga de habilidades, +20% de alcance (com 5 espécies: +43,7%). Bônus temático por espécie: Tubarão +25% na velocidade da investida; Tartaruga +20% na duração do controle; Baiacu +15% de alcance; Caranguejo +15% de dano; Polvo +25% na duração dos debuffs; Peixe-Pedra −25% no tempo de rearme; Camarão +20% na velocidade do projétil."],
  ["Golfinho", "B", "Sonar", 1, "Olhos do Oceano", 95, 205, 11, 1.4, dps(11, 1400), dps(11, 1400), "Pulso a cada 5s, raio 248 px (1,6×): revela camuflados por 6s, marca a ameaça prioritária (ponto fraco > elite > chefe > mais avançado) e aplica +22% de dano recebido por 5,5s."],
  ["Golfinho", "B", "Sonar", 2, "Oráculo das Profundezas", 160, 365, 11, 1.4, dps(11, 1400), dps(11, 1400), "Eco Perfeito: 3 ondas seguidas a cada 0,35s, raio 263 px, recarga 5s. +25% de dano recebido por 5,5s e, por 4s, todos os Guardiões da área priorizam a maior ameaça dentro do próprio alcance."],
];

/* ------------------------------------------------------------------ 3. INIMIGOS */
const ARMOR_K = 16;
const red = (a) => `${Math.round((a / (a + ARMOR_K)) * 100)}%`;
const enemies = [
  ["Inimigo", "Id", "Papel", "Vida base", "Velocidade (px/s)", "Pérolas", "Armadura", "Dano reduzido pela armadura", "Dano ao Recife", "Raio de acerto", "Resistências", "Habilidades e observações"],
  ["Peixinho", "minnow", "Cardume", 24, 72, 2, 0, red(0), 1, 9, "—", "Enxame puro. V3: 18 → 24, o único que NÃO acompanhou a subida — continua morrendo a um AoE grande (34+), mas já não evapora no dano de raspão dos suportes. Nunca vira elite."],
  ["Peixe Invasor", "swimmer", "Comum", 90, 58, 6, 0, red(0), 1, 14, "—", "O inimigo padrão de referência. V3: 55 → 90, para custar 2–3 golpes relevantes em vez de um."],
  ["Peixe-Flecha", "dartfish", "Rápido", 60, 92, 7, 0, red(0), 1, 11, "—", "Pouca vida, corre muito: pune rota sem controle. V3: 35 → 60."],
  ["Peixe-Agulha", "needlefish", "Rápido", 78, 118, 9, 0, red(0), 2, 11, "—", "O mais veloz do jogo e leva 2 vidas do Recife se passar. V3: 45 → 78."],
  ["Água-viva Fantasma", "ghostJelly", "Comum / furtivo", 100, 70, 11, 2, red(2), 1, 13, "—", "CAMUFLADA: invisível e intocável até ser revelada. Dano em área NÃO a revela — ou um bloqueador da rota a segura, ou o sonar do Golfinho a expõe. V3: 60 → 100. ATENÇÃO: é o contra-ataque duro de builds sem bloqueador e sem Golfinho — ver a aba Decisões."],
  ["Cascudo", "shellback", "Blindado", 210, 40, 13, 9, red(9), 2, 18, "—", "Ignora 36% de todo dano recebido. Muito lento. É o alvo natural do Caranguejo (ramo Quebra-Casco ignora armadura). V3: 130 → 210."],
  ["Moreia Sombria", "moray", "Elite", 390, 52, 22, 5, red(5), 4, 20, "Lentidão −50%", "Muita vida e 4 de dano ao Recife. Só perde metade da velocidade que uma lentidão normal tiraria. V3: 250 → 390."],
  ["Tubarão Corrompido", "corruptedShark", "Elite", 500, 74, 32, 6, red(6), 5, 24, "Lentidão −40%, Paralisia −35%", "Investidas: a cada 5,2s acelera 1,9× por 1,4s. Abaixo de 40% de vida ENFURECE: +25% de velocidade, +4 de armadura (6→10 = 38% de redução) e +1,5 de dano ao Recife. V3: 320 → 500."],
  ["Quebra-Marés (CHEFE)", "tidebreaker", "Chefe", 550, 29, 60, 7, red(7), 10, 36, "Lentidão −35%", "NÃO PODE SER BLOQUEADO. V3: em vez de INVERTER a corrente, agora AMPLIFICA a corrente natural do mapa em ciclos de 6,5s (3s de maré grossa): força ×2,2 e deriva de projétil ×1,8. Não toca nas correntes criadas pela Tartaruga nem por nenhum Guardião. Tira 10 vidas se chegar; a vida base é sobrescrita por fase."],
];

/* ------------------------------------------------------------------ 4. POR FASE */
const levels = [
  { id: "recife-1", name: "Recife Costeiro", h: 0.64, s: 1, r: 1.2, pearls: 180, boss: 469, waves: 7, count: 63 },
  { id: "recife-2", name: "Canal das Algas", h: 0.84, s: 1.03, r: 1.15, pearls: 200, boss: 560, waves: 10, count: 187 },
  { id: "recife-3", name: "Três Redemoinhos", h: 0.94, s: 1.03, r: 1.15, pearls: 230, boss: 745, waves: 12, count: 242 },
  { id: "recife-4", name: "Espiral de Coral", h: 0.96, s: 1.06, r: 1.15, pearls: 320, boss: 990, waves: 15, count: 267 },
  { id: "recife-5", name: "Naufrágio do Galeão", h: 0.98, s: 1.05, r: 1.3, pearls: 360, boss: 1276, waves: 16, count: 280 },
  { id: "recife-6", name: "Coração do Recife", h: 1.08, s: 1.05, r: 1.25, pearls: 420, boss: 1482, waves: 18, count: 325 },
];
const baseHp = { minnow: 18, swimmer: 55, dartfish: 35, needlefish: 45, ghostJelly: 60, shellback: 130, moray: 250, corruptedShark: 320 };
const perLevel = [
  ["Fase", "Nome", "Ondas", "Inimigos", "Mult. de vida", "Mult. de velocidade", "Mult. de pérolas", "Pérolas iniciais", "Peixinho", "Peixe Invasor", "Peixe-Flecha", "Peixe-Agulha", "Água-viva Fantasma", "Cascudo", "Moreia", "Tubarão Corrompido", "CHEFE Quebra-Marés"],
  ...levels.map((l) => [
    l.id, l.name, l.waves, l.count, l.h, l.s, l.r, l.pearls,
    Math.round(baseHp.minnow * l.h), Math.round(baseHp.swimmer * l.h), Math.round(baseHp.dartfish * l.h),
    Math.round(baseHp.needlefish * l.h), Math.round(baseHp.ghostJelly * l.h), Math.round(baseHp.shellback * l.h),
    Math.round(baseHp.moray * l.h), Math.round(baseHp.corruptedShark * l.h), Math.round(l.boss * l.h),
  ]),
  [],
  ["NOTA", "V3: a campanha saiu de 5/6/7/7/8/9 ondas para 7/10/12/15/16/18, e de 41/87/135/107/119/141 inimigos para 63/187/242/267/280/325. A curva de vida do chefe em campo passou a ser 300 / 470 / 700 / 950 / 1250 / 1601. A dificuldade multiplica tudo de novo (Difícil x1,25, Abissal x1,60)."],
];

/* ------------------------------------------------------------------ 5. ELITES */
const elites = [
  ["Elite", "Id", "Vida", "Velocidade", "Armadura", "Pérolas", "Efeito extra", "Observação"],
  ["Blindado", "armored", "×1,30", "×0,95", "+6 (aditivo)", "×1,60", "—", "Cascudo Blindado: 169 de vida e armadura 15 = 48% de redução de dano."],
  ["Veloz", "swift", "×0,90", "×1,35", "—", "×1,40", "—", "Vidro: morre rápido, mas fura qualquer rota sem controle."],
  ["Regenerador", "regenerating", "×1,15", "—", "—", "×1,60", "Cura 2% da vida máxima por segundo", "Só volta a curar 1,5s depois do último dano recebido."],
  ["Furioso", "furious", "×1,10", "—", "—", "×1,50", "Abaixo de 50% de vida: +30% de velocidade", "—"],
  ["Resistente", "resilient", "×1,25", "—", "—", "×1,50", "Lentidão −35%, Paralisia −40%", "Soma com a resistência que o inimigo base já tiver (teto 100%)."],
  ["Camuflado", "camouflaged", "×1,05", "×1,10", "—", "×1,70", "Invisível até ser revelado OU atingido", "Diferente da Água-viva Fantasma: este é revelado por qualquer dano."],
  [],
  ["REGRA", "", "", "", "", "", "", "Chefes e cardumes (Peixinho) nunca viram elite. Um comum que vira elite passa a contar como 'elite' para os tiers de resistência a controle e para as vagas de bloqueio, e sobe para ameaça nível 2."],
];

/* ------------------------------------------------------------------ 6. DIFICULDADES */
const diffs = [
  ["Dificuldade", "Vida dos inimigos", "Velocidade", "Quantidade por grupo", "Chance de elite", "Pérolas ganhas", "Pérolas iniciais", "Vidas do Recife", "Pontos fracos do chefe"],
  ["Normal", "×1", "×1", "×1", "0%", "×1", "×1", "×1 (20)", "Nenhum"],
  ["Difícil", "×1,25", "×1,05", "×1,15", "15%", "×1,10", "×0,90", "×1 (20)", "Quebra-Marés ganha 4 Corais Corrompidos (10% da vida máx. cada)"],
  ["Abissal", "×1,60", "×1,12", "×1,30", "35%", "×1,20", "×0,80", "×0,75 (15)", "4 Corais Corrompidos com 14% da vida máx. cada"],
  [],
  ["Corais Corrompidos", "", "", "", "", "", "", "", "4 pontos fracos no dorso da baleia (raio 9 cada). Cada coral tem vida própria (10% ou 14% da vida máx. do chefe) e, ao ser destruído, arranca mais 17,5% da vida máxima dela. A baleia continua recebendo dano normalmente enquanto os corais existem — eles são o atalho, não a única porta."],
  ["Ordem dos multiplicadores", "", "", "", "", "", "", "", "A dificuldade multiplica POR CIMA do escalonamento da fase. Ex.: Cascudo no Recife-6 Abissal = 210 × 1,08 × 1,60 = 363 de vida."],
];

/* ------------------------------------------------------------------ 7. REGRAS */
const rules = [
  ["Tema", "Valor / fórmula", "O que significa na prática"],
  ["Armadura", "redução = armadura ÷ (armadura + 16)", "Redução PERCENTUAL, não subtração. Armadura nunca zera dano e nunca pune golpe fraco mais que golpe forte. Tabela: 2 = 11% · 5 = 24% · 6 = 27% · 7 = 30% · 9 = 36% · 10 = 38% · 15 = 48%."],
  ["Vulnerabilidade", "vale sempre a MAIOR, nunca soma", "Polvo II (+30%) e Golfinho II (+25%) na mesma criatura = +30%, não +55%. Teto do jogo: ×1,30."],
  ["Auras de aliado", "vale sempre a MELHOR fonte", "Dois Polvos com 'Maré Alta' não dão +50% de velocidade: dão +25%. A própria fonte nunca se beneficia da própria aura."],
  ["Coro do Golfinho", "eficiência = 1 + 0,03 × espécies (máx. 5)", "Só conta ESPÉCIE diferente, não unidade repetida. Com 5 espécies distintas todo o buff é multiplicado por 1,15."],
  ["Resistência a controle (CHEFE)", "janela 8s · passos 100% / 60% / 30% · imunidade 4s", "O 1º stun vale inteiro, o 2º vale 60% da duração, o 3º 30%; depois ele fica imune a controle forte por 4s."],
  ["Resistência a controle (ELITE)", "janela 6s · passos 100% / 75% / 50% · imunidade 2s", "Inimigos comuns NÃO têm essa resistência — travar um cardume funciona sempre."],
  ["Pérolas iniciais (padrão)", 180, "Cada fase soma o seu bônus: +0 / +20 / +50 / +140 / +180 / +240."],
  ["Peixinho Dourado", "1 por partida, aos ~60% das ondas", "Recompensa GARANTIDA (não é sorteio). V3.1: ele aparece nadando no canto inferior direito e o jogador ARRASTA até o Guardião que quer coroar — soltar no vazio traz ele de volta. Os benefícios estão ligados: ver a aba Peixinho Dourado. A escolha vale só aquela partida e não tem volta."],
  ["Maestria permanente", "5 nós por Guardião · 500/1.500/4.000/10.000/25.000 Conchas", "Progressão de fora da partida. Nós 1–4 somam 13% a 16% de bônus NOMINAL; o nó 5 é temático e só entra em vigor na unidade que chegar ao nível 2 de um ramo."],
  ["Vidas do Recife", 20, "Caem para 15 no Abissal."],
  ["Venda de Guardião", "25% do total investido", "Devolve 25% de (custo base + upgrades comprados), arredondado para baixo."],
  ["Bônus por onda limpa", 25, "Pérolas extras a cada onda concluída."],
  ["Bônus por fase concluída", 75, "Multiplicado pela dificuldade (×1,1 no Difícil, ×1,2 no Abissal)."],
  ["Chamar a onda antes da hora", "0 pérolas/s", "Desligado no balanceamento atual."],
  ["Árvore de upgrades", "2 ramos × 2 níveis, escolha definitiva", "Ao comprar o 1º nível de um ramo, o outro ramo tranca para aquela unidade. Não existe nível 3."],
  ["Como os upgrades substituem", "o ÚLTIMO valor definido vence", "Dano, recarga e capacidade são SUBSTITUÍDOS, não somados. Só alcance e velocidade de projétil são multiplicativos."],
  ["Distância mínima entre Guardiões", "78 px", "Vale para plataformas, água livre e margem."],
  ["Faixa da margem (Tubarão)", "30 a 120 px da linha da rota", "Por isso o alcance dele é 165: precisa cobrir a margem inteira mais o raio do maior inimigo."],
  ["Toque na correnteza", "até 52 px da linha da rota", "O que conta como 'estar na rota' para Baiacu, Caranguejo, Tartaruga e Peixe-Pedra."],
];

/* ------------------------------------------------------------------ 8. RESUMO DPS */
const resumo = [
  ["Guardião", "Build", "Investimento total", "DPS alvo único", "DPS por 100 pérolas", "Função real"],
  ["Camarão-Pistola", "Base", 80, dps(24, 1100), d1((dps(24, 1100) / 80) * 100), "Régua de DPS do jogo"],
  ["Camarão-Pistola", "A2 Ricochete Reto", 280, dps(26, 1100), d1((dps(63, 1100) / 280) * 100), "Limpa cardumes em linha (3 alvos = 57,3 DPS total)"],
  ["Camarão-Pistola", "B2 Estampido Abissal", 280, dps(72, 1400), d1((dps(72, 1400) / 280) * 100), "Perfura armadura e chefes"],
  ["Água-viva", "A2 Campo Elétrico", 305, dps(14, 950), d1((dps(34, 950) / 305) * 100), "Cadeia + zona de 56 de dano por alvo"],
  ["Água-viva", "B2 Paralisia", 305, dps(18, 950), d1((dps(18, 950) / 305) * 100), "Controle: 0,9s de stun a cada 3s por alvo"],
  ["Baiacu", "A2 Fortaleza Espinhosa", 335, 19, d1((95 / 335) * 100), "Segura 5 e derrete: 95 de dano/s com a lotação cheia"],
  ["Baiacu", "B2 Onda de Espinhos", 335, dps(58, 2800), d1((dps(58, 2800) / 335) * 100), "Área + slow, ainda bloqueando 1"],
  ["Caranguejo-Recife", "A2 Fratura Exposta", 310, dps(58, 1250), d1((dps(58, 1250) / 310) * 100), "Anti-armadura + amplifica a equipe (+25%)"],
  ["Caranguejo-Recife", "B2 Giro de Carapaça", 310, d1(((28 * 3 + 56) / 4 / 1250) * 1000), d1((d1(((28 * 3 + 56) / 4 / 1250) * 1000) / 310) * 100), "Melhor dano em área da rota (giro a cada 4 ataques)"],
  ["Polvo-Tinteiro", "A2 Nuvem de Tinta", 350, dps(17, 1500), d1((dps(17, 1500) / 350) * 100), "Não é dano: é +30% em tudo que entra na nuvem"],
  ["Polvo-Tinteiro", "B2 Maré Alta", 350, dps(14, 1500), d1((dps(14, 1500) / 350) * 100), "+25% de velocidade e +15% de alcance na equipe"],
  ["Tubarão", "A2 Frenesi Predador", 350, dps(36, 758), d1((dps(36, 758) / 350) * 100), "Executor de feridos"],
  ["Tubarão", "B2 Predador Alfa", 350, dps(58, 1250), d1(((((58 * 1.85) / 1250) * 1000) / 350) * 100), "Mata-chefe: até 107 por mordida na presa marcada"],
  ["Tartaruga-Marinha", "A2 Matriarca", 290, dps(11, 1500), d1((dps(11, 1500) / 290) * 100), "Bloqueia 6 + empurra 110 px a cada 9s"],
  ["Tartaruga-Marinha", "B2 Senhora das Correntes", 290, dps(11, 1500), d1((dps(11, 1500) / 290) * 100), "Zona de 190 px a 55% + empurrão de 170 px"],
  ["Peixe-Pedra", "A2 Jardim Abissal", 315, d1((40 + 60) / 3), d1((((40 + 60) / 3) / 315) * 100), "Veneno em área: o custo não sobe com o nº de alvos"],
  ["Peixe-Pedra", "B2 Caçador da Corrente", 315, d1((96 + 36) / 3), d1((((96 + 36) / 3) / 315) * 100), "Anti-elite: ignora armadura e cobra +10% da vida máxima do alvo (teto +80)"],
  ["Golfinho", "A2 Maestro do Recife", 365, dps(11, 1400), d1((dps(11, 1400) / 365) * 100), "Multiplica a equipe inteira por 6,5s a cada 10,5s"],
  ["Golfinho", "B2 Oráculo", 365, dps(11, 1400), d1((dps(11, 1400) / 365) * 100), "Revela camuflados + 25% de vulnerabilidade em área"],
  [],
  ["NOTA", "", "", "", "", "'DPS por 100 pérolas' = DPS ÷ investimento × 100. Suportes (Polvo B, Golfinho, Tartaruga) sempre parecem péssimos nessa coluna: o valor deles está no que fazem os OUTROS renderem."],
];


/* ------------------------------------------------------------------ 9. MAESTRIA PERMANENTE */
const mastery = [
  ["Guardião", "Nó", "Nome", "Custo (Conchas)", "Efeito", "Observação"],
  ["Camarão-Pistola", 1, "Pólvora Fina", 500, "+3% de dano", ""],
  ["Camarão-Pistola", 2, "Bolha Tensa", 1500, "+5% de velocidade do projétil", ""],
  ["Camarão-Pistola", 3, "Gatilho Leve", 4000, "+3% de cadência", ""],
  ["Camarão-Pistola", 4, "Mira Longa", 10000, "+4% de alcance", ""],
  ["Camarão-Pistola", 5, "Balística Perfeita", 25000, "A2: quarto ricochete mais fraco · B2: segunda explosão menor e atrasada", "Sem números ainda — estrutura pronta, efeito a definir"],
  ["Água-viva", 1, "Nematocisto Denso", 500, "+3% de dano", ""],
  ["Água-viva", 2, "Toque Persistente", 1500, "+4% de duração da lentidão", ""],
  ["Água-viva", 3, "Tentáculo Longo", 4000, "+4% de alcance", ""],
  ["Água-viva", 4, "Pulso Curto", 10000, "+3% de cadência", ""],
  ["Água-viva", 5, "Sobrecarga", 25000, "A2: espalha · B2: controla", "Sem números ainda"],
  ["Baiacu", 1, "Espinho Afiado", 500, "+4% de dano de contato", ""],
  ["Baiacu", 2, "Agarre Firme", 1500, "+4% de duração do bloqueio", ""],
  ["Baiacu", 3, "Inflar Mais", 4000, "+4% de alcance", ""],
  ["Baiacu", 4, "Couro Grosso", 10000, "+4% de dano de contato", ""],
  ["Baiacu", 5, "Fortaleza de Espinhos", 25000, "A2: mais contato e carga máxima · B2: pulsos maiores e mais frequentes", "Sem números ainda"],
  ["Caranguejo-Recife", 1, "Pinça Pesada", 500, "+3% de dano", ""],
  ["Caranguejo-Recife", 2, "Passada Larga", 1500, "+4% de alcance", "Muito, para quem só tem 78"],
  ["Caranguejo-Recife", 3, "Carapaça Leve", 4000, "+3% de cadência", ""],
  ["Caranguejo-Recife", 4, "Quelas Duplas", 10000, "+3% de dano", ""],
  ["Caranguejo-Recife", 5, "Pressão das Pinças", 25000, "A2: duelo contra alvos resistentes · B2: giro maior e pinçada extra estável", "Sem números ainda"],
  ["Polvo-Tinteiro", 1, "Tinta Espessa", 500, "+4% de duração dos debuffs", ""],
  ["Polvo-Tinteiro", 2, "Braço Longo", 1500, "+4% de alcance (vale para a aura)", ""],
  ["Polvo-Tinteiro", 3, "Bico Afiado", 4000, "+3% de dano", ""],
  ["Polvo-Tinteiro", 4, "Sifão Eficiente", 10000, "−4% na recarga de habilidades", ""],
  ["Polvo-Tinteiro", 5, "Tinta Viva", 25000, "A2: mancha ao morrer · B2: pulso ao abate dentro da aura", "Sem números ainda"],
  ["Tubarão", 1, "Dentes Serrilhados", 500, "+3% de dano", ""],
  ["Tubarão", 2, "Bote Longo", 1500, "+4% de alcance da investida", ""],
  ["Tubarão", 3, "Nado Curto", 4000, "+3% de cadência", ""],
  ["Tubarão", 4, "Faro Apurado", 10000, "+3% de dano", ""],
  ["Tubarão", 5, "Caçada Implacável", 25000, "A2: frenesi mais suave entre presas · B2: preserva parte da marca", "Sem números ainda"],
  ["Tartaruga-Marinha", 1, "Casco Largo", 500, "+4% de alcance (a zona cresce junto)", ""],
  ["Tartaruga-Marinha", 2, "Peso Ancestral", 1500, "+4% de duração do controle", ""],
  ["Tartaruga-Marinha", 3, "Bicada Firme", 4000, "+3% de dano", ""],
  ["Tartaruga-Marinha", 4, "Braçada Forte", 10000, "+4% na distância da repulsa", ""],
  ["Tartaruga-Marinha", 5, "Domínio das Correntes", 25000, "A2: mais capacidade territorial · B2: onda de corrente extra", "Sem números ainda"],
  ["Peixe-Pedra", 1, "Bote Rápido", 500, "−4% no tempo de abrir os espinhos", ""],
  ["Peixe-Pedra", 2, "Fôlego Curto", 1500, "−4% na recarga entre emboscadas", ""],
  ["Peixe-Pedra", 3, "Sombra Larga", 4000, "+4% na zona de emboscada", ""],
  ["Peixe-Pedra", 4, "Peçonha Densa", 10000, "+4% na duração do veneno que ele aplica", "V3.2: substituiu o teto da carga, que não existe mais"],
  ["Peixe-Pedra", 5, "Território Mortal", 25000, "A2 Ecossistema Tóxico: a PRIMEIRA entrada de cada inimigo no Jardim leva dose extra e curta · B2 Paciência Mortal: cada segundo camuflado sem atacar soma dano ao próximo bote, até um teto", "Sem números ainda"],
  ["Golfinho", 1, "Eco Amplo", 500, "+4% de alcance", ""],
  ["Golfinho", 2, "Nota Sustentada", 1500, "+4% de duração", ""],
  ["Golfinho", 3, "Fôlego Longo", 4000, "−4% na recarga", ""],
  ["Golfinho", 4, "Canto Claro", 10000, "+3% de dano", ""],
  ["Golfinho", 5, "Sincronia do Recife", 25000, "A2: bônus maior por diversidade · B2: eco-onda extra pequeno", "Sem números ainda"],
  [],
  ["REGRA", "", "", "", "", "Nós 1–4 somam 13% a 16% de bônus NOMINAL (soma de eixos diferentes, não poder efetivo). O nó 5 só entra em vigor na unidade que chegar ao NÍVEL 2 DE UM RAMO dentro da partida, e o efeito muda com o ramo. Custo total da árvore: 41.000 Conchas por Guardião."],
];

/* ------------------------------------------------------------------ 10. PEIXINHO DOURADO */
const golden = [
  ["Guardião", "Sem ramo (base)", "Ramo A coroado", "Ramo B coroado"],
  ["Camarão-Pistola", "Mais dano e cadência no disparo simples", "Menos perda por alvo atravessado, mais cadência", "Mais raio e impacto na explosão"],
  ["Água-viva", "Mais dano e lentidão mais longa", "Campo maior e pulso mais rápido", "Paralisia maior, intervalo interno menor"],
  ["Baiacu", "Mais dano de contato", "Mais contato e mais carga máxima de presos", "Pulsos maiores e mais frequentes"],
  ["Caranguejo-Recife", "Mais dano e cadência", "Mais peso contra alvos resistentes", "Giro maior e pinçada extra estável"],
  ["Polvo-Tinteiro", "Debuffs mais longos e mais alcance", "Mancha mais forte e mais duradoura", "Aura cobre mais e rende mais"],
  ["Tubarão", "Mais dano e alcance no bote", "Transição mais suave entre presas", "Preserva parte da marca ao trocar de presa"],
  ["Tartaruga-Marinha", "Zona maior e controles mais longos", "Mais capacidade de contenção", "Mais zona e onda de corrente mais forte"],
  ["Peixe-Pedra", "Bote +20%, zona +12%, recarga −15%", "Bote +15%, zona +12%, veneno 20% mais longo", "Bote +25%, recarga −18%, zona +8%"],
  ["Golfinho", "Pulso mais amplo e duradouro", "Bônus maior por diversidade", "Eco-onda extra ao fim do pulso"],
  [],
  ["COMO FUNCIONA", "1 por partida · concedido aos ~60% das ondas · recompensa GARANTIDA, sem sorteio", "O jogador toca numa unidade em campo e a coroa. A escolha vale só aquela partida e não tem volta.", "Alvo de ganho: 20% a 30% efetivo. 🔶 Números ainda não definidos — estrutura pronta."],
  ["NÃO CONFUNDIR", "Maestria é permanente, de todas as unidades da espécie, comprada com Conchas.", "Coroa é de uma partida, de UMA unidade, conquistada jogando.", "Visual: dourado é SEMPRE peixinho coroado; o nó 5 da maestria tem partícula própria, não-dourada."],
  ["VISUAL", "Coroa é asset separado flutuando acima do Guardião (sem repintar o personagem)", "Coroação de 1s: pilar de luz, clarão e a coroa assentando", "Em campo: coroa + halo dourado sutil"],
];

/* ------------------------------------------------------------------ 11. DECISÕES PENDENTES */
const decisoes = [
  ["#", "Assunto", "O que foi medido", "Decisão que falta"],
  [1, "Água-viva Fantasma × builds sem resposta", "Na fase 5, o build de dano puro (5 Camarões + Caranguejo, sem bloqueador e sem Golfinho) vence com 2 de 20 vidas, e 8 das 10 Fantasmas passam direto. Na fase 6, 9 vazam. A Fantasma só é revelada por bloqueador ou sonar — dano em área NÃO a expõe.", "Ou o dano puro passa a EXIGIR um contador de camuflagem (e isso vira regra de design), ou a Fantasma ganha uma terceira forma de ser vista. Já reduzi a quantidade dela nas fases 5 e 6 duas vezes; reduzir mais apagaria a criatura."],
  [2, "Sobra de pérolas nas fases longas", "Fases 4 a 6 terminam com 700 a 1.700 pérolas não gastas: o tabuleiro enche antes de a renda acabar.", "Aceitar a sobra (vira margem para o Peixinho e a maestria), cortar renda, ou abrir mais espaço de colocação nas fases longas."],
  [3, "Amplificação da corrente da Baleia", "Força ×2,2 e deriva ×1,8 por 3s a cada 6,5s. Números novos, nunca jogados.", "Calibrar. O teto de segurança está em 0,9 de força para quem nada contra nunca parar nem andar de ré."],
  [4, "Nó 5 da maestria e coroa do Peixinho", "Desenho fechado por Guardião e por ramo; estrutura, persistência, tela e evento prontos.", "Definir os números de cada efeito. Nenhum sistema lê os efeitos ainda — é o ponto de extensão marcado no código."],
  [5, "Faixa de poder da maestria", "Nós 1–4 somam 13% a 16% NOMINAIS. Como são eixos diferentes (dano, alcance, duração), o ganho efetivo é menor.", "Confirmar em partida se cai na faixa combinada de 10% a 15% de poder efetivo, ou ajustar os nós."],
  [6, "Peixe-Pedra: calibrar o ciclo novo", "A V3.3 subiu a recarga de 3s para 4,5s, a pedido: a 3s ele emboscava quase sem parar e a fantasia de emboscador caía. Na simulação o efeito foi pequeno — a mesma partida do golden terminou 3,3s mais tarde, com as mesmas vidas e pérolas.", "Ver à mão se 4,5s deixa a espera boa sem tirar a relevância dele nas fases longas."],
];

const sheets = [
  { name: "Guardiões (base)", rows: base, widths: [20, 14, 18, 18, 8, 12, 8, 12, 10, 24, 10, 16, 16, 90] },
  { name: "Evoluções", rows: up, widths: [20, 6, 18, 7, 22, 8, 14, 20, 14, 14, 22, 120] },
  { name: "Resumo DPS", rows: resumo, widths: [20, 26, 16, 14, 20, 55] },
  { name: "Inimigos (base)", rows: enemies, widths: [22, 16, 16, 10, 16, 9, 10, 24, 14, 13, 26, 95] },
  { name: "Inimigos por fase", rows: perLevel, widths: [11, 20, 12, 16, 14, 14, 10, 13, 12, 13, 18, 10, 9, 18, 18] },
  { name: "Elites", rows: elites, widths: [16, 14, 9, 11, 14, 9, 34, 70] },
  { name: "Dificuldades", rows: diffs, widths: [20, 16, 11, 18, 14, 14, 14, 14, 80] },
  { name: "Regras e fórmulas", rows: rules, widths: [30, 34, 100] },
  { name: "Maestria", rows: mastery, widths: [20, 5, 24, 16, 60, 60] },
  { name: "Peixinho Dourado", rows: golden, widths: [20, 46, 46, 50] },
  { name: "Decisões pendentes", rows: decisoes, widths: [4, 34, 90, 80] },
];

const out = path.join(__dirname, "..", "..", "docs", "balanceamento.xlsx");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, buildWorkbook(sheets));
console.log("ok ->", out, fs.statSync(out).size, "bytes");
