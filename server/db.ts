import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * O banco. SQLite em arquivo, pelo módulo `node:sqlite` que já vem no Node — nenhuma dependência
 * nova, e o banco inteiro é um arquivo que dá para copiar, versionar num backup ou abrir com
 * qualquer ferramenta de SQLite.
 *
 * A unicidade de e-mail e de nome é do BANCO (índice `UNIQUE`), não do código. Essa é a diferença
 * que importa: duas pessoas se cadastrando no mesmo instante não passam as duas, porque quem decide
 * é o índice, dentro da transação — e não um `SELECT` antes do `INSERT`, que sempre tem uma fresta
 * entre a consulta e a gravação.
 */

export const SCHEMA_VERSION = 1;

export interface UserRow {
  id: number;
  email: string;
  email_key: string;
  name: string;
  name_key: string;
  password: string;
  verified_at: string | null;
  created_at: string;
  last_login_at: string | null;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL,
  email_key     TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  name_key      TEXT    NOT NULL UNIQUE,
  password      TEXT    NOT NULL,
  verified_at   TEXT,
  created_at    TEXT    NOT NULL,
  last_login_at TEXT
);

-- Sessão: o token que o jogo guarda depois de entrar. Cai junto com o usuário (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions (user_id);

-- Links enviados por e-mail: confirmar a conta e trocar a senha esquecida. Uso único e com prazo.
CREATE TABLE IF NOT EXISTS email_tokens (
  token      TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose    TEXT    NOT NULL CHECK (purpose IN ('verify', 'reset')),
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL,
  used_at    TEXT
);
CREATE INDEX IF NOT EXISTS email_tokens_by_user ON email_tokens (user_id, purpose);

-- O progresso do jogador, um documento JSON por conta (o mesmo \`PlayerProgress\` do jogo).
CREATE TABLE IF NOT EXISTS saves (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  document   TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
`;

/** Caminho padrão do banco; `GR_DB` troca (os testes usam `:memory:`). */
export function defaultDatabasePath(): string {
  return process.env.GR_DB ?? "data/guardioes.sqlite";
}

/**
 * Abre (ou cria) o banco e garante o schema. `:memory:` serve aos testes: banco de verdade, com as
 * mesmas restrições, que morre no fim do processo.
 */
export function openDatabase(path = defaultDatabasePath()): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // WAL deixa leitura e escrita conviverem; sem `foreign_keys` o ON DELETE CASCADE seria decorativo.
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}
