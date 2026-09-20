#!/usr/bin/env node
/**
 * Confere a instalação da conta na nuvem.
 *
 * Existe porque "configurei certo?" é uma pergunta difícil de responder olhando o painel: o esquema
 * pode estar meio aplicado, a RLS pode estar desligada numa tabela, a RPC pode não ter recebido o
 * `grant`. Aqui cada peça é testada pelo mesmo caminho que o jogo usa — `fetch` na REST, com a
 * chave publicável — e o relatório diz qual peça faltou.
 *
 *   node scripts/verify-supabase.mjs
 *       Só o que dá para conferir sem conta: configuração, tabelas, RLS e as duas RPCs.
 *
 *   node scripts/verify-supabase.mjs --usuario NOME --senha SENHA
 *       O caminho completo: entrar pelo nome de usuário, gravar um progresso de teste, ler de volta
 *       e desfazer. Use uma conta de teste — ele ESCREVE no save dela.
 *
 *   node scripts/verify-supabase.mjs --reenviar EMAIL
 *       Reenvia a confirmação de uma conta que já existe. É o jeito de testar o SMTP SEM criar
 *       usuário nenhum — e é o conserto de quem ficou com a conta criada e o e-mail não enviado,
 *       que é o estado em que um SMTP quebrado deixa as pessoas.
 *
 *   node scripts/verify-supabase.mjs --cadastrar EMAIL --usuario NOME --senha SENHA
 *       Cria uma conta de verdade pelo mesmo caminho do jogo. Serve para responder à pergunta que
 *       nenhuma conferência de leitura responde: OUTRA pessoa consegue se cadastrar? Com o mailer
 *       embutido do Supabase, um endereço de fora da equipe do projeto é recusado; com SMTP próprio,
 *       passa. Use um e-mail que você controle — ele vai receber o link de confirmação.
 *
 * Lê `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` do ambiente ou do `.env.local`.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

// ---------------------------------------------------------------- configuração

/** Lê um `.env` simples: `CHAVE=valor` por linha, sem expansão nem aspas obrigatórias. */
function readEnvFile(name) {
  try {
    const text = readFileSync(resolve(ROOT, name), "utf8");
    const entries = {};
    for (const line of text.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      entries[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
    }
    return entries;
  } catch {
    return {};
  }
}

const fileEnv = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };
const pick = (key) => (process.env[key] ?? fileEnv[key] ?? "").trim();

const URL_BASE = pick("VITE_SUPABASE_URL").replace(/\/+$/, "");
const KEY = pick("VITE_SUPABASE_PUBLISHABLE_KEY") || pick("VITE_SUPABASE_ANON_KEY");

const args = process.argv.slice(2);
const argOf = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
};
const USER = argOf("--usuario");
const PASSWORD = argOf("--senha");
const SIGNUP_EMAIL = argOf("--cadastrar");
const RESEND_EMAIL = argOf("--reenviar");

// ---------------------------------------------------------------- relatório

const results = [];
const ok = (what, detail = "") => results.push({ level: "ok", what, detail });
const warn = (what, detail = "") => results.push({ level: "warn", what, detail });
const bad = (what, detail = "") => results.push({ level: "bad", what, detail });

const MARK = { ok: "  OK ", warn: "AVISO", bad: "FALHA" };

// ---------------------------------------------------------------- chamadas

async function call(path, init = {}) {
  const { token, ...rest } = init;
  const response = await fetch(`${URL_BASE}${path}`, {
    ...rest,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token ?? KEY}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return { status: response.status, ok: response.ok, body };
}

const messageOf = (body) => body?.message ?? body?.msg ?? body?.error_description ?? body?.error ?? body?.hint ?? JSON.stringify(body);

// ---------------------------------------------------------------- conferências

async function checkConfig() {
  if (!URL_BASE || !KEY) {
    bad("Configuração", "Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_PUBLISHABLE_KEY (ambiente ou .env.local).");
    return false;
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(URL_BASE)) {
    warn("Configuração", `A URL "${URL_BASE}" não tem a cara de uma URL de projeto Supabase — siga assim mesmo.`);
  }
  ok("Configuração", `${URL_BASE} · chave ${KEY.slice(0, 12)}…`);
  return true;
}

async function checkReachable() {
  try {
    const health = await call("/auth/v1/health");
    if (health.ok) ok("Servidor responde", "o Auth está de pé");
    else bad("Servidor responde", `o Auth respondeu ${health.status}: ${messageOf(health.body)}`);
    return health.ok;
  } catch (error) {
    bad("Servidor responde", `não consegui falar com ${URL_BASE} (${error.message})`);
    return false;
  }
}

async function checkRpcs() {
  const available = await call("/rest/v1/rpc/username_available", {
    method: "POST",
    body: JSON.stringify({ p_username: `verificador-${Date.now().toString(36)}` }),
  });
  if (available.ok && available.body === true) ok("RPC username_available", "responde e o nome de teste está livre");
  else if (available.status === 404) bad("RPC username_available", "não existe — o schema.sql não foi aplicado (ou foi só em parte).");
  else bad("RPC username_available", `respondeu ${available.status}: ${messageOf(available.body)}`);

  // Credenciais propositalmente erradas: o certo é responder `null`, e NUNCA dizer se o nome existe.
  const credentials = await call("/rest/v1/rpc/email_for_credentials", {
    method: "POST",
    body: JSON.stringify({ p_username: "ninguem-mesmo", p_password: "senha-errada" }),
  });
  if (credentials.ok && credentials.body === null) ok("RPC email_for_credentials", "responde, e nega sem entregar nada");
  else if (credentials.status === 404) bad("RPC email_for_credentials", "não existe — o schema.sql não foi aplicado (ou foi só em parte).");
  else if (credentials.ok) bad("RPC email_for_credentials", `devolveu algo para um usuário inexistente: ${JSON.stringify(credentials.body)}`);
  else if (String(messageOf(credentials.body)).includes("crypt")) {
    bad("RPC email_for_credentials", "a extensão pgcrypto não está acessível — rode o schema.sql inteiro, ele a cria.");
  } else bad("RPC email_for_credentials", `respondeu ${credentials.status}: ${messageOf(credentials.body)}`);
}

async function checkTablesAndRls() {
  for (const table of ["profiles", "saves"]) {
    const rows = await call(`/rest/v1/${table}?select=*&limit=1`);
    if (rows.status === 404 || String(messageOf(rows.body)).includes("does not exist")) {
      bad(`Tabela ${table}`, "não existe — o schema.sql não foi aplicado.");
      continue;
    }
    if (rows.ok && Array.isArray(rows.body) && rows.body.length === 0) {
      ok(`Tabela ${table}`, "existe, e sem entrar ninguém enxerga linha nenhuma (RLS de pé)");
    } else if (rows.ok && Array.isArray(rows.body)) {
      bad(`Tabela ${table}`, `entregou ${rows.body.length} linha(s) SEM autenticação — a RLS está desligada.`);
    } else if (rows.status === 401 || rows.status === 403) {
      ok(`Tabela ${table}`, "existe e recusa quem não entrou");
    } else {
      warn(`Tabela ${table}`, `respondeu ${rows.status}: ${messageOf(rows.body)}`);
    }
  }
}

async function checkSignupPolicy() {
  const settings = await call("/auth/v1/settings");
  if (!settings.ok) {
    warn("Confirmação de e-mail", `não consegui ler as configurações (${settings.status})`);
    return;
  }
  if (settings.body?.disable_signup === true) {
    bad("Cadastro", "está DESLIGADO no projeto: ninguém consegue criar conta pelo jogo.");
  } else {
    ok("Cadastro", "ligado");
  }
  // `mailer_autoconfirm: true` = o e-mail NÃO é verificado; aí o "esqueci a senha" perde a garantia.
  if (settings.body?.mailer_autoconfirm === true) {
    warn("Confirmação de e-mail", "está desligada: as contas entram sem provar o e-mail, e o reset de senha fica frágil.");
  } else {
    ok("Confirmação de e-mail", "ligada — é ela que garante que o e-mail do reset é real");
  }
}

/**
 * Reenvia a confirmação — e, de quebra, é o teste de SMTP mais barato que existe.
 *
 * Nenhuma conta é criada: o endpoint pega uma que já existe e manda o e-mail de novo. Se o SMTP
 * estiver quebrado, o erro aparece aqui igualzinho ao do cadastro. Se a conta não existir, o
 * Supabase responde 200 sem mandar nada (é assim que ele evita que alguém descubra quem tem conta),
 * então um "OK" aqui só prova o envio quando o e-mail realmente pertence a alguém.
 */
async function checkResend(email) {
  const response = await call("/auth/v1/resend", {
    method: "POST",
    body: JSON.stringify({ type: "signup", email }),
  });
  const message = String(messageOf(response.body) ?? "");
  if (response.ok) {
    ok("Reenviar confirmação", `o servidor aceitou mandar para ${email} — se a conta existir, o e-mail saiu`);
    return;
  }
  if (/not authorized/i.test(message)) {
    bad("Reenviar confirmação", "o mailer embutido só entrega para a equipe do projeto. Configure um SMTP próprio.");
  } else if (/rate limit|too many|after \d+ seconds/i.test(message)) {
    warn("Reenviar confirmação", `o limite de envio segurou a mensagem: ${message}. Espere e tente de novo.`);
  } else if (/sending|smtp|mail/i.test(message)) {
    bad(
      "Reenviar confirmação",
      `o SMTP recusou: ${message}. Confira host, porta, usuário e senha em Authentication → Emails → SMTP Settings ` +
        "(no Gmail, a senha é a SENHA DE APP de 16 letras, não a da conta).",
    );
  } else {
    bad("Reenviar confirmação", `${response.status}: ${message}`);
  }
}

/**
 * Cadastra de verdade, pelo mesmo caminho do jogo.
 *
 * É o único jeito de saber se OUTRA pessoa consegue criar conta: o mailer embutido do Supabase só
 * entrega para endereços da equipe do projeto e recusa o resto com "Email address not authorized" —
 * um erro que nenhuma conferência de leitura revela, porque ele só aparece na hora de mandar o
 * e-mail de confirmação.
 */
async function checkSignup(email, username, password) {
  const before = await call("/rest/v1/rpc/username_available", {
    method: "POST",
    body: JSON.stringify({ p_username: username }),
  });
  if (before.ok && before.body === false) {
    warn("Cadastrar", `o nome "${username}" já está em uso — escolha outro para este teste.`);
    return;
  }

  const signup = await call("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { username } }),
  });
  const message = String(messageOf(signup.body) ?? "");
  if (!signup.ok) {
    if (/not authorized/i.test(message)) {
      bad(
        "Cadastrar",
        `o servidor recusou "${email}": o mailer embutido do Supabase só entrega para a equipe do projeto. ` +
          "Configure um SMTP próprio (Authentication → Emails → SMTP Settings) para abrir o cadastro a qualquer pessoa.",
      );
    } else if (/rate limit|too many/i.test(message)) {
      bad("Cadastrar", "limite de envio estourado — o mailer embutido manda 2 por hora. Espere, ou configure SMTP próprio.");
    } else if (/sending confirmation|smtp/i.test(message)) {
      bad("Cadastrar", `o SMTP recusou a mensagem: ${message}. Confira remetente verificado, porta e chave no provedor.`);
    } else {
      bad("Cadastrar", `${signup.status}: ${message}`);
    }
    return;
  }

  ok("Cadastrar", `"${email}" foi aceito — o e-mail de confirmação saiu`);

  const after = await call("/rest/v1/rpc/username_available", {
    method: "POST",
    body: JSON.stringify({ p_username: username }),
  });
  if (after.ok && after.body === false) ok("Gatilho do perfil", `"${username}" já consta como usado — o perfil nasceu junto com a conta`);
  else bad("Gatilho do perfil", "o nome continua livre: o gatilho on_auth_user_created não criou o perfil.");

  if (signup.body?.access_token) {
    ok("Confirmação de e-mail", "veio sessão na hora — a confirmação está DESLIGADA no projeto");
  } else {
    warn("Confirmação de e-mail", `confirme o link que chegou em ${email} e rode de novo com --usuario/--senha para testar a sincronização.`);
  }
}

/** O caminho completo, com uma conta de verdade: entrar pelo nome, gravar, ler e desfazer. */
async function checkRoundTrip(username, password) {
  const email = await call("/rest/v1/rpc/email_for_credentials", {
    method: "POST",
    body: JSON.stringify({ p_username: username, p_password: password }),
  });
  if (!email.ok || typeof email.body !== "string") {
    bad("Entrar pelo nome de usuário", `não devolveu e-mail para "${username}" — usuário ou senha errados, ou o perfil não foi criado.`);
    return;
  }
  ok("Entrar pelo nome de usuário", `"${username}" → ${String(email.body).replace(/(.).*(@.*)/, "$1***$2")}`);

  const session = await call("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: email.body, password }),
  });
  if (!session.ok) {
    bad("Autenticar", `${session.status}: ${messageOf(session.body)}`);
    return;
  }
  const token = session.body.access_token;
  const userId = session.body.user?.id;
  ok("Autenticar", "sessão emitida");

  const profile = await call(`/rest/v1/profiles?id=eq.${userId}&select=username`, { token });
  if (profile.ok && profile.body?.[0]?.username) ok("Perfil", `o gatilho criou o perfil "${profile.body[0].username}"`);
  else bad("Perfil", "a linha em `profiles` não existe — o gatilho on_auth_user_created não rodou.");

  const before = await call(`/rest/v1/saves?user_id=eq.${userId}&select=document,updated_at`, { token });
  if (!before.ok) {
    bad("Ler o progresso", `${before.status}: ${messageOf(before.body)}`);
    return;
  }
  ok("Ler o progresso", before.body?.[0] ? "a linha do save existe" : "ainda não há save gravado (normal numa conta nova)");

  const probe = { saveVersion: 6, updatedAt: new Date().toISOString(), verificador: "scripts/verify-supabase.mjs" };
  const push = await call("/rest/v1/saves", {
    method: "POST",
    token,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, document: probe, save_version: 6 }),
  });
  if (!push.ok) {
    bad("Gravar o progresso", `${push.status}: ${messageOf(push.body)}`);
    return;
  }
  const after = await call(`/rest/v1/saves?user_id=eq.${userId}&select=document,revision`, { token });
  if (after.ok && after.body?.[0]?.document?.verificador) ok("Gravar o progresso", `gravou e leu de volta (revisão ${after.body[0].revision})`);
  else bad("Gravar o progresso", "gravou mas não li de volta o que escrevi");

  // Devolve o save ao que era, para o verificador não estragar o progresso da conta de teste.
  const original = before.body?.[0]?.document ?? {};
  await call("/rest/v1/saves", {
    method: "POST",
    token,
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: userId, document: original, save_version: original.saveVersion ?? 0 }),
  });
  ok("Desfazer", "o save da conta de teste voltou ao que era");

  await call("/auth/v1/logout", { method: "POST", token, body: "{}" });
}

// ---------------------------------------------------------------- execução

console.log("\nConferindo a conta na nuvem (Supabase)\n");

if (await checkConfig()) {
  if (await checkReachable()) {
    await checkSignupPolicy();
    await checkTablesAndRls();
    await checkRpcs();
    if (RESEND_EMAIL) await checkResend(RESEND_EMAIL);
    if (SIGNUP_EMAIL && USER && PASSWORD) await checkSignup(SIGNUP_EMAIL, USER, PASSWORD);
    else if (USER && PASSWORD) await checkRoundTrip(USER, PASSWORD);
    else if (!RESEND_EMAIL) console.log("  (sem --usuario/--senha: pulei o teste de entrar e gravar)\n");
  }
}

for (const line of results) console.log(`[${MARK[line.level]}] ${line.what}${line.detail ? ` — ${line.detail}` : ""}`);

const failures = results.filter((line) => line.level === "bad").length;
const warnings = results.filter((line) => line.level === "warn").length;
console.log(`\n${failures === 0 ? "Tudo certo" : `${failures} problema(s)`}${warnings > 0 ? `, ${warnings} aviso(s)` : ""}.\n`);
process.exit(failures === 0 ? 0 : 1);
