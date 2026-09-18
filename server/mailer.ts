import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import nodemailer from "nodemailer";

/**
 * O envio de e-mail.
 *
 * Em produção é SMTP de verdade (Gmail com senha de app, Resend, Mailtrap, o que for) — basta as
 * variáveis de ambiente. Sem elas, o servidor NÃO finge que mandou: grava a mensagem em
 * `data/mail/*.eml` e imprime o link no terminal. É o que deixa confirmar conta e recuperar senha
 * funcionarem de ponta a ponta antes de existir provedor, e é o que os testes usam (em memória).
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  /** Como as mensagens estão saindo; a API conta isso ao cliente para a tela avisar o jogador. */
  readonly kind: "smtp" | "file" | "memory";
  send(message: MailMessage): Promise<void>;
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? "Guardiões do Recife <nao-responda@guardioes-do-recife.local>";
}

/** Guarda as mensagens numa lista, sem tocar em disco nem na rede. Para os testes. */
export function memoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    kind: "memory",
    sent,
    async send(message) {
      sent.push(message);
    },
  };
}

/** Escreve a mensagem em `data/mail/` e mostra o link no terminal. */
export function fileMailer(directory = process.env.GR_MAIL_DIR ?? "data/mail"): Mailer {
  return {
    kind: "file",
    async send(message) {
      mkdirSync(directory, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const safeTo = message.to.replace(/[^a-z0-9@._-]/gi, "_");
      const file = join(directory, `${stamp}-${safeTo}.eml`);
      const raw = [
        `From: ${mailFrom()}`,
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        message.text,
      ].join("\n");
      writeFileSync(file, raw, "utf8");
      const link = message.text.match(/https?:\/\/\S+/)?.[0];
      console.log(`[mail] para ${message.to}: ${message.subject}`);
      console.log(`[mail] gravado em ${file}`);
      if (link) console.log(`[mail] link: ${link}`);
    },
  };
}

export function smtpMailer(): Mailer {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT ?? "587", 10),
    // 465 é TLS direto; 587 começa em claro e sobe para TLS com STARTTLS.
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return {
    kind: "smtp",
    async send(message) {
      await transport.sendMail({ from: mailFrom(), to: message.to, subject: message.subject, text: message.text, html: message.html });
    },
  };
}

/** SMTP quando houver `SMTP_HOST`; senão, arquivo. */
export function createMailer(): Mailer {
  return process.env.SMTP_HOST ? smtpMailer() : fileMailer();
}
