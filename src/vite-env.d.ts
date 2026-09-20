/// <reference types="vite/client" />

/**
 * Configuração da conta na nuvem (Supabase). As variáveis são PÚBLICAS por desenho: a chave
 * publicável só serve para falar com o servidor, e quem protege os dados é a RLS do banco
 * (`supabase/schema.sql`). Ausentes, o jogo roda inteiro em modo offline.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  /** Chave publicável do projeto (`sb_publishable_…`), em Settings → API Keys. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Nome antigo da mesma coisa: o JWT `anon`, que o Supabase aposenta ao fim de 2026. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
