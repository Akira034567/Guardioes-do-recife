/**
 * As duas páginas que o jogador abre a partir do e-mail. São servidas pelo próprio servidor de
 * contas, em HTML puro: o link do e-mail precisa funcionar em qualquer navegador, mesmo que o jogo
 * não esteja aberto, e não pode depender de o Phaser ter carregado.
 */

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Guardiões do Recife</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         background:#052f49; color:#e9fbff; font-family:Arial, Helvetica, sans-serif; }
  .card { width:min(460px, 100%); background:#0a3c53; border:1px solid #1581a3; border-radius:16px; padding:28px; }
  h1 { margin:0 0 4px; font-size:19px; color:#ffe69a; letter-spacing:1px; }
  h2 { margin:0 0 16px; font-size:16px; color:#75dff4; }
  p { line-height:1.5; }
  label { display:block; margin:14px 0 4px; font-size:13px; color:#bfe6f6; }
  input { width:100%; box-sizing:border-box; padding:10px 12px; border-radius:9px;
          border:1px solid #1581a3; background:#031d2d; color:#f2fbff; font-size:15px; }
  button { margin-top:18px; width:100%; padding:12px; border:0; border-radius:10px;
           background:#1581a3; color:#f2fbff; font-size:15px; font-weight:bold; cursor:pointer; }
  button:hover { background:#1a9cc4; }
  .ok { color:#67f2ac; } .erro { color:#ff7d83; }
  .hint { font-size:12px; color:#bfe6f6; }
</style>
</head>
<body><div class="card"><h1>GUARDIÕES DO RECIFE</h1>${body}</div></body>
</html>`;
}

export function messagePage(title: string, message: string, tone: "ok" | "erro", gameUrl: string | null): string {
  return shell(
    title,
    `<h2 class="${tone}">${title}</h2><p>${message}</p>` +
      (gameUrl ? `<p><a href="${gameUrl}" style="color:#75dff4">Voltar para o jogo</a></p>` : ""),
  );
}

export function resetFormPage(token: string, error: string | null): string {
  return shell(
    "Escolher uma senha nova",
    `<h2>Escolher uma senha nova</h2>
     ${error ? `<p class="erro">${error}</p>` : "<p>Digite a senha que você vai usar daqui para a frente.</p>"}
     <form method="post" action="/api/password/reset">
       <input type="hidden" name="token" value="${token}">
       <label for="password">Senha nova</label>
       <input id="password" name="password" type="password" autocomplete="new-password" required minlength="8">
       <label for="confirm">Repita a senha</label>
       <input id="confirm" name="confirm" type="password" autocomplete="new-password" required minlength="8">
       <button type="submit">TROCAR A SENHA</button>
       <p class="hint">Ao trocar a senha, todos os aparelhos conectados a esta conta são desconectados.</p>
     </form>`,
  );
}
