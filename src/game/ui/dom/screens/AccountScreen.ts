import type { ApiFailure, ApiResult, ApiUser } from "../../../core/account/AccountApi";
import { NAME_MAX, PASSWORD_MIN } from "../../../core/account/rules";
import { getAccountApi, getSession } from "../../../systems/accounts";
import { onSyncChanged, syncState } from "../../../systems/accountSync";
import { changePassword, deleteAccount, forgotPassword, register, resendVerification, signIn, signOut } from "../../../systems/session";
import { fill, h } from "../h";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * Minha Conta: entrar, criar conta, confirmar o e-mail e recuperar a senha.
 *
 * As contas vivem num servidor com banco de dados — é ele que garante e-mail único, nome único e
 * senha conferida. Esta tela nunca decide nada disso: ela pergunta, mostra a resposta e conta o que
 * está acontecendo com o progresso (baixando, subindo, pendente).
 *
 * Duas coisas que a tela faz questão de dizer em voz alta, porque são a diferença entre confiar e
 * não confiar no jogo: se o servidor está no ar, e se o seu progresso já subiu.
 */
export function accountScreen(onBack: () => void, nav?: ShellNav, embedded = false, onAccountChanged: () => void = () => {}): Screen {
  let stopWatchingSync: (() => void) | null = null;

  return {
    id: "account",
    onClose() {
      stopWatchingSync?.();
      stopWatchingSync = null;
    },
    render() {
      const root = h("div", { class: `gr-album gr-config${embedded ? " gr-album--embedded" : ""}`, testId: "account-panel" });
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const draw = (): void => {
        const user = getSession().user;
        fill(
          layout,
          embedded || !nav
            ? null
            : shellSidebar("account", nav, {
                navId: (section) => `account-nav-${section}`,
                back: onBack,
                backId: "account-back",
                motto: "O Recife lembra de quem cuida dele.",
              }),
          h(
            "div",
            { class: "gr-album__main" },
            header(user),
            h(
              "div",
              { class: "gr-config__body" },
              h("div", { class: "gr-config__column" }, user ? currentCard(user, draw, onAccountChanged) : signInCard(draw, onAccountChanged)),
              h("div", { class: "gr-config__column" }, user ? syncCard() : createCard(), serverCard()),
            ),
            h("p", {
              class: "gr-album__foot",
              text: user
                ? "O progresso desta conta fica no servidor: entre com o mesmo e-mail em qualquer aparelho e continue de onde parou."
                : "Sem conta, o progresso fica só neste navegador. Com conta, ele viaja com você.",
            }),
          ),
        );
      };

      // A sincronização acontece sozinha, em segundo plano: a tela acompanha em vez de perguntar.
      stopWatchingSync?.();
      stopWatchingSync = onSyncChanged(() => {
        if (getSession().user) draw();
      });
      draw();
      return root;
    },
  };
}

function header(user: ApiUser | null): HTMLElement {
  return h(
    "header",
    { class: "gr-album__top" },
    h(
      "div",
      { class: "gr-album__titles" },
      h("h1", { class: "gr-album__title", text: "MINHA CONTA" }),
      h("p", {
        class: "gr-subtitle",
        testId: "account-subtitle",
        text: user ? `Você está jogando como ${user.name}.` : "Você está jogando como convidado, só neste navegador.",
      }),
    ),
    h("p", { class: "gr-album__quote", text: "“Todo Guardião tem um nome.”" }),
  );
}

// ------------------------------------------------------------------------------- com sessão

function currentCard(user: ApiUser, redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const status = statusLine("account-password-status");
  const current = passwordInput("account-password-current", "Senha atual", "current-password");
  const next = passwordInput("account-password-next", "Senha nova", "new-password");
  const form = h("div", { class: "gr-field__group", testId: "account-password-form", hidden: "" }, current.row, next.row);
  const save = actionButton("account-password-save", ICONS.lock, "SALVAR SENHA", async () => {
    show(status, await changePassword(current.input.value, next.input.value), "Senha trocada.");
    current.input.value = "";
    next.input.value = "";
  });
  save.hidden = true;

  return card(
    ICONS.account,
    user.name,
    `No Recife desde ${shortDate(user.createdAt)}.`,
    "account-current",
    row(ICONS.pearl, "E-mail", h("span", { class: "gr-config__value gr-field__name", testId: "account-current-email", text: user.email })),
    user.verified ? null : verificationWarning(user.email),
    row(ICONS.timer, "Último acesso", h("span", { class: "gr-config__value", text: user.lastLoginAt ? shortDate(user.lastLoginAt) : "—" })),
    row(
      ICONS.lock,
      "Senha",
      actionButton("account-password-toggle", ICONS.gear, "TROCAR SENHA", () => {
        form.hidden = !form.hidden;
        save.hidden = form.hidden;
        if (!form.hidden) current.input.focus();
      }),
    ),
    form,
    save,
    status,
    row(
      ICONS.chevronLeft,
      "Sair da conta",
      actionButton("account-signout", ICONS.chevronLeft, "SAIR", async () => {
        await signOut();
        onAccountChanged();
        redraw();
      }),
    ),
    deleteBlock(redraw, onAccountChanged),
  );
}

/** Conta criada mas e-mail ainda não confirmado: o aviso vem com o botão que resolve. */
function verificationWarning(email: string): HTMLElement {
  const status = statusLine("account-verify-status");
  return h(
    "div",
    { class: "gr-field__block", testId: "account-unverified" },
    row(
      ICONS.skull,
      "E-mail não confirmado",
      actionButton("account-resend", ICONS.book, "REENVIAR", async () => {
        show(status, await resendVerification(email), "Mensagem reenviada. Procure na caixa de entrada e no spam.");
      }),
    ),
    status,
    h("p", { class: "gr-hint gr-config__note", text: "Enquanto o e-mail não for confirmado, esta conta não entra em outro aparelho." }),
  );
}

function deleteBlock(redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const status = statusLine("account-delete-status");
  const password = passwordInput("account-delete-password", "Senha para confirmar", "current-password");
  const form = h("div", { class: "gr-field__group", testId: "account-delete-form", hidden: "" }, password.row, status);
  const confirm = actionButton("account-delete-confirm", ICONS.skull, "APAGAR PARA SEMPRE", async () => {
    const result = await deleteAccount(password.input.value);
    show(status, result, "Conta apagada.");
    password.input.value = "";
    if (!result.ok) return;
    onAccountChanged();
    redraw();
  });
  confirm.hidden = true;
  return h(
    "div",
    { class: "gr-field__block" },
    row(
      ICONS.skull,
      "Apagar esta conta",
      actionButton("account-delete-toggle", ICONS.close, "APAGAR", () => {
        form.hidden = !form.hidden;
        confirm.hidden = form.hidden;
        if (!form.hidden) password.input.focus();
      }),
    ),
    form,
    confirm,
    h("p", { class: "gr-hint gr-config__note", text: "Apagar a conta apaga o progresso dela no servidor. Não dá para desfazer." }),
  );
}

/** O estado do progresso: subiu, está subindo, ou falhou e vai tentar de novo. */
function syncCard(): HTMLElement {
  const state = syncState();
  const tone = state.error ? "erro" : state.pending ? "pendente" : "ok";
  const text = state.error
    ? `Não consegui subir agora: ${state.error} Vou tentar de novo — o progresso está salvo aqui do mesmo jeito.`
    : state.pending
      ? "Subindo o progresso…"
      : state.lastPushAt
        ? `Progresso salvo no servidor às ${shortTime(state.lastPushAt)}.`
        : "Progresso em dia com o servidor.";
  return card(
    ICONS.waves,
    "Progresso",
    "Salvo aqui e no servidor.",
    "account-sync",
    h("p", { class: "gr-field__status", testId: "account-sync-status", dataValue: tone, dataTone: state.error ? "error" : "ok", text }),
    h("p", {
      class: "gr-hint gr-config__note",
      text: "Ao entrar, o que está no servidor manda. Depois disso, cada partida que você termina sobe sozinha.",
    }),
  );
}

// ------------------------------------------------------------------------------- sem sessão

function signInCard(redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const status = statusLine("account-signin-status");
  const email = textInput("account-email", "E-mail", "username", "email");
  const password = passwordInput("account-password", "Senha", "current-password");

  const enter = actionButton("account-signin", ICONS.play, "ENTRAR", async () => {
    const result = await signIn(email.input.value, password.input.value);
    show(status, result, "Entrando…");
    password.input.value = "";
    if (result.ok) {
      onAccountChanged();
      redraw();
      return;
    }
    // Conta existe mas falta confirmar: o caminho de volta fica ali mesmo, sem procurar em menu.
    if (result.reason === "unverified") {
      status.append(
        document.createTextNode(" "),
        h("button", {
          class: "gr-field__link",
          testId: "account-resend",
          type: "button",
          text: "Reenviar confirmação",
          onClick: async () => {
            show(status, await resendVerification(email.input.value), "Mensagem reenviada. Procure na caixa de entrada e no spam.");
          },
        }),
      );
    }
  });
  password.input.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") enter.click();
  });

  return card(
    ICONS.account,
    "Entrar",
    "Com o e-mail e a senha da sua conta.",
    "account-signin-card",
    email.row,
    password.row,
    enter,
    status,
    h(
      "div",
      { class: "gr-field__links" },
      h("button", {
        class: "gr-field__link",
        testId: "account-forgot",
        type: "button",
        text: "Esqueci minha senha",
        onClick: async () => {
          show(status, await forgotPassword(email.input.value), "Se existir uma conta com esse e-mail, o link para trocar a senha já está a caminho.");
        },
      }),
      h("button", {
        class: "gr-field__link",
        testId: "account-resend-standalone",
        type: "button",
        text: "Reenviar confirmação",
        onClick: async () => {
          show(status, await resendVerification(email.input.value), "Se essa conta existir e ainda não estiver confirmada, a mensagem já está a caminho.");
        },
      }),
    ),
  );
}

/*
 * Sem `redraw` de propósito: cadastrar não muda quem está logado, e redesenhar aqui trocaria o
 * elemento da mensagem recém-escrita por um vazio — a pessoa clicaria em "criar conta" e não veria
 * resposta nenhuma.
 */
function createCard(): HTMLElement {
  const status = statusLine("account-create-status");
  const email = textInput("account-new-email", "E-mail", "email", "email");
  const name = textInput("account-new-name", "Nome no Recife", "nickname", "text");
  const password = passwordInput("account-new-password", "Senha", "new-password");

  return card(
    ICONS.plus,
    "Criar conta",
    "Leva o seu progresso para qualquer aparelho.",
    "account-create-card",
    email.row,
    name.row,
    password.row,
    actionButton("account-create", ICONS.plus, "CRIAR CONTA", async () => {
      const result = await register(email.input.value, name.input.value, password.input.value);
      password.input.value = "";
      if (!result.ok) {
        show(status, result, "");
        return;
      }
      status.dataset.tone = "ok";
      status.textContent = `Conta criada. Enviamos uma mensagem para ${result.user.email}: confirme o e-mail e volte aqui para entrar.`;
      if (result.mailer === "file") {
        // Servidor sem SMTP: quem está testando precisa saber onde o "e-mail" foi parar.
        status.append(h("span", { class: "gr-hint", text: " (servidor sem e-mail configurado: a mensagem está em data/mail/ e o link saiu no terminal)" }));
      }
    }),
    status,
    h("p", {
      class: "gr-hint gr-config__note",
      text: `O progresso que você já tem neste navegador vira o progresso da conta no primeiro acesso. Nome de até ${NAME_MAX} letras, senha de pelo menos ${PASSWORD_MIN} caracteres — e nenhum e-mail ou nome se repete.`,
    }),
  );
}

/** O servidor está no ar? A tela pergunta uma vez e mostra a resposta sem enfeite. */
function serverCard(): HTMLElement {
  const line = h("p", { class: "gr-field__status", testId: "account-server-status", text: "Falando com o servidor…" });
  void getAccountApi()
    .health()
    .then((result) => {
      if (!line.isConnected) return;
      if (result.ok) {
        line.dataset.tone = "ok";
        line.textContent =
          result.mailer === "smtp"
            ? "Servidor de contas no ar, com envio de e-mail configurado."
            : "Servidor de contas no ar. O envio de e-mail ainda não está configurado: as mensagens ficam gravadas no servidor, em data/mail/.";
        return;
      }
      line.dataset.tone = "error";
      line.textContent = "Servidor de contas fora do ar. Dá para jogar como convidado — o progresso fica neste navegador.";
    });
  return card(ICONS.compass, "Servidor", "De onde vêm as contas.", "account-server", line);
}

// ------------------------------------------------------------------------------- peças

function card(icon: string, title: string, subtitle: string, testId: string, ...rows: Array<HTMLElement | null>): HTMLElement {
  return h(
    "section",
    { class: "gr-config__card", testId },
    h(
      "div",
      { class: "gr-config__head" },
      h("span", { class: "gr-icon gr-icon--lg", html: icon }),
      h(
        "span",
        { class: "gr-config__head-copy" },
        h("span", { class: "gr-config__title", text: title.toUpperCase() }),
        h("span", { class: "gr-hint", text: subtitle }),
      ),
    ),
    ...rows,
  );
}

function row(icon: string, label: string, control: HTMLElement): HTMLElement {
  return h(
    "div",
    { class: "gr-config__row" },
    h("span", { class: "gr-icon", html: icon }),
    h("span", { class: "gr-config__label", text: label }),
    control,
  );
}

function textInput(testId: string, label: string, autocomplete: string, type: "text" | "email"): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, type, autocomplete);
}

function passwordInput(testId: string, label: string, autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, "password", autocomplete);
}

function inputRow(testId: string, label: string, type: "text" | "email" | "password", autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  const input = h("input", {
    class: "gr-field__input",
    testId,
    type,
    autocomplete,
    maxlength: type === "text" ? String(NAME_MAX) : "254",
    "aria-label": label,
  }) as HTMLInputElement;
  return { input, row: h("label", { class: "gr-field" }, h("span", { class: "gr-field__label", text: label }), input) };
}

/**
 * Um botão de ação que sabe esperar. Enquanto a promessa não volta ele fica desligado: pedido de
 * rede demora, e sem isso um clique repetido viraria duas contas ou dois e-mails.
 */
function actionButton(testId: string, icon: string, label: string, run: () => void | Promise<void>): HTMLButtonElement {
  const text = h("span", { text: label });
  const element = h(
    "button",
    {
      class: "gr-config__action gr-field__action",
      testId,
      type: "button",
      onClick: async () => {
        if (element.disabled) return;
        element.disabled = true;
        text.textContent = "AGUARDE…";
        try {
          await run();
        } finally {
          element.disabled = false;
          text.textContent = label;
        }
      },
    },
    h("span", { class: "gr-icon", html: icon }),
    text,
  ) as HTMLButtonElement;
  return element;
}

function statusLine(testId: string): HTMLElement {
  return h("p", { class: "gr-field__status", testId, role: "status", "aria-live": "polite" });
}

function show(status: HTMLElement, result: ApiResult<unknown>, successMessage: string): void {
  status.dataset.tone = result.ok ? "ok" : "error";
  status.textContent = result.ok ? successMessage : (result as ApiFailure).message;
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function shortTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
