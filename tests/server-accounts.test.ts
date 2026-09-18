import { beforeEach, describe, expect, it } from "vitest";
import { AccountService } from "../server/accounts.ts";
import { openDatabase } from "../server/db.ts";
import { memoryMailer } from "../server/mailer.ts";
import { hashPassword, verifyPassword } from "../server/passwords.ts";

/**
 * As regras de conta contra o banco DE VERDADE (SQLite em memória, mesmo schema e mesmas
 * restrições). É o que dá sentido a "não repete e-mail nem nome": quem barra é o índice `UNIQUE`,
 * e é ele que estes testes exercitam.
 */

function service(now = () => new Date("2026-09-18T12:00:00Z")) {
  const mailer = memoryMailer();
  return { mailer, service: new AccountService(openDatabase(":memory:"), mailer, { appUrl: "http://localhost:4000", now }) };
}

const linkToken = (text: string): string => (text.match(/token=(\S+)/) as RegExpMatchArray)[1];

describe("senha", () => {
  it("guarda derivação, nunca a senha", () => {
    const stored = hashPassword("coral12345", 1000);
    expect(stored).not.toContain("coral12345");
    expect(stored.startsWith("pbkdf2$sha256$1000$")).toBe(true);
    expect(verifyPassword("coral12345", stored)).toBe(true);
    expect(verifyPassword("coral12346", stored)).toBe(false);
  });

  it("dá um sal diferente para cada senha igual", () => {
    expect(hashPassword("coral12345", 1000)).not.toBe(hashPassword("coral12345", 1000));
  });

  it("confere contra o custo com que o hash NASCEU, não o de hoje", () => {
    // Sem isto, subir as iterações amanhã trancaria todo mundo para fora.
    expect(verifyPassword("coral12345", hashPassword("coral12345", 1000))).toBe(true);
  });
});

describe("cadastro", () => {
  let api: ReturnType<typeof service>;
  beforeEach(() => {
    api = service();
  });

  it("cria a conta e manda o e-mail de confirmação", async () => {
    const result = await api.service.register({ email: "Ana@Exemplo.com ", name: "Ana", password: "coral12345" });
    expect(result).toMatchObject({ ok: true });
    if (!result.ok) return;
    expect(result.user.email).toBe("ana@exemplo.com");
    expect(result.user.verified).toBe(false);
    expect(api.mailer.sent).toHaveLength(1);
    expect(api.mailer.sent[0].to).toBe("ana@exemplo.com");
    expect(api.mailer.sent[0].text).toContain("/api/verify?token=");
  });

  it("não deixa dois e-mails iguais, nem trocando a caixa", async () => {
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    const again = await api.service.register({ email: "ANA@Exemplo.com", name: "Outra", password: "coral12345" });
    expect(again).toMatchObject({ ok: false, status: 409, reason: "email-taken" });
  });

  it("não deixa dois nomes iguais, nem com acento ou caixa diferente", async () => {
    await api.service.register({ email: "a@exemplo.com", name: "Ana", password: "coral12345" });
    const again = await api.service.register({ email: "b@exemplo.com", name: " ANÁ ", password: "coral12345" });
    expect(again).toMatchObject({ ok: false, status: 409, reason: "name-taken" });
  });

  it("recusa e-mail sem formato, nome curto e senha curta", async () => {
    expect(await api.service.register({ email: "ana", name: "Ana", password: "coral12345" })).toMatchObject({ status: 400 });
    expect(await api.service.register({ email: "a@exemplo.com", name: "An", password: "coral12345" })).toMatchObject({ status: 400 });
    expect(await api.service.register({ email: "a@exemplo.com", name: "Ana", password: "123" })).toMatchObject({ status: 400 });
  });
});

describe("confirmação de e-mail", () => {
  it("só entra depois de confirmar, e o link vale uma vez só", async () => {
    const api = service();
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });

    expect(await api.service.login("ana@exemplo.com", "coral12345")).toMatchObject({ ok: false, status: 403, reason: "unverified" });

    const token = linkToken(api.mailer.sent[0].text);
    expect(api.service.verify(token)).toMatchObject({ ok: true });
    // Segundo uso do mesmo link não vale: ele foi gasto.
    expect(api.service.verify(token)).toMatchObject({ ok: false, status: 410 });
    expect(await api.service.login("ana@exemplo.com", "coral12345")).toMatchObject({ ok: true });
  });

  it("recusa link vencido", async () => {
    let clock = new Date("2026-09-18T12:00:00Z");
    const api = service(() => clock);
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    clock = new Date("2026-09-20T12:00:00Z");
    expect(api.service.verify(linkToken(api.mailer.sent[0].text))).toMatchObject({ ok: false, status: 410 });
  });

  it("reenvia a confirmação e invalida o link anterior", async () => {
    const api = service();
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    const primeiro = linkToken(api.mailer.sent[0].text);
    await api.service.resendVerification("ana@exemplo.com");
    const segundo = linkToken(api.mailer.sent[1].text);
    expect(segundo).not.toBe(primeiro);
    expect(api.service.verify(primeiro)).toMatchObject({ ok: false });
    expect(api.service.verify(segundo)).toMatchObject({ ok: true });
  });

  it("fica calado quando o e-mail não existe (não entrega quem tem conta aqui)", async () => {
    const api = service();
    await api.service.resendVerification("ninguem@exemplo.com");
    expect(api.mailer.sent).toHaveLength(0);
  });
});

describe("entrar", () => {
  async function verified() {
    const api = service();
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    api.service.verify(linkToken(api.mailer.sent[0].text));
    return api;
  }

  it("aceita a senha certa e recusa a errada com a MESMA mensagem de e-mail inexistente", async () => {
    const api = await verified();
    const errada = await api.service.login("ana@exemplo.com", "outra-senha");
    const inexistente = await api.service.login("ninguem@exemplo.com", "coral12345");
    expect(errada).toMatchObject({ ok: false, status: 401 });
    expect(inexistente.ok === false && errada.ok === false && inexistente.message).toBe(errada.ok === false ? errada.message : "");
    expect(await api.service.login("ana@exemplo.com", "coral12345")).toMatchObject({ ok: true });
  });

  it("devolve um token que identifica o dono, e o esquece no logout", async () => {
    const api = await verified();
    const entrou = await api.service.login("ana@exemplo.com", "coral12345");
    if (!entrou.ok) throw new Error("login deveria ter dado certo");
    expect(api.service.authenticate(entrou.token)?.email).toBe("ana@exemplo.com");
    api.service.logout(entrou.token);
    expect(api.service.authenticate(entrou.token)).toBeNull();
    expect(api.service.authenticate("token-inventado")).toBeNull();
  });

  it("recusa sessão vencida", async () => {
    let clock = new Date("2026-09-18T12:00:00Z");
    const api = service(() => clock);
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    api.service.verify(linkToken(api.mailer.sent[0].text));
    const entrou = await api.service.login("ana@exemplo.com", "coral12345");
    if (!entrou.ok) throw new Error("login deveria ter dado certo");
    clock = new Date("2027-09-18T12:00:00Z");
    expect(api.service.authenticate(entrou.token)).toBeNull();
  });
});

describe("recuperar a senha", () => {
  async function ready() {
    const api = service();
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    api.service.verify(linkToken(api.mailer.sent[0].text));
    const entrou = await api.service.login("ana@exemplo.com", "coral12345");
    return { api, token: entrou.ok ? entrou.token : "" };
  }

  it("manda o link, troca a senha e derruba as sessões antigas", async () => {
    const { api, token } = await ready();
    await api.service.forgotPassword("ana@exemplo.com");
    const reset = linkToken(api.mailer.sent[1].text);

    expect(api.service.resetPassword(reset, "senha-nova-123")).toMatchObject({ ok: true });
    expect(await api.service.login("ana@exemplo.com", "coral12345")).toMatchObject({ ok: false });
    expect(await api.service.login("ana@exemplo.com", "senha-nova-123")).toMatchObject({ ok: true });
    // Quem perdeu a conta para outra pessoa não fica com ela logada do outro lado.
    expect(api.service.authenticate(token)).toBeNull();
  });

  it("não conta se o e-mail existe, e o link de troca também é de uso único", async () => {
    const { api } = await ready();
    await api.service.forgotPassword("ninguem@exemplo.com");
    expect(api.mailer.sent).toHaveLength(1);

    await api.service.forgotPassword("ana@exemplo.com");
    const reset = linkToken(api.mailer.sent[1].text);
    expect(api.service.resetPassword(reset, "senha-nova-123")).toMatchObject({ ok: true });
    expect(api.service.resetPassword(reset, "outra-senha-123")).toMatchObject({ ok: false, status: 410 });
  });

  it("recusa senha curta antes de gastar o link", async () => {
    const { api } = await ready();
    await api.service.forgotPassword("ana@exemplo.com");
    const reset = linkToken(api.mailer.sent[1].text);
    expect(api.service.resetPassword(reset, "123")).toMatchObject({ ok: false, status: 400 });
    expect(api.service.resetPassword(reset, "senha-nova-123")).toMatchObject({ ok: true });
  });
});

describe("progresso e conta", () => {
  async function logged() {
    const api = service();
    await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
    api.service.verify(linkToken(api.mailer.sent[0].text));
    const entrou = await api.service.login("ana@exemplo.com", "coral12345");
    if (!entrou.ok) throw new Error("login deveria ter dado certo");
    return { api, user: entrou.user, token: entrou.token };
  }

  it("guarda e devolve o save da conta", async () => {
    const { api, user } = await logged();
    expect(api.service.getSave(user.id)).toBeNull();
    api.service.putSave(user.id, '{"saveVersion":5,"currency":{"shells":42}}');
    expect(api.service.getSave(user.id)?.document).toContain('"shells":42');
    api.service.putSave(user.id, '{"saveVersion":5,"currency":{"shells":99}}');
    expect(api.service.getSave(user.id)?.document).toContain('"shells":99');
  });

  it("entra com o save junto, que é o que faz a conta valer em outro aparelho", async () => {
    const { api, user } = await logged();
    api.service.putSave(user.id, '{"saveVersion":5,"currency":{"shells":42}}');
    const outroAparelho = await api.service.login("ana@exemplo.com", "coral12345");
    expect(outroAparelho.ok && outroAparelho.save?.document).toContain('"shells":42');
  });

  it("apagar a conta leva junto save, sessões e links", async () => {
    const { api, user, token } = await logged();
    api.service.putSave(user.id, '{"saveVersion":5}');
    expect(api.service.deleteAccount(user.id, "errada")).toMatchObject({ ok: false, status: 401 });
    expect(api.service.deleteAccount(user.id, "coral12345")).toMatchObject({ ok: true });
    expect(api.service.authenticate(token)).toBeNull();
    expect(api.service.getSave(user.id)).toBeNull();
    expect(api.service.listUsers()).toHaveLength(0);
    // E o e-mail fica livre de novo.
    expect(await api.service.register({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" })).toMatchObject({ ok: true });
  });

  it("lista o que existe no banco, sem senha nenhuma", async () => {
    const { api, user } = await logged();
    api.service.putSave(user.id, '{"saveVersion":5}');
    const listed = api.service.listUsers();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({ email: "ana@exemplo.com", name: "Ana", verified: true, hasSave: true });
    expect(JSON.stringify(listed)).not.toContain("pbkdf2");
  });
});
