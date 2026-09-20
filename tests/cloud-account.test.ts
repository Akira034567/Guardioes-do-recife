import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudAccount, CLOUD_SESSION_KEY, validateCloudPassword, validateEmail } from "../src/game/core/account/CloudAccount";
import type { SaveStorage } from "../src/game/core/save/SaveManager";

/**
 * A conta na nuvem sem nuvem nenhuma: o `fetch` é trocado por um servidor de mentira que responde o
 * que o Supabase responderia. O que estas sondas protegem é o contrato — quais rotas o jogo chama,
 * o que ele guarda do que volta e, principalmente, o que ele faz quando dá errado.
 */

function memoryStorage(): SaveStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const CONFIG = { url: "https://exemplo.supabase.co", anonKey: "chave-anon" };

interface Call {
  url: string;
  method: string;
  body: unknown;
}

function server(routes: Record<string, (body: unknown) => { status?: number; json: unknown }>): { calls: Call[] } {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: string, init: RequestInit = {}) => {
    const url = String(input);
    const body: unknown = typeof init.body === "string" && init.body.length > 0 ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method ?? "GET", body });
    const key = Object.keys(routes).find((candidate) => url.includes(candidate));
    const route = key ? routes[key] : undefined;
    if (!route) return new Response(JSON.stringify({ message: `rota não simulada: ${url}` }), { status: 404 });
    const result = route(body);
    return new Response(JSON.stringify(result.json), { status: result.status ?? 200 });
  });
  return { calls };
}

const SESSION = {
  access_token: "token-de-acesso",
  refresh_token: "token-de-renovacao",
  expires_in: 3600,
  user: { id: "user-1", email: "ana@exemplo.com" },
};

beforeEach(() => {
  vi.stubGlobal("window", { location: { origin: "https://jogo.exemplo", pathname: "/recife/" } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validações da conta na nuvem", () => {
  it("exige um e-mail com cara de e-mail", () => {
    expect(validateEmail("ana@exemplo.com")).toBeNull();
    expect(validateEmail("ana@exemplo")).not.toBeNull();
    expect(validateEmail("")).not.toBeNull();
  });

  it("usa o piso do servidor para a senha, que é maior que o do jogo", () => {
    expect(validateCloudPassword("1234"), "4 basta na conta local, não na da nuvem").not.toBeNull();
    expect(validateCloudPassword("123456")).toBeNull();
  });
});

describe("sem configuração", () => {
  it("não se anuncia e recusa toda operação com uma mensagem clara", async () => {
    const cloud = new CloudAccount(null, memoryStorage());
    expect(cloud.isConfigured).toBe(false);
    expect(cloud.profile).toBeNull();
    expect(cloud.saveKey()).toBeNull();
    const result = await cloud.signIn("ana", "123456");
    expect(result).toEqual({ ok: false, message: "A conta na nuvem não está configurada nesta instalação." });
  });
});

describe("entrar", () => {
  it("troca usuário por e-mail antes de autenticar, e guarda a sessão", async () => {
    const { calls } = server({
      "/rest/v1/rpc/email_for_credentials": () => ({ json: "ana@exemplo.com" }),
      "/auth/v1/token": () => ({ json: SESSION }),
      "/rest/v1/profiles": () => ({ json: [{ username: "Ana" }] }),
    });
    const storage = memoryStorage();
    const cloud = new CloudAccount(CONFIG, storage);

    const result = await cloud.signIn("Ana", "senha-boa");
    expect(result.ok).toBe(true);
    expect(cloud.profile).toMatchObject({ username: "Ana", email: "ana@exemplo.com", userId: "user-1" });
    expect(cloud.saveKey()).toBe("guardioes-do-recife.save:cloud:user-1");
    // A sessão sobrevive ao recarregar a página.
    expect(new CloudAccount(CONFIG, storage).profile?.username).toBe("Ana");
    expect(calls[0].url).toContain("email_for_credentials");
    expect(calls[1].url).toContain("grant_type=password");
  });

  it("com e-mail no campo, pula a tradução e vai direto ao login", async () => {
    const { calls } = server({
      "/auth/v1/token": () => ({ json: SESSION }),
      "/rest/v1/profiles": () => ({ json: [{ username: "Ana" }] }),
    });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    expect((await cloud.signIn("ana@exemplo.com", "senha-boa")).ok).toBe(true);
    expect(calls.some((call) => call.url.includes("email_for_credentials"))).toBe(false);
  });

  it("senha errada e usuário inexistente dão a MESMA resposta", async () => {
    server({ "/rest/v1/rpc/email_for_credentials": () => ({ json: null }) });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    const wrongPassword = await cloud.signIn("Ana", "errada");
    const noSuchUser = await cloud.signIn("Ninguem", "errada");
    expect(wrongPassword).toEqual(noSuchUser);
    expect(wrongPassword.ok).toBe(false);
  });

  it("traduz o erro do servidor para algo acionável", async () => {
    server({ "/auth/v1/token": () => ({ status: 400, json: { error_description: "Invalid login credentials" } }) });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    const result = await cloud.signIn("ana@exemplo.com", "errada");
    expect(result).toEqual({ ok: false, message: "E-mail, usuário ou senha não conferem." });
  });

  it("servidor fora do ar não estoura: vira mensagem de conexão", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    const result = await cloud.signIn("ana@exemplo.com", "senha-boa");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("conexão");
  });
});

describe("criar conta", () => {
  it("recusa nome já usado antes de mandar qualquer coisa para o Auth", async () => {
    const { calls } = server({ "/rest/v1/rpc/username_available": () => ({ json: false }) });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    const result = await cloud.signUp({ username: "Ana", email: "outra@exemplo.com", password: "senha-boa" });
    expect(result.ok).toBe(false);
    expect(calls.some((call) => call.url.includes("/auth/v1/signup"))).toBe(false);
  });

  it("manda o nome de usuário nos metadados, que é de onde o gatilho cria o perfil", async () => {
    const { calls } = server({
      "/rest/v1/rpc/username_available": () => ({ json: true }),
      "/auth/v1/signup": () => ({ json: { id: "user-1" } }),
    });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    const result = await cloud.signUp({ username: "Ana", email: "ana@exemplo.com", password: "senha-boa", confirmPassword: "senha-boa" });
    expect(result).toEqual({ ok: true, value: { needsConfirmation: true } });
    const signup = calls.find((call) => call.url.includes("/auth/v1/signup"));
    expect(signup?.body).toMatchObject({ email: "ana@exemplo.com", data: { username: "Ana" } });
    // Sem sessão na resposta (confirmação de e-mail ligada), ninguém entra ainda.
    expect(cloud.profile).toBeNull();
  });

  it("valida antes de sair da máquina", async () => {
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    expect((await cloud.signUp({ username: "a", email: "ana@exemplo.com", password: "senha-boa" })).ok).toBe(false);
    expect((await cloud.signUp({ username: "Ana", email: "nao-e-email", password: "senha-boa" })).ok).toBe(false);
    expect((await cloud.signUp({ username: "Ana", email: "ana@exemplo.com", password: "123" })).ok).toBe(false);
    expect((await cloud.signUp({ username: "Ana", email: "ana@exemplo.com", password: "senha-boa", confirmPassword: "outra" })).ok).toBe(false);
  });
});

describe("progresso", () => {
  async function signedIn(routes: Parameters<typeof server>[0] = {}): Promise<CloudAccount> {
    server({
      "/rest/v1/rpc/email_for_credentials": () => ({ json: "ana@exemplo.com" }),
      "/auth/v1/token": () => ({ json: SESSION }),
      "/rest/v1/profiles": () => ({ json: [{ username: "Ana" }] }),
      ...routes,
    });
    const cloud = new CloudAccount(CONFIG, memoryStorage());
    await cloud.signIn("Ana", "senha-boa");
    return cloud;
  }

  it("puxa o documento gravado", async () => {
    const cloud = await signedIn({
      "/rest/v1/saves": () => ({ json: [{ document: { saveVersion: 6, updatedAt: "2026-09-01T10:00:00.000Z" }, updated_at: "2026-09-01T10:00:00.000Z", revision: 3 }] }),
    });
    const pulled = await cloud.pull();
    expect(pulled.ok && pulled.value?.document).toMatchObject({ saveVersion: 6 });
    expect(cloud.sync.error).toBeNull();
  });

  it("conta vazia responde null em vez de um documento de mentira", async () => {
    const cloud = await signedIn({ "/rest/v1/saves": () => ({ json: [{ document: {}, updated_at: "2026-09-01T10:00:00.000Z", revision: 1 }] }) });
    const pulled = await cloud.pull();
    expect(pulled).toEqual({ ok: true, value: null });
  });

  it("falha ao empurrar vira aviso, nunca exceção", async () => {
    const cloud = await signedIn({ "/rest/v1/saves": () => ({ status: 500, json: { message: "servidor cansado" } }) });
    const pushed = await cloud.push({ saveVersion: 6 });
    expect(pushed.ok).toBe(false);
    expect(cloud.sync.error).toBe("servidor cansado");
    expect(cloud.sync.pending, "o empurrão terminou, mesmo tendo falhado").toBe(false);
  });

  it("sair limpa a sessão guardada", async () => {
    const storage = memoryStorage();
    server({
      "/rest/v1/rpc/email_for_credentials": () => ({ json: "ana@exemplo.com" }),
      "/auth/v1/token": () => ({ json: SESSION }),
      "/rest/v1/profiles": () => ({ json: [{ username: "Ana" }] }),
      "/auth/v1/logout": () => ({ json: {} }),
    });
    const cloud = new CloudAccount(CONFIG, storage);
    await cloud.signIn("Ana", "senha-boa");
    expect(storage.data.has(CLOUD_SESSION_KEY)).toBe(true);
    await cloud.signOut();
    expect(storage.data.has(CLOUD_SESSION_KEY)).toBe(false);
    expect(cloud.profile).toBeNull();
  });
});
