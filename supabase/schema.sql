-- ============================================================================
-- Guardiões do Recife — conta de verdade e progresso na nuvem (Supabase).
--
-- Rode este arquivo UMA vez no SQL Editor do projeto Supabase. Ele é idempotente:
-- rodar de novo depois de uma atualização não apaga nada.
--
-- O que existe aqui:
--   * profiles — o nome de usuário, único e insensível a caixa e acento, ligado ao usuário do Auth.
--   * saves    — um documento de progresso por usuário, em JSONB.
--   * RLS      — cada pessoa só enxerga e só escreve as PRÓPRIAS linhas.
--   * 2 RPCs   — conferir se um nome está livre, e entrar pelo nome de usuário.
--
-- O e-mail e o hash da senha NÃO moram aqui: eles são do `auth.users`, gerenciado pelo Supabase,
-- que já guarda a senha com bcrypt e já manda o e-mail de verificação e o de "esqueci a senha".
-- Reimplementar isso à mão seria escrever criptografia de senha e fila de e-mail sem precisar.
-- ============================================================================

-- `crypt` (bcrypt), usado por `email_for_credentials` para conferir a senha. No Supabase a
-- extensão costuma já existir no esquema `extensions`; o `if not exists` respeita isso.
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- normalização do nome

/*
 * Nome comparável: sem espaço sobrando, sem espaço duplo, sem acento e sem caixa.
 *
 * "Ana", "ana" e " aNa " são a mesma pessoa tentando entrar — é a mesma regra do
 * `normalizeAccountName` do cliente, e é AQUI que ela vale de verdade, porque o cliente não decide
 * o que o banco aceita.
 *
 * Usa `translate` em vez da extensão `unaccent` de propósito: a função precisa ser IMMUTABLE para
 * sustentar um índice único, e `unaccent` depende de dicionário e de esquema de instalação — duas
 * fontes de surpresa num arquivo que roda uma vez, na mão, em projeto alheio. As letras acentuadas
 * do português cabem numa tabela de tradução e não dependem de nada.
 */
create or replace function public.username_key(p_username text)
returns text
language sql
immutable
as $$
  select lower(
    translate(
      btrim(regexp_replace(coalesce(p_username, ''), '\s+', ' ', 'g')),
      'áàâãäÁÀÂÃÄéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
      'aaaaaAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN'
    )
  );
$$;

-- ---------------------------------------------------------------- perfis (nome de usuário)

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_shape check (char_length(username) between 3 and 16)
);

create unique index if not exists profiles_username_key_idx
  on public.profiles (public.username_key(username));

alter table public.profiles enable row level security;

drop policy if exists "perfil proprio: ler" on public.profiles;
create policy "perfil proprio: ler" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "perfil proprio: criar" on public.profiles;
create policy "perfil proprio: criar" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "perfil proprio: mudar" on public.profiles;
create policy "perfil proprio: mudar" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------- saves (progresso)

create table if not exists public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  /* O documento inteiro de `PlayerProgress`. JSONB porque o formato é do jogo, não do banco: uma
     versão nova do save não vira uma migração de esquema aqui. */
  document jsonb not null default '{}'::jsonb,
  save_version integer not null default 0,
  updated_at timestamptz not null default now(),
  /* Sobe a cada gravação. Serve para diagnóstico e para um futuro controle de conflito. */
  revision bigint not null default 1
);

alter table public.saves enable row level security;

drop policy if exists "save proprio: ler" on public.saves;
create policy "save proprio: ler" on public.saves
  for select using (auth.uid() = user_id);

drop policy if exists "save proprio: criar" on public.saves;
create policy "save proprio: criar" on public.saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "save proprio: mudar" on public.saves;
create policy "save proprio: mudar" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.touch_save()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  new.revision := coalesce(old.revision, 0) + 1;
  return new;
end;
$$;

drop trigger if exists saves_touch on public.saves;
create trigger saves_touch
  before update on public.saves
  for each row execute function public.touch_save();

-- ---------------------------------------------------------------- nascimento do usuário

/*
 * O nome de usuário chega no `raw_user_meta_data` do cadastro e vira perfil aqui, no mesmo
 * instante em que o usuário nasce. Fazer isso pelo cliente deixaria uma janela em que a conta
 * existe sem nome — e duas pessoas poderiam passar por ela com o mesmo nome.
 *
 * O nome de reserva (`guardiao-<8 dígitos>`) cobre o cadastro feito fora do jogo (painel do
 * Supabase, por exemplo), que não manda metadado nenhum.
 */
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'username'), ''), 'guardiao-' || left(new.id::text, 8)));
  insert into public.saves (user_id, document, save_version)
  values (new.id, '{}'::jsonb, 0)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- RPCs

/*
 * "Esse nome está livre?" — a tela de cadastro pergunta antes de a pessoa preencher o resto.
 *
 * Responde só sim ou não. Não devolve e-mail, id nem data: saber que "ana" existe é inevitável
 * (o cadastro recusaria de qualquer jeito) e não diz nada sobre quem é a Ana.
 */
create or replace function public.username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where public.username_key(username) = public.username_key(p_username)
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

/*
 * Entrar pelo NOME DE USUÁRIO.
 *
 * O Supabase só autentica por e-mail, e o jogador não quer decorar qual e-mail usou. A saída
 * óbvia — uma função que traduz nome em e-mail — vazaria o e-mail de qualquer pessoa para quem
 * soubesse o apelido dela. Então esta aqui EXIGE a senha e confere o hash (o mesmo bcrypt que o
 * Auth usa) antes de devolver qualquer coisa: com a senha errada, o retorno é nulo, e quem
 * perguntou não fica sabendo nem se o nome existe.
 *
 * A senha trafega por HTTPS, como já trafega para o endpoint de login logo em seguida.
 */
create or replace function public.email_for_credentials(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_hash text;
begin
  select u.email, u.encrypted_password
    into v_email, v_hash
    from public.profiles p
    join auth.users u on u.id = p.id
   where public.username_key(p.username) = public.username_key(p_username)
   limit 1;

  if v_hash is null or v_hash <> crypt(p_password, v_hash) then
    return null;
  end if;
  return v_email;
end;
$$;

revoke all on function public.email_for_credentials(text, text) from public;
grant execute on function public.email_for_credentials(text, text) to anon, authenticated;
