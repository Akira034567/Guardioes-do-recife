/**
 * As regras de e-mail, nome e senha. Moram no `core` porque valem nos DOIS lados: a tela avisa o
 * jogador antes de bater no servidor, e o servidor confere de novo — quem manda é sempre ele, já
 * que qualquer um pode chamar a API sem passar pela tela.
 */

export const NAME_MIN = 3;
export const NAME_MAX = 16;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const EMAIL_MAX = 254;

/** Letras (com acento), números, espaço, hífen e sublinhado; começa com letra ou número. */
const NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;
/**
 * Proposital: uma arroba, um ponto depois dela, e nada de espaço. Validar e-mail por regex é
 * conversa sem fim — quem diz de verdade se o endereço existe é a mensagem de confirmação.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Chave de unicidade do e-mail: sem espaços nas pontas e sem caixa. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Chave de unicidade do nome: sem acento, sem caixa, sem espaço duplicado. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** Nome como fica gravado: sem espaço sobrando, mas com a caixa e os acentos que a pessoa escreveu. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** `null` quando serve; a mensagem do problema, em português, quando não serve. */
export function validateEmail(email: string): string | null {
  const clean = normalizeEmail(email);
  if (clean.length === 0) return "Escreva o seu e-mail.";
  if (clean.length > EMAIL_MAX) return "Esse e-mail é longo demais.";
  if (!EMAIL_SHAPE.test(clean)) return "Esse e-mail não parece completo — confira se tem @ e o domínio.";
  return null;
}

export function validateName(name: string): string | null {
  const clean = cleanName(name);
  if (clean.length < NAME_MIN) return `O nome precisa de pelo menos ${NAME_MIN} letras.`;
  if (clean.length > NAME_MAX) return `O nome pode ter no máximo ${NAME_MAX} letras.`;
  if (!NAME_SHAPE.test(clean)) return "Use letras, números, espaço, hífen ou _ — e comece com letra ou número.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `A senha precisa de pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}
