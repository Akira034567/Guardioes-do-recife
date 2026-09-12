/**
 * Chave única dos testes de balanceamento.
 *
 * Ligada, as sondas que jogam fases inteiras rodam: a tabela da simulação headless
 * (`balance-sim.test.ts`), o laboratório de geometria e orçamento (`balance-lab.test.ts`) e as
 * sondas no jogo real (`e2e/balance.spec.ts`, cerca de 1h30). Desligada, todas ficam puladas.
 *
 * Continuam valendo, sempre: `match-golden.test.ts` (congela o resultado exato de cada build e é a
 * rede de segurança de qualquer refatoração do motor) e `balance.test.ts` (confere a tabela de
 * preços e números acordados). Nenhum dos dois joga partida nem imprime relatório.
 *
 * Para voltar ao balanceamento, troque esta linha para `true`.
 */
export const BALANCE_SUITES_ON = false;

export const BALANCE_SWITCH_HINT = "Testes de balanceamento desligados: ligue BALANCE_SUITES_ON em tests/balanceSwitch.ts.";
