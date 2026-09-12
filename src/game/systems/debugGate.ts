/**
 * Ferramentas de desenvolvimento (overlay, painel, comandos de debug) só existem em build de
 * desenvolvimento ou quando a URL pede `?debug=1` explicitamente. Em produção, F2 fica inerte.
 */
export function isDebugAllowed(search: URLSearchParams): boolean {
  return Boolean(import.meta.env.DEV) || search.get("debug") === "1";
}
