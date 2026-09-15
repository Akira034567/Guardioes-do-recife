import { SAVE_KEY, type SaveStorage } from "../save/SaveManager";
import { hashPassword, isPasswordRecord, verifyPassword, type PasswordRecord } from "./passwords";

/**
 * Contas do jogador.
 *
 * O jogo é uma página estática: não existe servidor para guardar conta nenhuma. Então a conta vive
 * NESTE aparelho e serve para duas coisas que o jogador pediu:
 *
 * 1. separar saves — cada conta tem o seu próprio documento de progresso, e dois irmãos podem jogar
 *    no mesmo computador sem passar por cima um do outro;
 * 2. levar o progresso para outro lugar — `exportCode()` empacota a conta e o save num código, e
 *    `importCode()` abre esse código no outro aparelho.
 *
 * O save de cada conta fica numa chave própria (`guardioes-do-recife.save:<id>`); quem joga sem
 * entrar continua no save do aparelho (`guardioes-do-recife.save`), como sempre foi. Trocar de conta
 * é, portanto, só trocar a chave que o `SaveManager` abre.
 *
 * Duas contas NUNCA podem ter o mesmo nome: a comparação ignora maiúsculas e acentos, senão "Ana" e
 * "ana" pareceriam nomes diferentes na hora de entrar.
 */

export const ACCOUNTS_KEY = "guardioes-do-recife.accounts";
export const ACCOUNTS_VERSION = 1;
/** Prefixo do save de cada conta; o save sem prefixo continua sendo o do aparelho (convidado). */
export const ACCOUNT_SAVE_PREFIX = `${SAVE_KEY}:`;
export const CODE_PREFIX = "GR1.";

export const ACCOUNT_NAME_MIN = 3;
export const ACCOUNT_NAME_MAX = 16;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 64;

/** Letras (com acento), números, espaço, hífen e sublinhado. Nada de símbolo solto nem emoji. */
const NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

export interface AccountRecord {
  id: string;
  /** Como o jogador escreveu. */
  name: string;
  /** Nome normalizado; é ELE que garante "não existem dois usuários com o mesmo nome". */
  nameKey: string;
  createdAt: string;
  lastLoginAt: string | null;
  password: PasswordRecord;
}

export interface AccountDirectory {
  version: number;
  accounts: AccountRecord[];
  activeId: string | null;
}

export type AccountErrorReason =
  | "name-invalid"
  | "name-taken"
  | "password-invalid"
  | "password-mismatch"
  | "not-found"
  | "wrong-password"
  | "no-account"
  | "code-invalid";

export interface AccountSuccess {
  ok: true;
  account: AccountRecord;
  /** Progresso do aparelho copiado para a conta nova. */
  carried?: boolean;
  /** O código trazido substituiu o save de uma conta que já existia aqui. */
  replaced?: boolean;
}

export interface AccountFailure {
  ok: false;
  reason: AccountErrorReason;
  /** Mensagem pronta para a tela, em português. */
  message: string;
}

export type AccountResult = AccountSuccess | AccountFailure;

export interface AccountStoreOptions {
  now?: () => Date;
  key?: string;
  /** Gerador de id; os testes injetam um contador para ter saves previsíveis. */
  id?: () => string;
}

/** Nome comparável: sem espaços nas pontas, sem acento, sem caixa e sem espaço duplicado. */
export function normalizeAccountName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** `null` quando o nome serve; a mensagem do problema quando não serve. */
export function validateAccountName(name: string): string | null {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < ACCOUNT_NAME_MIN) return `O nome precisa de pelo menos ${ACCOUNT_NAME_MIN} letras.`;
  if (trimmed.length > ACCOUNT_NAME_MAX) return `O nome pode ter no máximo ${ACCOUNT_NAME_MAX} letras.`;
  if (!NAME_SHAPE.test(trimmed)) return "Use letras, números, espaço, hífen ou _ — e comece com letra ou número.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

function fail(reason: AccountErrorReason, message: string): AccountFailure {
  return { ok: false, reason, message };
}

export class AccountStore {
  private directory: AccountDirectory;
  private readonly key: string;
  private readonly now: () => Date;
  private readonly nextId: () => string;
  private readonly listeners = new Set<(store: AccountStore) => void>();

  constructor(
    private readonly storage: SaveStorage | null,
    options: AccountStoreOptions = {},
  ) {
    this.key = options.key ?? ACCOUNTS_KEY;
    this.now = options.now ?? (() => new Date());
    let counter = 0;
    this.nextId = options.id ?? (() => `acc-${Date.now().toString(36)}-${(counter += 1)}`);
    this.directory = this.load();
  }

  /** As contas deste aparelho, em ordem alfabética. */
  list(): readonly AccountRecord[] {
    return [...this.directory.accounts].sort((left, right) => left.nameKey.localeCompare(right.nameKey, "pt-BR"));
  }

  /** A conta em uso agora, ou `null` quando se está jogando como convidado. */
  get active(): AccountRecord | null {
    return this.directory.accounts.find((account) => account.id === this.directory.activeId) ?? null;
  }

  /** A chave de save de uma conta; `null` = o save do aparelho, de quem joga sem entrar. */
  saveKey(accountId: string | null): string {
    return accountId === null ? SAVE_KEY : `${ACCOUNT_SAVE_PREFIX}${accountId}`;
  }

  activeSaveKey(): string {
    return this.saveKey(this.directory.activeId);
  }

  find(name: string): AccountRecord | null {
    const nameKey = normalizeAccountName(name);
    return this.directory.accounts.find((account) => account.nameKey === nameKey) ?? null;
  }

  onChange(listener: (store: AccountStore) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------------ entrar e sair

  /**
   * Cria a conta e entra nela. `carryDeviceProgress` copia o save do aparelho para a conta nova — é
   * o caminho de quem já jogou como convidado e só agora resolveu se registrar. A cópia não apaga o
   * save do aparelho: o convidado continua onde estava.
   */
  async signUp(input: { name: string; password: string; confirmPassword?: string; carryDeviceProgress?: boolean }): Promise<AccountResult> {
    const nameProblem = validateAccountName(input.name);
    if (nameProblem) return fail("name-invalid", nameProblem);
    const passwordProblem = validatePassword(input.password);
    if (passwordProblem) return fail("password-invalid", passwordProblem);
    if (input.confirmPassword !== undefined && input.confirmPassword !== input.password) {
      return fail("password-mismatch", "As duas senhas precisam ser iguais.");
    }
    const name = input.name.trim().replace(/\s+/g, " ");
    if (this.find(name)) return fail("name-taken", `Já existe uma conta chamada “${name}” neste aparelho. Escolha outro nome.`);

    const stamp = this.now().toISOString();
    const account: AccountRecord = {
      id: this.nextId(),
      name,
      nameKey: normalizeAccountName(name),
      createdAt: stamp,
      lastLoginAt: stamp,
      password: await hashPassword(input.password),
    };
    const carried = input.carryDeviceProgress === true && this.copySave(SAVE_KEY, this.saveKey(account.id), account.id);
    this.directory.accounts.push(account);
    this.directory.activeId = account.id;
    this.commit();
    return { ok: true, account, carried };
  }

  async signIn(name: string, password: string): Promise<AccountResult> {
    const account = this.find(name);
    if (!account) return fail("not-found", "Não achei essa conta neste aparelho. Confira o nome ou traga o código do Recife.");
    if (!(await verifyPassword(password, account.password))) return fail("wrong-password", "Senha incorreta.");
    account.lastLoginAt = this.now().toISOString();
    this.directory.activeId = account.id;
    this.commit();
    return { ok: true, account };
  }

  /** Volta para o save do aparelho (modo convidado). O save da conta continua guardado. */
  signOut(): void {
    if (this.directory.activeId === null) return;
    this.directory.activeId = null;
    this.commit();
  }

  async changePassword(currentPassword: string, nextPassword: string, confirmPassword?: string): Promise<AccountResult> {
    const account = this.active;
    if (!account) return fail("no-account", "Entre numa conta para trocar a senha.");
    if (!(await verifyPassword(currentPassword, account.password))) return fail("wrong-password", "A senha atual não confere.");
    const problem = validatePassword(nextPassword);
    if (problem) return fail("password-invalid", problem);
    if (confirmPassword !== undefined && confirmPassword !== nextPassword) return fail("password-mismatch", "As duas senhas precisam ser iguais.");
    account.password = await hashPassword(nextPassword);
    this.commit();
    return { ok: true, account };
  }

  /** Apaga a conta E o save dela. Pede a senha justamente porque não dá para desfazer. */
  async deleteAccount(name: string, password: string): Promise<AccountResult> {
    const account = this.find(name);
    if (!account) return fail("not-found", "Não achei essa conta neste aparelho.");
    if (!(await verifyPassword(password, account.password))) return fail("wrong-password", "Senha incorreta.");
    this.directory.accounts = this.directory.accounts.filter((candidate) => candidate.id !== account.id);
    if (this.directory.activeId === account.id) this.directory.activeId = null;
    this.remove(this.saveKey(account.id));
    this.commit();
    return { ok: true, account };
  }

  // ------------------------------------------------------------- levar para outro lugar

  /**
   * O "código do Recife": a conta e o save dela num texto só, para colar em outro aparelho. Vai a
   * derivação da senha junto, e não a senha — quem recebe o código continua precisando dela para
   * abrir a conta do outro lado.
   */
  exportCode(accountId: string | null = this.directory.activeId): string | null {
    const account = this.directory.accounts.find((candidate) => candidate.id === accountId);
    if (!account) return null;
    const payload = {
      v: ACCOUNTS_VERSION,
      exportedAt: this.now().toISOString(),
      account: { name: account.name, createdAt: account.createdAt, password: account.password },
      save: this.read(this.saveKey(account.id)),
    };
    return `${CODE_PREFIX}${encodeBase64(JSON.stringify(payload))}`;
  }

  /**
   * Abre um código vindo de outro aparelho. A senha é conferida contra o próprio código; quando a
   * conta JÁ existe aqui, ela é conferida também contra a cópia local — senão um código qualquer
   * passaria por cima do progresso de quem está neste aparelho.
   */
  async importCode(code: string, password: string): Promise<AccountResult> {
    const payload = decodeCode(code);
    if (!payload) return fail("code-invalid", "Esse código não parece um código do Recife. Copie o texto inteiro e tente de novo.");
    if (!(await verifyPassword(password, payload.password))) return fail("wrong-password", "A senha não abre esse código.");

    const existing = this.find(payload.name);
    if (existing) {
      if (!(await verifyPassword(password, existing.password))) {
        return fail("name-taken", `Já existe uma conta chamada “${existing.name}” neste aparelho, com outra senha. Renomeie ou apague a conta daqui antes de trazer o código.`);
      }
      existing.password = payload.password;
      existing.lastLoginAt = this.now().toISOString();
      if (payload.save !== null) this.write(this.saveKey(existing.id), stampProfile(payload.save, existing.id));
      this.directory.activeId = existing.id;
      this.commit();
      return { ok: true, account: existing, replaced: true };
    }

    const account: AccountRecord = {
      id: this.nextId(),
      name: payload.name,
      nameKey: normalizeAccountName(payload.name),
      createdAt: payload.createdAt,
      lastLoginAt: this.now().toISOString(),
      password: payload.password,
    };
    if (payload.save !== null) this.write(this.saveKey(account.id), stampProfile(payload.save, account.id));
    this.directory.accounts.push(account);
    this.directory.activeId = account.id;
    this.commit();
    return { ok: true, account };
  }

  // ----------------------------------------------------------------------- interno

  private load(): AccountDirectory {
    const empty: AccountDirectory = { version: ACCOUNTS_VERSION, accounts: [], activeId: null };
    const raw = this.read(this.key);
    if (raw === null) return empty;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return empty;
    }
    if (typeof parsed !== "object" || parsed === null) return empty;
    const source = parsed as Record<string, unknown>;
    const seen = new Set<string>();
    const accounts: AccountRecord[] = [];
    if (Array.isArray(source.accounts)) {
      for (const entry of source.accounts) {
        const account = sanitizeAccount(entry);
        // O arquivo pode ter sido editado à mão: nome repetido some, e o primeiro registro fica.
        if (!account || seen.has(account.nameKey)) continue;
        seen.add(account.nameKey);
        accounts.push(account);
      }
    }
    const activeId = typeof source.activeId === "string" && accounts.some((account) => account.id === source.activeId) ? source.activeId : null;
    return { version: ACCOUNTS_VERSION, accounts, activeId };
  }

  private commit(): void {
    this.write(this.key, JSON.stringify(this.directory));
    this.listeners.forEach((listener) => listener(this));
  }

  private read(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      // Sem espaço ou sem armazenamento (aba anônima): a conta vale só enquanto a página estiver aberta.
    }
  }

  private remove(key: string): void {
    try {
      this.storage?.removeItem?.(key);
    } catch {
      // idem
    }
  }

  /** Copia um save de uma chave para outra, carimbando o `profileId` da conta que o recebeu. */
  private copySave(from: string, to: string, profileId: string): boolean {
    const raw = this.read(from);
    if (raw === null) return false;
    this.write(to, stampProfile(raw, profileId));
    return true;
  }
}

/**
 * O `profileId` do save vira o id da conta. Ele semeia a vida do Recife (`core/reef/ReefLife`), então
 * uma cópia com o id antigo faria dois perfis nadarem exatamente igual.
 */
function stampProfile(rawSave: string, profileId: string): string {
  try {
    const parsed: unknown = JSON.parse(rawSave);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return rawSave;
    return JSON.stringify({ ...(parsed as Record<string, unknown>), profileId });
  } catch {
    return rawSave;
  }
}

function sanitizeAccount(value: unknown): AccountRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as Record<string, unknown>;
  if (typeof entry.id !== "string" || typeof entry.name !== "string" || !isPasswordRecord(entry.password)) return null;
  if (validateAccountName(entry.name) !== null) return null;
  return {
    id: entry.id,
    name: entry.name,
    nameKey: typeof entry.nameKey === "string" && entry.nameKey.length > 0 ? entry.nameKey : normalizeAccountName(entry.name),
    createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date(0).toISOString(),
    lastLoginAt: typeof entry.lastLoginAt === "string" ? entry.lastLoginAt : null,
    password: entry.password,
  };
}

interface CodePayload {
  name: string;
  createdAt: string;
  password: PasswordRecord;
  save: string | null;
}

function decodeCode(code: string): CodePayload | null {
  // Colar de um chat costuma trazer espaços e quebras de linha no meio; elas não fazem parte do código.
  const cleaned = code.trim().replace(/\s+/g, "");
  if (!cleaned.startsWith(CODE_PREFIX)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64(cleaned.slice(CODE_PREFIX.length)));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const payload = parsed as Record<string, unknown>;
  const account = typeof payload.account === "object" && payload.account !== null ? (payload.account as Record<string, unknown>) : null;
  if (!account || typeof account.name !== "string" || !isPasswordRecord(account.password)) return null;
  if (validateAccountName(account.name) !== null) return null;
  return {
    name: account.name.trim().replace(/\s+/g, " "),
    createdAt: typeof account.createdAt === "string" ? account.createdAt : new Date(0).toISOString(),
    password: account.password,
    save: typeof payload.save === "string" ? payload.save : null,
  };
}

/** Base64 que aguenta acento: o texto vira bytes UTF-8 antes de `btoa`. */
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  // Em blocos, porque `String.fromCharCode(...bytes)` estoura a pilha com um save grande.
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

export function decodeBase64(text: string): string {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}
