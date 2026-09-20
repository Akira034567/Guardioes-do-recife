import type { AccountRecord, AccountResult } from "../../../core/account/AccountStore";
import { ACCOUNT_NAME_MAX, ACCOUNT_NAME_MIN, PASSWORD_MIN } from "../../../core/account/AccountStore";
import { CLOUD_PASSWORD_MIN, type CloudProfile, type CloudResult } from "../../../core/account/CloudAccount";
import { getAccounts } from "../../../systems/accounts";
import { getCloud } from "../../../systems/cloud";
import {
  changePassword,
  cloudSignIn,
  cloudSignOut,
  cloudSignUp,
  cloudSyncNow,
  deleteAccount,
  importAccountCode,
  signIn,
  signOut,
  signUp,
} from "../../../systems/session";
import { fill, h } from "../h";
import { ICONS } from "../icons";
import type { Screen } from "../ScreenHost";
import { shellSidebar, type ShellNav } from "../shell";

/**
 * Minha Conta — UMA pergunta por vez.
 *
 * A primeira versão mostrava tudo ao mesmo tempo: entrar na nuvem, criar conta na nuvem, recuperar
 * senha, entrar numa conta do aparelho, criar conta do aparelho e o código de transferência —
 * seis formulários abertos, uns vinte campos, numa tela cujo trabalho é responder "quem está
 * jogando?". Quem chegava aqui para entrar tinha que achar onde entrar.
 *
 * Agora a tela mostra um caminho só, e os outros ficam a um toque:
 *
 * 1. **Conta na nuvem** é o cartão único e aberto. Um seletor de dois botões — ENTRAR / CRIAR
 *    CONTA — troca o formulário no lugar; "esqueci a senha" é um terceiro modo do mesmo cartão.
 * 2. **Mais opções** guarda o que é de manutenção: as contas deste aparelho e, quando não há nuvem
 *    configurada, o código de transferência.
 *
 * O código do Recife sai da frente, mas não sai do jogo: a conta na nuvem é opcional, e quem
 * prefere não dar e-mail nenhum continua tendo só ele para levar o progresso a outro aparelho.
 *
 * Toda operação que troca de save termina em `onAccountChanged()`, que refaz a cena: o Recife, as
 * Conchas e os Guardiões que aparecem depois já são os da conta que acabou de entrar.
 */

/** Qual formulário o cartão da nuvem está mostrando. */
type CloudMode = "signin" | "signup" | "reset";
export function accountScreen(onBack: () => void, nav?: ShellNav, embedded = false, onAccountChanged: () => void = () => {}): Screen {
  /** O formulário aberto no cartão da nuvem. Entrar é o que 9 em cada 10 visitas querem. */
  let mode: CloudMode = "signin";
  /** "Mais opções" começa fechado: é manutenção, não é o caminho de quem veio entrar. */
  let extrasOpen = false;

  return {
    id: "account",
    render() {
      const root = h("div", { class: `gr-album gr-config gr-config--account${embedded ? " gr-album--embedded" : ""}`, testId: "account-panel" });
      const layout = h("div", { class: "gr-album__layout" });
      root.append(layout);

      const draw = (): void => {
        const store = getAccounts();
        const active = store.active;
        const cloudReady = getCloud().isConfigured;
        const cloud = cloudCard(mode, (next) => {
          mode = next;
          draw();
        }, draw, onAccountChanged);
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
              { class: "gr-config__body gr-config__body--single" },
              cloud,
              // Sem nuvem, a conta do aparelho É a conta: ela sobe para o lugar principal.
              cloudReady ? null : currentCard(active, draw, onAccountChanged),
              disclosure(
                "account-extras",
                extrasOpen,
                cloudReady ? "Mais opções" : "Outras contas deste aparelho",
                () => {
                  extrasOpen = !extrasOpen;
                  draw();
                },
                ...(cloudReady ? [currentCard(active, draw, onAccountChanged)] : []),
                accessCard(active, store.list(), draw, onAccountChanged),
                // O código do Recife SAI da frente, mas não sai do jogo: a conta na nuvem é
                // opcional, e quem joga sem dar e-mail nenhum continua tendo só ele para levar o
                // progresso a outro aparelho. Tirá-lo porque existe nuvem seria tirar a saída de
                // quem justamente não quer usá-la.
                transferCard(active, draw, onAccountChanged),
              ),
            ),
            h("p", {
              class: "gr-album__foot",
              text: getCloud().isConfigured
                ? "Com conta na nuvem, o progresso te encontra em qualquer aparelho."
                : "As contas ficam neste aparelho. Para jogar em outro, leve o código do Recife.",
            }),
          ),
        );
      };

      draw();
      return root;
    },
  };
}

function header(active: AccountRecord | null): HTMLElement {
  const cloud = getCloud().profile;
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
        text: cloud
          ? `Você está na conta ${cloud.username}, com o progresso guardado na nuvem.`
          : active
            ? `Você está jogando como ${active.name}, neste aparelho.`
            : "Você está jogando como convidado, neste aparelho.",
      }),
    ),
    h("p", { class: "gr-album__quote", text: "“Todo Guardião tem um nome.”" }),
  );
}

// ------------------------------------------------------------------------------- cartões

/**
 * A CONTA NA NUVEM. Um cartão só, com três estados: desligada, deslogado e logado.
 *
 * O e-mail é obrigatório porque é ele — e só ele — que devolve a senha quando o jogador a esquece.
 * O nome de usuário é o que ele digita para entrar e é único no servidor inteiro, não só aqui.
 */
function cloudCard(mode: CloudMode, onMode: (next: CloudMode) => void, redraw: () => void, onAccountChanged: () => void): HTMLElement | null {
  const cloud = getCloud();
  if (!cloud.isConfigured) return null;
  const profile = cloud.profile;
  return profile ? cloudSignedInCard(profile, redraw, onAccountChanged) : cloudSignedOutCard(mode, onMode, redraw, onAccountChanged);
}

function cloudSignedOutCard(mode: CloudMode, onMode: (next: CloudMode) => void, redraw: () => void, onAccountChanged: () => void): HTMLElement {
  return card(
    ICONS.account,
    "Conta na nuvem",
    mode === "reset" ? "Mandamos um link para você criar uma senha nova." : "Um usuário, um e-mail e o Recife em qualquer aparelho.",
    "cloud-card",
    // O seletor some no modo "recuperar": ali a única saída é voltar, e ela está no rodapé.
    mode === "reset" ? null : modePicker(mode, onMode),
    mode === "signin" ? signInForm(redraw, onAccountChanged, onMode) : null,
    mode === "signup" ? signUpForm(redraw, onAccountChanged) : null,
    mode === "reset" ? resetForm(onMode) : null,
  );
}

/** ENTRAR | CRIAR CONTA. Dois caminhos, um aberto por vez. */
function modePicker(mode: CloudMode, onMode: (next: CloudMode) => void): HTMLElement {
  const tab = (id: CloudMode, label: string): HTMLElement =>
    h("button", {
      class: `gr-config__mode${id === mode ? " gr-config__mode--on" : ""}`,
      testId: `cloud-mode-${id}`,
      type: "button",
      text: label,
      "aria-pressed": String(id === mode),
      onClick: () => onMode(id),
    });
  return h("div", { class: "gr-config__modes", testId: "cloud-modes", dataValue: mode }, tab("signin", "ENTRAR"), tab("signup", "CRIAR CONTA"));
}

function signInForm(redraw: () => void, onAccountChanged: () => void, onMode: (next: CloudMode) => void): HTMLElement {
  const status = statusLine("cloud-signin-status");
  const identifier = textInput("cloud-identifier", "Usuário ou e-mail", "username", FIELD_MAX.email);
  const password = passwordInput("cloud-password", "Senha", "current-password");
  const enter = actionButton("cloud-signin", ICONS.play, "ENTRAR", async () => {
    const result = await cloudSignIn(identifier.input.value, password.input.value);
    password.input.value = "";
    if (!result.ok) {
      showCloud(status, result, "");
      return;
    }
    // Dizer QUAL save venceu é o mínimo: o jogador acabou de arriscar o progresso dele.
    status.dataset.tone = "ok";
    status.textContent =
      result.value.source === "cloud"
        ? `Bem-vindo, ${result.value.profile.username}! Trouxemos o progresso mais recente da nuvem.`
        : `Bem-vindo, ${result.value.profile.username}! O progresso deste aparelho era o mais novo e subiu para a nuvem.`;
    onAccountChanged();
    redraw();
  });
  submitOnEnter(enter, identifier.input, password.input);

  return h(
    "div",
    { class: "gr-field__form", testId: "cloud-signin-form" },
    identifier.row,
    password.row,
    enter,
    status,
    h("button", {
      class: "gr-config__link",
      testId: "cloud-reset-toggle",
      type: "button",
      text: "Esqueci minha senha",
      onClick: () => onMode("reset"),
    }),
  );
}

function signUpForm(redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const status = statusLine("cloud-create-status");
  const username = textInput("cloud-new-username", "Nome de usuário", "username");
  const email = emailInput("cloud-new-email", "E-mail");
  const password = passwordInput("cloud-new-password", "Senha", "new-password");
  const confirm = passwordInput("cloud-new-confirm", "Repita a senha", "new-password");
  const create = actionButton("cloud-create", ICONS.plus, "CRIAR CONTA", async () => {
    const result = await cloudSignUp({
      username: username.input.value,
      email: email.input.value,
      password: password.input.value,
      confirmPassword: confirm.input.value,
    });
    password.input.value = "";
    confirm.input.value = "";
    if (!result.ok) {
      showCloud(status, result, "");
      return;
    }
    status.dataset.tone = "ok";
    status.textContent = result.value.needsConfirmation
      ? "Conta criada! Confirme o e-mail que acabamos de enviar e depois entre por aqui."
      : "Conta criada. O progresso deste aparelho já subiu para ela.";
    if (!result.value.needsConfirmation) onAccountChanged();
    redraw();
  });
  submitOnEnter(create, username.input, email.input, password.input, confirm.input);

  return h(
    "div",
    { class: "gr-field__form", testId: "cloud-signup-form" },
    username.row,
    email.row,
    password.row,
    confirm.row,
    create,
    status,
    h("p", {
      class: "gr-hint gr-config__note",
      text: `De ${ACCOUNT_NAME_MIN} a ${ACCOUNT_NAME_MAX} letras no usuário (ele é único) e ao menos ${CLOUD_PASSWORD_MIN} caracteres na senha. A senha fica guardada com hash no servidor — nem nós conseguimos lê-la.`,
    }),
  );
}

function resetForm(onMode: (next: CloudMode) => void): HTMLElement {
  const status = statusLine("cloud-reset-status");
  const email = emailInput("cloud-reset-email", "E-mail da conta");
  const send = actionButton("cloud-reset-send", ICONS.book, "ENVIAR LINK", async () => {
    const result = await getCloud().requestPasswordReset(email.input.value);
    // A mensagem é a mesma exista ou não a conta: dizer "esse e-mail não tem conta" entregaria,
    // para quem estivesse chutando endereços, quem joga aqui.
    showCloud(status, result, "Se existir conta com esse e-mail, o link para trocar a senha já está a caminho.");
  });
  submitOnEnter(send, email.input);

  return h(
    "div",
    { class: "gr-field__form", testId: "cloud-reset-form" },
    email.row,
    send,
    status,
    h("button", {
      class: "gr-config__link",
      testId: "cloud-reset-back",
      type: "button",
      text: "← Voltar para entrar",
      onClick: () => onMode("signin"),
    }),
  );
}

function cloudSignedInCard(profile: CloudProfile, redraw: () => void, onAccountChanged: () => void): HTMLElement {
  const sync = getCloud().sync;
  const syncStatus = statusLine("cloud-sync-status");
  if (sync.error) {
    syncStatus.dataset.tone = "error";
    syncStatus.textContent = `A última sincronização falhou: ${sync.error}`;
  } else if (sync.lastSyncAt) {
    syncStatus.dataset.tone = "ok";
    syncStatus.textContent = `Sincronizado às ${new Date(sync.lastSyncAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`;
  }

  const passwordStatus = statusLine("cloud-password-status");
  const next = passwordInput("cloud-password-next", "Senha nova", "new-password");
  const confirm = passwordInput("cloud-password-confirm", "Repita a senha nova", "new-password");
  const form = h("div", { class: "gr-field__group", testId: "cloud-password-form", hidden: "" }, next.row, confirm.row, passwordStatus);
  const save = actionButton("cloud-password-save", ICONS.lock, "SALVAR SENHA", async () => {
    const result = await getCloud().changePassword(next.input.value, confirm.input.value);
    showCloud(passwordStatus, result, "Senha trocada em todos os aparelhos.");
    next.input.value = "";
    confirm.input.value = "";
  });
  save.hidden = true;

  return card(
    ICONS.account,
    profile.username,
    "Conta na nuvem — o progresso está guardado no servidor.",
    "cloud-card",
    row(ICONS.book, "E-mail", h("span", { class: "gr-config__value", testId: "cloud-email", text: profile.email })),
    row(
      ICONS.refresh,
      "Progresso",
      actionButton("cloud-sync", ICONS.refresh, "SINCRONIZAR AGORA", async () => {
        const result = await cloudSyncNow();
        showCloud(syncStatus, result, "Progresso enviado para a nuvem.");
      }),
    ),
    syncStatus,
    h("p", {
      class: "gr-hint gr-config__note",
      text: "O jogo sincroniza sozinho alguns segundos depois de cada partida. Este botão é para quem vai trocar de aparelho agora e quer garantir.",
    }),
    row(
      ICONS.lock,
      "Senha",
      actionButton("cloud-password-toggle", ICONS.gear, "TROCAR SENHA", () => {
        form.hidden = !form.hidden;
        save.hidden = form.hidden;
        if (!form.hidden) next.input.focus();
      }),
    ),
    form,
    save,
    row(
      ICONS.chevronLeft,
      "Sair da conta",
      actionButton("cloud-signout", ICONS.chevronLeft, "SAIR", async () => {
        await cloudSignOut();
        onAccountChanged();
        redraw();
      }),
    ),
    h("p", {
      class: "gr-hint gr-config__note",
      text: "Sair envia o que faltava e devolve este aparelho ao save de convidado. O progresso continua guardado na nuvem.",
    }),
  );
}

function showCloud(status: HTMLElement, result: CloudResult<unknown>, successMessage: string): void {
  status.dataset.tone = result.ok ? "ok" : "error";
  status.textContent = result.ok ? successMessage : result.message;
}


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

/**
 * Teto de caracteres por campo. Existe explícito porque o contrário custou caro: o teto era
 * deduzido do TIPO do campo, e todo campo de texto herdava o limite do NOME de usuário — 16
 * caracteres. Um e-mail de verdade não cabe em 16, então criar conta era impossível e a tela não
 * dava nenhuma pista do motivo: o caractere simplesmente não aparecia.
 */
const FIELD_MAX: Record<"email" | "username" | "password", number> = {
  /** O limite do e-mail é o da especificação, não um palpite. */
  email: 254,
  username: ACCOUNT_NAME_MAX,
  password: 64,
};

function textInput(testId: string, label: string, autocomplete: string, maxLength = FIELD_MAX.username): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, "text", autocomplete, maxLength);
}

function emailInput(testId: string, label: string): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, "email", "email", FIELD_MAX.email);
}

function passwordInput(testId: string, label: string, autocomplete: string): { row: HTMLElement; input: HTMLInputElement } {
  return inputRow(testId, label, "password", autocomplete, FIELD_MAX.password);
}

function inputRow(
  testId: string,
  label: string,
  type: "text" | "password" | "email",
  autocomplete: string,
  maxLength: number,
): { row: HTMLElement; input: HTMLInputElement } {
  const input = h("input", {
    class: "gr-field__input",
    testId,
    type,
    autocomplete,
    maxlength: String(maxLength),
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

/**
 * Um bloco que abre e fecha, com o título virando o botão.
 *
 * Substitui o par "formulário escondido + botão escondido" que a tela usava: eram dois elementos
 * com `hidden` para cada seção, e manter os dois em sincronia era um passo que dava para esquecer.
 */
function disclosure(testId: string, open: boolean, label: string, onToggle: () => void, ...children: Array<HTMLElement | null>): HTMLElement {
  return h(
    "section",
    { class: `gr-config__more${open ? " gr-config__more--open" : ""}`, testId, dataOpen: String(open) },
    h(
      "button",
      { class: "gr-config__more-head", testId: `${testId}-toggle`, type: "button", "aria-expanded": String(open), onClick: onToggle },
      h("span", { class: "gr-icon", html: open ? ICONS.chevronDown : ICONS.chevronRight }),
      h("span", { text: label }),
    ),
    open ? h("div", { class: "gr-config__more-body" }, ...children) : null,
  );
}

/** Enter em qualquer campo do formulário aciona o botão dele — o que todo mundo espera de um form. */
function submitOnEnter(button: HTMLButtonElement, ...inputs: HTMLInputElement[]): void {
  for (const input of inputs) {
    input.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Enter") button.click();
    });
  }
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
