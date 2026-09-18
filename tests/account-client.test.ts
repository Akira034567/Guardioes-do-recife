import { describe, expect, it, vi } from "vitest";
import { AccountApi, OFFLINE } from "../src/game/core/account/AccountApi";
import { SessionStore } from "../src/game/core/account/SessionStore";
import { normalizeEmail, normalizeName, validateEmail, validateName, validatePassword } from "../src/game/core/account/rules";
import { SAVE_KEY, type SaveStorage } from "../src/game/core/save/SaveManager";

/** O lado do jogo: o crachá guardado no aparelho e o cliente que fala com o servidor. */

function memoryStorage(initial: Record<string, string> = {}): SaveStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

const user = { id: 7, email: "ana@exemplo.com", name: "Ana", verified: true, createdAt: "2026-09-18T12:00:00Z", lastLoginAt: null };

/** Uma resposta de `fetch` de mentira, com o status e o JSON que o teste quiser. */
function reply(status: number, payload: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => payload } as Response;
}

describe("regras compartilhadas com o servidor", () => {
  it("normaliza e-mail e nome do mesmo jeito dos dois lados", () => {
    expect(normalizeEmail("  Ana@Exemplo.COM ")).toBe("ana@exemplo.com");
    expect(normalizeName(" ANÁ   Maria ")).toBe("ana maria");
  });

  it("cobra formato de e-mail, tamanho de nome e tamanho de senha", () => {
    expect(validateEmail("ana")).not.toBeNull();
    expect(validateEmail("ana@exemplo")).not.toBeNull();
    expect(validateEmail("ana@exemplo.com")).toBeNull();
    expect(validateName("an")).not.toBeNull();
    expect(validateName("Ana Maria")).toBeNull();
    expect(validatePassword("1234567")).not.toBeNull();
    expect(validatePassword("coral12345")).toBeNull();
  });
});

describe("SessionStore", () => {
  it("sem sessão, o save é o do aparelho", () => {
    const store = new SessionStore(memoryStorage());
    expect(store.current).toBeNull();
    expect(store.saveKey()).toBe(SAVE_KEY);
  });

  it("com sessão, cada conta tem a sua chave de save", () => {
    const storage = memoryStorage();
    const store = new SessionStore(storage);
    store.set({ token: "abc", user });
    expect(store.saveKey()).toBe(`${SAVE_KEY}:u7`);
    // E o save do aparelho continua intocado: sair não apaga o que foi jogado como convidado.
    expect(storage.data[SAVE_KEY]).toBeUndefined();
  });

  it("sobrevive a recarregar a página e some ao sair", () => {
    const storage = memoryStorage();
    new SessionStore(storage).set({ token: "abc", user });

    const reloaded = new SessionStore(storage);
    expect(reloaded.user?.name).toBe("Ana");
    reloaded.clear();
    expect(new SessionStore(storage).current).toBeNull();
  });

  it("ignora sessão corrompida em vez de quebrar o jogo", () => {
    expect(new SessionStore(memoryStorage({ "guardioes-do-recife.session": "{{{" })).current).toBeNull();
    expect(new SessionStore(memoryStorage({ "guardioes-do-recife.session": '{"token":"x"}' })).current).toBeNull();
  });

  it("atualiza o retrato do usuário sem derrubar a sessão", () => {
    const store = new SessionStore(memoryStorage());
    store.set({ token: "abc", user: { ...user, verified: false } });
    store.updateUser({ ...user, verified: true });
    expect(store.token).toBe("abc");
    expect(store.user?.verified).toBe(true);
  });

  it("funciona sem armazenamento nenhum (aba anônima)", () => {
    const store = new SessionStore(null);
    store.set({ token: "abc", user });
    expect(store.user?.name).toBe("Ana");
  });
});

describe("AccountApi", () => {
  it("manda o cadastro como JSON e devolve o usuário", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(201, { ok: true, user, mailer: "smtp" }));
    const api = new AccountApi("http://servidor", fetcher);
    const result = await api.register("ana@exemplo.com", "Ana", "coral12345");

    expect(result).toMatchObject({ ok: true, mailer: "smtp" });
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("http://servidor/api/accounts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "ana@exemplo.com", name: "Ana", password: "coral12345" });
  });

  it("leva o token no cabeçalho quando a rota é da conta", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(200, { ok: true, save: null }));
    await new AccountApi("http://servidor", fetcher).getSave("token-123");
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe("Bearer token-123");
  });

  it("repassa a mensagem do servidor quando ele recusa", async () => {
    const fetcher = vi.fn().mockResolvedValue(reply(409, { ok: false, reason: "email-taken", message: "Já existe uma conta com esse e-mail." }));
    const result = await new AccountApi("http://servidor", fetcher).register("ana@exemplo.com", "Ana", "coral12345");
    expect(result).toMatchObject({ ok: false, status: 409, reason: "email-taken" });
    expect(result.ok === false && result.message).toContain("Já existe");
  });

  it("servidor fora do ar vira uma resposta, não uma exceção", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("connection refused"));
    const result = await new AccountApi("http://servidor", fetcher).login("ana@exemplo.com", "coral12345");
    expect(result).toEqual(OFFLINE);
    expect(result.ok === false && result.reason).toBe("offline");
  });

  it("resposta sem JSON não derruba a tela", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("não é JSON");
      },
    } as unknown as Response);
    const result = await new AccountApi("http://servidor", fetcher).health();
    expect(result).toMatchObject({ ok: false, status: 502, reason: "server" });
  });
});
