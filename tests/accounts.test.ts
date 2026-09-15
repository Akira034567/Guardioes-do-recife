import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SAVE_PREFIX,
  AccountStore,
  normalizeAccountName,
  validateAccountName,
  validatePassword,
} from "../src/game/core/account/AccountStore";
import { hashPassword, verifyPassword } from "../src/game/core/account/passwords";
import { SAVE_KEY, type SaveStorage } from "../src/game/core/save/SaveManager";

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

/** Ids previsíveis deixam as chaves de save legíveis nas asserções. */
function store(storage: SaveStorage | null, startAt = "2026-09-15T10:00:00Z"): AccountStore {
  let counter = 0;
  return new AccountStore(storage, { now: () => new Date(startAt), id: () => `acc-${(counter += 1)}` });
}

const deviceSave = JSON.stringify({ saveVersion: 5, profileId: "local", currency: { shells: 42, lifetimeShells: 42 } });

describe("nome e senha de conta", () => {
  it("compara nomes ignorando caixa, acento e espaço sobrando", () => {
    expect(normalizeAccountName("  Ana   Maria ")).toBe("ana maria");
    expect(normalizeAccountName("JOÃO")).toBe(normalizeAccountName("joao"));
  });

  it("recusa nome curto, nome longo e símbolo solto", () => {
    expect(validateAccountName("jo")).not.toBeNull();
    expect(validateAccountName("a".repeat(17))).not.toBeNull();
    expect(validateAccountName("ana@recife")).not.toBeNull();
    expect(validateAccountName("Ana Maria")).toBeNull();
    expect(validateAccountName("guardia-01")).toBeNull();
  });

  it("recusa senha curta", () => {
    expect(validatePassword("123")).not.toBeNull();
    expect(validatePassword("coral123")).toBeNull();
  });

  it("guarda a derivação da senha, nunca a senha", async () => {
    const record = await hashPassword("coral123");
    expect(record.hash).not.toContain("coral123");
    expect(await verifyPassword("coral123", record)).toBe(true);
    expect(await verifyPassword("coral124", record)).toBe(false);
  });

  it("dá um sal diferente para cada conta", async () => {
    const first = await hashPassword("coral123");
    const second = await hashPassword("coral123");
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });
});

describe("AccountStore", () => {
  it("cria a conta, entra nela e aponta para um save próprio", async () => {
    const storage = memoryStorage();
    const accounts = store(storage);
    expect(accounts.activeSaveKey()).toBe(SAVE_KEY);

    const result = await accounts.signUp({ name: "Ana", password: "coral123" });
    expect(result.ok).toBe(true);
    expect(accounts.active?.name).toBe("Ana");
    expect(accounts.activeSaveKey()).toBe(`${ACCOUNT_SAVE_PREFIX}acc-1`);
  });

  it("não deixa dois jogadores usarem o mesmo nome, nem trocando a caixa", async () => {
    const accounts = store(memoryStorage());
    await accounts.signUp({ name: "Ana", password: "coral123" });
    const again = await accounts.signUp({ name: "  aNa ", password: "outra123" });
    expect(again).toMatchObject({ ok: false, reason: "name-taken" });
    expect(accounts.list()).toHaveLength(1);
  });

  it("exige as duas senhas iguais e uma senha de tamanho mínimo", async () => {
    const accounts = store(memoryStorage());
    expect(await accounts.signUp({ name: "Ana", password: "coral123", confirmPassword: "coral124" })).toMatchObject({
      ok: false,
      reason: "password-mismatch",
    });
    expect(await accounts.signUp({ name: "Ana", password: "12" })).toMatchObject({ ok: false, reason: "password-invalid" });
    expect(accounts.list()).toHaveLength(0);
  });

  it("leva o progresso do aparelho para a conta nova quando o jogador pede", async () => {
    const storage = memoryStorage({ [SAVE_KEY]: deviceSave });
    const accounts = store(storage);
    const result = await accounts.signUp({ name: "Ana", password: "coral123", carryDeviceProgress: true });

    expect(result).toMatchObject({ ok: true, carried: true });
    const carried = JSON.parse(storage.data[`${ACCOUNT_SAVE_PREFIX}acc-1`]);
    expect(carried.currency.shells).toBe(42);
    // O `profileId` acompanha a conta: ele semeia a vida do Recife.
    expect(carried.profileId).toBe("acc-1");
    // E o save do aparelho continua lá, para quem seguir jogando como convidado.
    expect(storage.data[SAVE_KEY]).toBe(deviceSave);
  });

  it("começa a conta vazia quando o jogador não quer trazer nada", async () => {
    const storage = memoryStorage({ [SAVE_KEY]: deviceSave });
    const accounts = store(storage);
    expect(await accounts.signUp({ name: "Ana", password: "coral123" })).toMatchObject({ ok: true, carried: false });
    expect(storage.data[`${ACCOUNT_SAVE_PREFIX}acc-1`]).toBeUndefined();
  });

  it("entra com a senha certa e recusa a errada", async () => {
    const accounts = store(memoryStorage());
    await accounts.signUp({ name: "Ana", password: "coral123" });
    accounts.signOut();
    expect(accounts.active).toBeNull();

    expect(await accounts.signIn("ana", "errada")).toMatchObject({ ok: false, reason: "wrong-password" });
    expect(accounts.active).toBeNull();
    expect(await accounts.signIn("ana", "coral123")).toMatchObject({ ok: true });
    expect(accounts.active?.name).toBe("Ana");
  });

  it("avisa quando a conta não existe neste aparelho", async () => {
    const accounts = store(memoryStorage());
    expect(await accounts.signIn("ninguem", "coral123")).toMatchObject({ ok: false, reason: "not-found" });
  });

  it("mantém um save por conta: dois jogadores no mesmo aparelho não se atropelam", async () => {
    const accounts = store(memoryStorage());
    await accounts.signUp({ name: "Ana", password: "coral123" });
    const anaKey = accounts.activeSaveKey();
    await accounts.signOut();
    await accounts.signUp({ name: "Beto", password: "coral456" });
    expect(accounts.activeSaveKey()).not.toBe(anaKey);
    await accounts.signIn("Ana", "coral123");
    expect(accounts.activeSaveKey()).toBe(anaKey);
  });

  it("lembra a conta ativa depois de recarregar a página", async () => {
    const storage = memoryStorage();
    const first = store(storage);
    await first.signUp({ name: "Ana", password: "coral123" });

    const reloaded = store(storage);
    expect(reloaded.active?.name).toBe("Ana");
    expect(reloaded.activeSaveKey()).toBe(`${ACCOUNT_SAVE_PREFIX}acc-1`);
  });

  it("troca a senha só com a senha atual na mão", async () => {
    const accounts = store(memoryStorage());
    await accounts.signUp({ name: "Ana", password: "coral123" });

    expect(await accounts.changePassword("errada", "novaSenha")).toMatchObject({ ok: false, reason: "wrong-password" });
    expect(await accounts.changePassword("coral123", "nova")).toMatchObject({ ok: true });
    accounts.signOut();
    expect(await accounts.signIn("Ana", "coral123")).toMatchObject({ ok: false, reason: "wrong-password" });
    expect(await accounts.signIn("Ana", "nova")).toMatchObject({ ok: true });
  });

  it("apaga a conta e o save dela, e volta para o modo convidado", async () => {
    const storage = memoryStorage({ [SAVE_KEY]: deviceSave });
    const accounts = store(storage);
    await accounts.signUp({ name: "Ana", password: "coral123", carryDeviceProgress: true });

    expect(await accounts.deleteAccount("Ana", "errada")).toMatchObject({ ok: false, reason: "wrong-password" });
    expect(await accounts.deleteAccount("Ana", "coral123")).toMatchObject({ ok: true });
    expect(accounts.list()).toHaveLength(0);
    expect(accounts.active).toBeNull();
    expect(storage.data[`${ACCOUNT_SAVE_PREFIX}acc-1`]).toBeUndefined();
    expect(storage.data[SAVE_KEY]).toBe(deviceSave);
  });

  it("ignora registro corrompido e nome repetido no arquivo de contas", async () => {
    const accounts = store(memoryStorage({ "guardioes-do-recife.accounts": "{{{" }));
    expect(accounts.list()).toHaveLength(0);
    expect(await accounts.signUp({ name: "Ana", password: "coral123" })).toMatchObject({ ok: true });
  });

  it("funciona sem armazenamento nenhum (aba anônima), só sem lembrar depois", async () => {
    const accounts = store(null);
    expect(await accounts.signUp({ name: "Ana", password: "coral123" })).toMatchObject({ ok: true });
    expect(accounts.active?.name).toBe("Ana");
  });
});

describe("código do Recife (jogar em outro aparelho)", () => {
  async function exported(): Promise<{ code: string; save: string }> {
    const storage = memoryStorage({ [SAVE_KEY]: deviceSave });
    const accounts = store(storage);
    await accounts.signUp({ name: "Ana", password: "coral123", carryDeviceProgress: true });
    const code = accounts.exportCode();
    expect(code).not.toBeNull();
    return { code: code as string, save: storage.data[`${ACCOUNT_SAVE_PREFIX}acc-1`] };
  }

  it("leva conta e progresso para um aparelho que nunca viu essa conta", async () => {
    const { code } = await exported();
    const otherStorage = memoryStorage();
    const other = store(otherStorage);

    const result = await other.importCode(code, "coral123");
    expect(result).toMatchObject({ ok: true });
    expect(other.active?.name).toBe("Ana");
    expect(JSON.parse(otherStorage.data[other.activeSaveKey()]).currency.shells).toBe(42);
    // E dali em diante a conta entra normalmente neste aparelho.
    other.signOut();
    expect(await other.signIn("Ana", "coral123")).toMatchObject({ ok: true });
  });

  it("aceita o código colado com quebras de linha no meio", async () => {
    const { code } = await exported();
    const other = store(memoryStorage());
    const quebrado = `${code.slice(0, 40)}\n  ${code.slice(40)}\n`;
    expect(await other.importCode(quebrado, "coral123")).toMatchObject({ ok: true });
  });

  it("recusa o código com a senha errada e o texto que não é um código", async () => {
    const { code } = await exported();
    const other = store(memoryStorage());
    expect(await other.importCode(code, "errada")).toMatchObject({ ok: false, reason: "wrong-password" });
    expect(await other.importCode("um texto qualquer", "coral123")).toMatchObject({ ok: false, reason: "code-invalid" });
    expect(other.list()).toHaveLength(0);
  });

  it("atualiza a conta que já existe aqui quando a senha é a mesma", async () => {
    const { code } = await exported();
    const otherStorage = memoryStorage();
    const other = store(otherStorage);
    await other.signUp({ name: "Ana", password: "coral123" });
    const key = other.activeSaveKey();
    otherStorage.data[key] = JSON.stringify({ saveVersion: 5, profileId: "acc-1", currency: { shells: 1, lifetimeShells: 1 } });

    expect(await other.importCode(code, "coral123")).toMatchObject({ ok: true, replaced: true });
    expect(JSON.parse(otherStorage.data[key]).currency.shells).toBe(42);
    expect(other.list()).toHaveLength(1);
  });

  it("não deixa um código passar por cima de uma conta homônima com outra senha", async () => {
    const { code } = await exported();
    const otherStorage = memoryStorage();
    const other = store(otherStorage);
    await other.signUp({ name: "Ana", password: "outraSenha" });
    const key = other.activeSaveKey();
    otherStorage.data[key] = JSON.stringify({ saveVersion: 5, profileId: "acc-1", currency: { shells: 1, lifetimeShells: 1 } });

    // O nome é o mesmo, a senha não: o código para na porta e o progresso daqui fica intacto.
    expect(await other.importCode(code, "coral123")).toMatchObject({ ok: false, reason: "name-taken" });
    expect(JSON.parse(otherStorage.data[key]).currency.shells).toBe(1);
  });

  it("não expõe a senha no código", async () => {
    const { code } = await exported();
    expect(code).not.toContain("coral123");
    expect(atob(code.slice("GR1.".length))).not.toContain("coral123");
  });
});
