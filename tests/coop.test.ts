import { describe, expect, it } from "vitest";
import { Match } from "../src/game/core/match/Match";
import { DEFAULT_PLAYER_ID } from "../src/game/core/match/MatchCommands";
import type { MatchEvent } from "../src/game/core/match/MatchEvents";
import { LEVELS } from "../src/game/data/levels";
import { GUARDIANS } from "../src/game/data/guardians";

const RECIFE_ONE = LEVELS[0];
const PLATFORM = RECIFE_ONE.placements[0];
const SECOND_PLATFORM = RECIFE_ONE.placements[1];
const TWO_PLAYERS = [
  { id: "p1", teamId: "t1" },
  { id: "p2", teamId: "t1" },
];

/**
 * Prontidão para cooperativo (item 47). O motor já é a única fonte de regra, os comandos carregam
 * `playerId` e o relógio vive fora dele; o que faltava era o caixa por jogador. Estes testes fixam o
 * contrato para quando a rede existir.
 */
describe("coop readiness", () => {
  it("mantém o caixa único como padrão", () => {
    const match = new Match(RECIFE_ONE, { players: TWO_PLAYERS });
    expect(match.economyMode).toBe("shared");
    expect(match.playerIds).toEqual(["p1", "p2"]);

    const cost = GUARDIANS["pistol-shrimp"].cost;
    match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: PLATFORM.x, y: PLATFORM.y, playerId: "p1" });
    // Um caixa só: o que o p1 gasta some para os dois.
    expect(match.pearls("p1")).toBe(RECIFE_ONE.startingPearls - cost);
    expect(match.pearls("p2")).toBe(RECIFE_ONE.startingPearls - cost);
  });

  it("dá um caixa por jogador no modo individual", () => {
    const match = new Match(RECIFE_ONE, { players: TWO_PLAYERS, economyMode: "individual" });
    const cost = GUARDIANS["pistol-shrimp"].cost;
    expect(match.pearls("p1")).toBe(RECIFE_ONE.startingPearls);
    expect(match.pearls("p2")).toBe(RECIFE_ONE.startingPearls);

    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: PLATFORM.x, y: PLATFORM.y, playerId: "p1" });
    expect(placed.ok).toBe(true);
    expect(match.pearls("p1")).toBe(RECIFE_ONE.startingPearls - cost);
    expect(match.pearls("p2"), "o vizinho não paga a conta").toBe(RECIFE_ONE.startingPearls);
    expect(match.guardians[0].ownerId).toBe("p1");

    const second = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: SECOND_PLATFORM.x, y: SECOND_PLATFORM.y, playerId: "p2" });
    expect(second.ok).toBe(true);
    expect(match.guardians[1].ownerId).toBe("p2");
    expect(match.pearls("p2")).toBe(RECIFE_ONE.startingPearls - cost);
  });

  it("divide o que a partida gera com a mesa inteira", () => {
    const match = new Match(RECIFE_ONE, { players: TWO_PLAYERS, economyMode: "individual" });
    const events: MatchEvent[] = [];
    match.setListener((event) => events.push(event));
    match.execute({ type: "debug.addPearls", amount: 50, playerId: "p1" });
    // Recompensa da partida (inimigo, onda, fase) pinga para todos, não só para quem clicou.
    expect(match.pearls("p1")).toBe(RECIFE_ONE.startingPearls + 50);
    expect(match.pearls("p2")).toBe(RECIFE_ONE.startingPearls + 50);
    const credited = events.filter((event) => event.type === "pearlsChanged");
    expect(credited.map((event) => (event as { playerId: string }).playerId)).toEqual(["p1", "p2"]);
  });

  it("cobra de quem manda o comando, inclusive no upgrade", () => {
    const match = new Match(RECIFE_ONE, { players: TWO_PLAYERS, economyMode: "individual" });
    const placed = match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: PLATFORM.x, y: PLATFORM.y, playerId: "p1" });
    const instanceId = placed.ok ? (placed.instanceId as string) : "";
    const before = match.pearls("p2");
    // O p2 paga o upgrade de uma unidade que o p1 colocou: a conta segue quem clica.
    const upgrade = match.execute({ type: "upgradeGuardian", instanceId, branchId: "a", playerId: "p2" });
    expect(upgrade.ok).toBe(true);
    expect(match.pearls("p2")).toBeLessThan(before);
    expect(match.pearls("p1")).toBe(RECIFE_ONE.startingPearls - GUARDIANS["pistol-shrimp"].cost);
  });

  it("recusa a compra por falta de pérolas do próprio jogador", () => {
    const match = new Match(RECIFE_ONE, { players: TWO_PLAYERS, economyMode: "individual" });
    // Esvazia o caixa do p1 com colocações sucessivas.
    for (const placement of RECIFE_ONE.placements) {
      match.execute({ type: "placeGuardian", guardianId: "ink-octopus", x: placement.x, y: placement.y, playerId: "p1" });
    }
    const broke = match.execute({ type: "placeGuardian", guardianId: "ink-octopus", x: 640, y: 560, playerId: "p1" });
    expect(broke).toMatchObject({ ok: false, reason: "insufficientPearls" });
    expect(match.pearls("p2"), "o p2 continua com o dele").toBe(RECIFE_ONE.startingPearls);
  });

  it("devolve um snapshot por jogador", () => {
    const match = new Match(RECIFE_ONE, { players: TWO_PLAYERS, economyMode: "individual" });
    match.execute({ type: "placeGuardian", guardianId: "pistol-shrimp", x: PLATFORM.x, y: PLATFORM.y, playerId: "p1" });
    expect(match.snapshot("p1").pearls).toBeLessThan(match.snapshot("p2").pearls);
    // Sem argumento, é a visão do jogador padrão — o jogo de um jogador só.
    expect(match.snapshot().pearls).toBe(match.snapshot(DEFAULT_PLAYER_ID).pearls);
    // O resto do estado é o mesmo para os dois: o Recife é compartilhado.
    expect(match.snapshot("p1").reef).toBe(match.snapshot("p2").reef);
  });
});
