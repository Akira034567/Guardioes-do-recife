import type { MailMessage } from "./mailer.ts";

/**
 * O texto das duas mensagens que o jogo manda. Português claro, um link só, e nada de anexo ou
 * imagem: e-mail de conta tem que passar por qualquer filtro e ser lido em qualquer aparelho.
 */

const SIGN_OFF = "Se não foi você quem pediu, pode ignorar esta mensagem.";

function layout(title: string, line: string, buttonLabel: string, link: string, note: string): string {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#052f49;font-family:Arial,Helvetica,sans-serif;color:#e9fbff">
  <div style="max-width:520px;margin:0 auto;background:#0a3c53;border:1px solid #1581a3;border-radius:16px;padding:28px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#ffe69a">GUARDIÕES DO RECIFE</h1>
    <h2 style="margin:0 0 16px;font-size:16px;color:#75dff4">${title}</h2>
    <p style="margin:0 0 20px;line-height:1.5">${line}</p>
    <p style="margin:0 0 20px">
      <a href="${link}" style="display:inline-block;background:#1581a3;color:#f2fbff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold">${buttonLabel}</a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:#bfe6f6">Se o botão não funcionar, copie este endereço:<br><span style="word-break:break-all">${link}</span></p>
    <p style="margin:16px 0 0;font-size:12px;color:#bfe6f6">${note}<br>${SIGN_OFF}</p>
  </div>
</body></html>`;
}

export function verificationEmail(name: string, link: string, hours: number): MailMessage {
  const line = `Oi, ${name}! Falta um passo para o Recife ser seu: confirme este e-mail.`;
  return {
    to: "",
    subject: "Confirme sua conta — Guardiões do Recife",
    text: `${line}\n\nAbra este endereço para confirmar:\n${link}\n\nO link vale por ${hours} horas.\n${SIGN_OFF}`,
    html: layout("Confirme sua conta", line, "CONFIRMAR CONTA", link, `O link vale por ${hours} horas.`),
  };
}

export function passwordResetEmail(name: string, link: string, hours: number): MailMessage {
  const line = `Oi, ${name}! Recebemos um pedido para trocar a senha da sua conta.`;
  return {
    to: "",
    subject: "Trocar a senha — Guardiões do Recife",
    text: `${line}\n\nAbra este endereço para escolher uma senha nova:\n${link}\n\nO link vale por ${hours} horas e só pode ser usado uma vez.\n${SIGN_OFF}`,
    html: layout("Trocar a senha", line, "ESCOLHER SENHA NOVA", link, `O link vale por ${hours} horas e só pode ser usado uma vez.`),
  };
}
