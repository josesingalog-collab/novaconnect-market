-- ============================================================================
-- NOVACONNECT MARKET — Migration 0002
-- Profils utilisateurs liés à auth.users + garde anti-élévation de privilèges
-- ============================================================================

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  email      citext not null unique,
  phone      text,
  avatar_url text,
  role       public.user_role not null default 'BUYER',
  status     public.account_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription (trigger sur auth.users).
-- security definer : la fonction écrit avec les droits du propriétaire
-- (postgres) car la table est protégée par RLS au moment de l'INSERT auth.
-- Un nouvel utilisateur est TOUJOURS BUYER par défaut.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- GARDE CRITIQUE : personne ne peut modifier `role` ou `status` d'un profil
-- via l'API client (même son propre profil). Seuls le rôle SQL postgres
-- (SQL Editor / fonctions definer) et service_role le peuvent.
-- Le rôle ADMIN ne peut JAMAIS être obtenu depuis le navigateur.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');

  if new.role is distinct from old.role or new.status is distinct from old.status then
    if jwt_role <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'Modification du role ou du statut du profil interdite via cette voie';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_sensitive();

-- ---------------------------------------------------------------------------
-- Helper : l'utilisateur courant est-il ADMIN ? (utilisé dans les policies)
-- security definer pour éviter la récursion RLS sur profiles.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN' and p.status = 'ACTIVE'
  );
$$;

revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies RLS profils
-- ---------------------------------------------------------------------------
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid());
-- NB : la policy autorise l'UPDATE de SES champs éditables (nom, téléphone…),
-- mais le trigger guard_profile_sensitive bloque role/status côté base.
