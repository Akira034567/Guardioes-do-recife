import type { AccountRecord, AccountResult } from "../../../core/account/AccountStore";
import { ACCOUNT_NAME_MAX, ACCOUNT_NAME_MIN, PASSWORD_MIN } from "../../../core/account/AccountStore";
import { getAccounts } from "../../../systems/accounts";
import { changePassword, deleteAccount, importAccountCode, signIn, signOut, signUp } from "../../../systems/session";
import { fill, h } from "../h";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * Minha Conta: entrar, criar conta e levar o progresso para outro aparelho.
 *
 * O jogo é uma página estática, sem servidor. Então "conta" aqui quer dizer duas coisas concretas:
 * cada jogador tem o SEU save neste aparelho (e ninguém joga por cima do progresso do outro), e o
 * progresso cabe num código que se cola no outro aparelho. É honesto dizer isso na tela, e a tela
 * diz — ninguém deve achar que o progresso está guardado num servidor que não existe.
 *
 * Toda operação que troca de save termina em `onAccountChanged()`, que refaz a cena: o Recife, as
 * Conchas e os Guardiões que aparecem depois já são os da conta que acabou de entrar.
 */
export function accountScreen(onBack: () => void, nav?: ShellNav, embedded = false, onAccountChanged: () => void = () => {}): Screen {
  return {
    id: "account",
    render() {
      const root = h("div", { class: `gr-album gr-config${embedded ? " gr-album--embedded" : ""}`, testId: "account-panel" });
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const draw = (): void => {
        const store = getAccounts();
        const active = store.active;
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
            header(active),
            h(
              "div",
              { class: "gr-config__body" },
              h("div", { class: "gr-config__column" }, currentCard(active, draw, onAccountChanged), accessCard(active, store.list(), draw, onAccountChanged)),
              h("div", { class: "gr-config__column" }, transferCard(active, draw, onAccountChanged)),
            ),
            h("p", { class: "gr-album__foot", text: "As contas ficam neste aparelho. Para jogar em outro, leve o código do Recife." }),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

function header(active: AccountRecord | null): HTMLElement {
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
        text: active ? `Você está jogando como ${active.name}.` : "Você está jogando como convidado, neste aparelho.",
      }),
    ),
    h("p", { class: "gr-album__quote", text: "“Todo Guardião tem um nome.”" }),
  );
}

// ------------------------------------------------------------------------------- cartões

/** A conta de agora: quem é, desde quando, e como sair ou trocar a senha. */
function currentCard(active: AccountRecord | null, redraw: () => void, onAccountChanged: () => void): HTMLElement {
  if (!active) {
    return card(
      ICONS.fish,
      "Jogando como convidado",
      "O progresso fica só neste aparelho.",
      "account-current",
      h("p", {
        class: "gr-hint gr-config__note",
        testId: "account-guest-note",
        text: "Crie uma conta para guardar o progresso com um nome e uma senha. O que você já jogou aqui pode vir junto.",
      }),
    );
  }

  const status = statusLine("account-password-status");
  const current = passwordInput("account-password-current", "Senha atual", "current-password");
  const next = passwordInput("account-password-next", "Senha nova", "new-password");
  const confirm = passwordInput("account-password-confirm", "Repita a senha nova", "new-password");
  const form = h("div", { class: "gr-field__group", testId: "account-password-form", hidden: "" }, current.row, next.row, confirm.row);

  const change = actionButton("account-password-save", ICONS.lock, "SALVAR SENHA", async () => {
    show(status, await changePassword(current.input.value, next.input.value, confirm.input.value), "Senha trocada.");
    current.input.value = "";
    next.input.value = "";
    confirm.input.value = "";
  });
  change.hidden = true;

  return card(
    ICONS.squad,
    active.name,
    `No Recife desde ${shortDate(active.createdAt)}.`,
    "account-current",
    row(ICONS.pearl, "Nome", h("span", { class: "gr-config__value gr-field__name", testId: "account-current-name", text: active.name })),
    row(ICONS.timer, "Último acesso", h("span", { class: "gr-config__value", text: active.lastLoginAt ? shortDate(active.lastLoginAt) : "—" })),
    row(
      ICONS.lock,
      "Senha",
      actionButton("account-password-toggle", ICONS.gear, "TROCAR SENHA", () => {
        form.hidden = !form.hidden;
        change.hidden = form.hidden;
        if (!form.hidden) current.input.focus();
      }),
    ),
    form,
    change,
    status,
    row(
      ICONS.chevronLeft,
      "Sair da conta",
      actionButton("account-signout", ICONS.chevronLeft, "SAIR", () => {
        signOut();
        onAccountChanged();
        redraw();
      }),
    ),
    deleteRow(active, redraw, onAccountChanged),
  );
}

/** Apagar a conta some com o save dela: a senha é a confirmação. */
function deleteRow(active: AccountRecord, redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const status = statusLine("account-delete-status");
  const password = passwordInput("account-delete-password", "Senha para confirmar", "current-password");
  const form = h("div", { class: "gr-field__group", testId: "account-delete-form", hidden: "" }, password.row, status);
  const confirm = actionButton("account-delete-confirm", ICONS.skull, "APAGAR PARA SEMPRE", async () => {
    const result = await deleteAccount(active.name, password.input.value);
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
    h("p", { class: "gr-hint gr-config__note", text: "Apagar a conta apaga o progresso dela neste aparelho. Não dá para desfazer." }),
  );
}

/** Entrar numa conta que já existe, ou criar uma nova. */
function accessCard(active: AccountRecord | null, accounts: readonly AccountRecord[], redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const signInStatus = statusLine("account-signin-status");
  const name = textInput("account-name", "Nome", "username");
  const password = passwordInput("account-password", "Senha", "current-password");
  const enter = actionButton("account-signin", ICONS.play, active ? "TROCAR DE CONTA" : "ENTRAR", async () => {
    const result = await signIn(name.input.value, password.input.value);
    show(signInStatus, result, result.ok ? `Bem-vindo de volta, ${result.account.name}!` : "");
    password.input.value = "";
    if (!result.ok) return;
    onAccountChanged();
    redraw();
  });
  // Enter no teclado é o que qualquer um espera de um campo de senha.
  password.input.addEventListener("keydown", (event) => {
    if ((event as KeyboardEvent).key === "Enter") enter.click();
  });

  const createStatus = statusLine("account-create-status");
  const newName = textInput("account-new-name", "Nome novo", "username");
  const newPassword = passwordInput("account-new-password", "Senha", "new-password");
  const newConfirm = passwordInput("account-new-confirm", "Repita a senha", "new-password");
  const carry = checkbox("account-carry", "Trazer para a conta o progresso deste aparelho", !active);
  const create = actionButton("account-create", ICONS.plus, "CRIAR CONTA", async () => {
    const result = await signUp({
      name: newName.input.value,
      password: newPassword.input.value,
      confirmPassword: newConfirm.input.value,
      carryDeviceProgress: carry.input.checked,
    });
    show(createStatus, result, result.ok && result.carried ? "Conta criada com o progresso deste aparelho." : "Conta criada.");
    newPassword.input.value = "";
    newConfirm.input.value = "";
    if (!result.ok) return;
    onAccountChanged();
    redraw();
  });

  return card(
    ICONS.chest,
    "Contas deste aparelho",
    accounts.length > 0 ? "Entre na sua ou crie outra." : "Nenhuma conta ainda — crie a primeira.",
    "account-access",
    accounts.length > 0
      ? h(
          "div",
          { class: "gr-field__chips", testId: "account-list" },
          ...accounts.map((account) =>
            h("button", {
              class: `gr-field__chip${account.id === active?.id ? " gr-field__chip--on" : ""}`,
              testId: `account-chip-${account.nameKey.replace(/\s+/g, "-")}`,
              type: "button",
              text: account.name,
              title: `Entrar como ${account.name}`,
              onClick: () => {
                name.input.value = account.name;
                password.input.focus();
              },
            }),
          ),
        )
      : null,
    name.row,
    password.row,
    enter,
    signInStatus,
    h("p", { class: "gr-hint gr-config__note", text: `Conta nova: de ${ACCOUNT_NAME_MIN} a ${ACCOUNT_NAME_MAX} letras no nome e ao menos ${PASSWORD_MIN} caracteres na senha. Dois jogadores não podem usar o mesmo nome.` }),
    newName.row,
    newPassword.row,
    newConfirm.row,
    carry.row,
    create,
    createStatus,
  );
}

/** O código do Recife: a ponte entre dois aparelhos enquanto não existe servidor. */
function transferCard(active: AccountRecord | null, redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const exportStatus = statusLine("account-code-status");
  const code = active ? getAccounts().exportCode() : null;
  const codeBox = h("textarea", {
    class: "gr-field__code",
    testId: "account-code",
    readonly: "",
    rows: "4",
    spellcheck: "false",
    "aria-label": "Código do Recife desta conta",
  }) as HTMLTextAreaElement;
  codeBox.value = code ?? "";

  const importStatus = statusLine("account-import-status");
  const importBox = h("textarea", {
    class: "gr-field__code",
    testId: "account-import-code",
    rows: "4",
    spellcheck: "false",
    placeholder: "Cole aqui o código do outro aparelho",
    "aria-label": "Código do Recife para trazer",
  }) as HTMLTextAreaElement;
  const importPassword = passwordInput("account-import-password", "Senha da conta", "current-password");

  return card(
    ICONS.compass,
    "Jogar em outro lugar",
    "Leve a conta e o progresso num código.",
    "account-transfer",
    h("p", {
      class: "gr-hint gr-config__note",
      text: "O jogo roda inteiro no seu navegador, sem servidor: ninguém guarda o progresso por você. O código abaixo é a sua conta inteira — copie, abra o jogo no outro aparelho e cole em “Trazer progresso”.",
    }),
    active
      ? codeBox
      : h("p", { class: "gr-hint", testId: "account-code-empty", text: "Entre numa conta para gerar o código dela." }),
    active
      ? actionButton("account-code-copy", ICONS.chest, "COPIAR CÓDIGO", async () => {
          codeBox.select();
          try {
            await navigator.clipboard.writeText(codeBox.value);
            exportStatus.dataset.tone = "ok";
            exportStatus.textContent = "Código copiado. Guarde num lugar seguro.";
          } catch {
            // Sem permissão da área de transferência (é comum): o texto já está selecionado.
            exportStatus.dataset.tone = "warn";
            exportStatus.textContent = "Não consegui copiar sozinho — o código está selecionado, use Ctrl+C.";
          }
        })
      : null,
    exportStatus,
    h("p", { class: "gr-hint gr-config__note", text: "Trazer progresso de outro aparelho:" }),
    importBox,
    importPassword.row,
    actionButton("account-import", ICONS.play, "TRAZER PROGRESSO", async () => {
      const result = await importAccountCode(importBox.value, importPassword.input.value);
      show(importStatus, result, "Progresso trazido para este aparelho.");
      importPassword.input.value = "";
      if (!result.ok) return;
      importBox.value = "";
      onAccountChanged();
      redraw();
    }),
    importStatus,
    h("p", {
      class: "gr-hint gr-config__note",
      text: "Se a conta já existir aqui, o código substitui o progresso dela neste aparelho — e a senha precisa ser a mesma.",
    }),
  );
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

function textInput(testId: string, label: string, autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, "text", autocomplete);
}

function passwordInput(testId: string, label: string, autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, "password", autocomplete);
}

function inputRow(testId: string, label: string, type: "text" | "password", autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  const input = h("input", {
    class: "gr-field__input",
    testId,
    type,
    autocomplete,
    maxlength: type === "text" ? String(ACCOUNT_NAME_MAX) : "64",
    "aria-label": label,
  }) as HTMLInputElement;
  return { input, row: h("label", { class: "gr-field" }, h("span", { class: "gr-field__label", text: label }), input) };
}

function checkbox(testId: string, label: string, checked: boolean): { row: HTMLElement; input: HTMLInputElement } {
  const input = h("input", { class: "gr-field__check", testId, type: "checkbox" }) as HTMLInputElement;
  input.checked = checked;
  return { input, row: h("label", { class: "gr-field gr-field--check" }, input, h("span", { class: "gr-field__label", text: label })) };
}

/**
 * Um botão de ação que sabe esperar. Enquanto a promessa não volta ele fica desligado: derivar a
 * senha leva um tempinho, e sem isso um clique repetido criaria duas contas com o mesmo nome.
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

function show(status: HTMLElement, result: AccountResult, successMessage: string): void {
  status.dataset.tone = result.ok ? "ok" : "error";
  status.textContent = result.ok ? successMessage : result.message;
}

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
