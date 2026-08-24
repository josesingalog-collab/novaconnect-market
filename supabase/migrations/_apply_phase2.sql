-- =============================================================================
-- NOVACONNECT MARKET â€” APPLICATION COMPLÃˆTE DU SCHÃ‰MA (fichier gÃ©nÃ©rÃ©, idempotent)
-- Contenu = concatÃ©nation ordonnÃ©e des migrations 0001 -> 0011.
--
-- RÃ©exÃ©cutable sans danger : chaque objet est protÃ©gÃ© contre le doublon.
-- NE PAS EDITER Ã€ LA MAIN : rÃ©gÃ©nÃ©rer puis re-transformer.
-- =============================================================================

-- >>> DEBUT MIGRATION 0001_extensions_enums.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0001
-- Extensions, types énumérés, table de configuration, helper updated_at
-- ============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Types énumérés métier
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('BUYER', 'VENDOR', 'ADMIN');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.account_status as enum ('ACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.vendor_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.product_status as enum ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.order_status as enum ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.withdrawal_status as enum ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.ledger_entry_type as enum ('SALE_CREDIT', 'WITHDRAWAL_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Helper : met à jour updated_at automatiquement
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Configuration plateforme (commission par défaut, seuils retraits…)
-- Lecture/écriture réservées au serveur (RLS activée, aucune policy client).
-- ---------------------------------------------------------------------------
create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Valeurs initiales alignées avec lib/config.ts :
--   commission 10 % = 1000 bps ; seuil retrait 20,00 USD ; CDF désactivé.
insert into public.app_settings (key, value) values
  ('platform_commission_bps', '1000'),
  ('min_withdrawal_minor', '{"USD": "2000"}')
on conflict (key) do nothing;

-- >>> DEBUT MIGRATION 0002_profiles.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0002
-- Profils utilisateurs liés à auth.users + garde anti-élévation de privilèges
-- ============================================================================

create table if not exists public.profiles (
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

drop trigger if exists trg_profiles_updated_at on public.profiles;
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

drop trigger if exists trg_on_auth_user_created on auth.users;
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
    -- NB : en security definer, current_user vaut TOUJOURS le propriétaire
    -- (postgres). On compare donc aussi session_user : égalité uniquement
    -- pour une vraie session SQL Editor, pas pour une requête API élevée.
    if jwt_role <> 'service_role'
       and not (current_user = session_user and current_user in ('postgres', 'supabase_admin')) then
      raise exception 'Modification du role ou du statut du profil interdite via cette voie';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
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

revoke all on function public.is_admin() from public;
-- anon DOIT pouvoir évaluer is_admin() : les policies de lecture publique du
-- catalogue l'appellent. Pour anon, auth.uid() vaut NULL -> retourne false,
-- aucun contournement possible.
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Policies RLS profils
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid());
-- NB : la policy autorise l'UPDATE de SES champs éditables (nom, téléphone…),
-- mais le trigger guard_profile_sensitive bloque role/status côté base.

-- >>> DEBUT MIGRATION 0003_vendors.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0003
-- Boutiques vendeurs + garde sur statut/commission
-- ============================================================================

create table if not exists public.vendors (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.profiles (id) on delete cascade,
  store_name           text not null check (char_length(store_name) between 2 and 80),
  slug                 text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description          text,
  logo_url             text,
  status               public.vendor_status not null default 'PENDING',
  -- Taux de commission en points de base ×100 : 1000 = 10,00 %.
  -- Valeur par défaut alignée sur app_settings 'platform_commission_bps'.
  commission_rate_bps  integer not null default 1000 check (commission_rate_bps between 0 and 10000),
  payout_phone         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_vendors_status on public.vendors (status);

alter table public.vendors enable row level security;

drop trigger if exists trg_vendors_updated_at on public.vendors;
create trigger trg_vendors_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- GARDE : le vendeur ne peut jamais modifier lui-même son statut ni sa
-- commission (validation admin uniquement, via service_role / postgres).
-- ---------------------------------------------------------------------------
create or replace function public.guard_vendor_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');

  if new.status is distinct from old.status or new.commission_rate_bps is distinct from old.commission_rate_bps then
    -- Voir garde profils : comparaison current_user = session_user obligatoire
    -- car security definer fait passer current_user pour postgres.
    if jwt_role <> 'service_role'
       and not (current_user = session_user and current_user in ('postgres', 'supabase_admin')) then
      raise exception 'Seule l''administration peut modifier le statut ou la commission d''une boutique';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_vendors_guard on public.vendors;
create trigger trg_vendors_guard
  before update on public.vendors
  for each row execute function public.guard_vendor_sensitive();

-- ---------------------------------------------------------------------------
-- Policies RLS boutiques
-- ---------------------------------------------------------------------------
-- Lecture publique des boutiques actives (vitrine marketplace) ;
-- le propriétaire voit toujours la sienne (même PENDING).
drop policy if exists "vendors_select_public_or_own" on public.vendors;
create policy "vendors_select_public_or_own"
  on public.vendors for select
  using (status = 'ACTIVE' or user_id = auth.uid() or public.is_admin());

-- Un utilisateur crée SA boutique (1 max via unique user_id), toujours PENDING.
drop policy if exists "vendors_insert_own" on public.vendors;
create policy "vendors_insert_own"
  on public.vendors for insert
  with check (
    user_id = auth.uid()
    and status = 'PENDING'
  );

-- Le propriétaire édite sa vitrine ; le guard bloque statut/commission.
drop policy if exists "vendors_update_own" on public.vendors;
create policy "vendors_update_own"
  on public.vendors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- >>> DEBUT MIGRATION 0004_catalog.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0004
-- Catalogue : catégories, produits, fichiers produits (privés)
-- ============================================================================

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null unique,
  description text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.categories enable row level security;

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

drop policy if exists "categories_select_active_or_admin" on public.categories;
create policy "categories_select_active_or_admin"
  on public.categories for select
  using (is_active or public.is_admin());
-- Écriture : service_role / postgres uniquement (aucune policy d'écriture).

-- ---------------------------------------------------------------------------
-- Produits
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  vendor_id         uuid not null references public.vendors (id) on delete cascade,
  category_id       uuid references public.categories (id) on delete set null,
  title             text not null check (char_length(title) between 3 and 150),
  slug              text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  short_description text check (char_length(short_description) <= 300),
  description       text,
  price             numeric(18,2) not null check (price > 0),
  currency          char(3) not null check (currency in ('USD', 'CDF')),
  thumbnail_url     text,
  status            public.product_status not null default 'DRAFT',
  rejection_reason  text,
  download_limit    integer check (download_limit is null or download_limit > 0),
  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_products_vendor on public.products (vendor_id);
create index if not exists idx_products_published on public.products (status, category_id) where status = 'PUBLISHED';
create index if not exists idx_products_title_trgm on public.products using gin (title gin_trgm_ops);

alter table public.products enable row level security;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Horodatage automatique de la première publication
create or replace function public.set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'PUBLISHED' and old.status is distinct from 'PUBLISHED' then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_published_at on public.products;
create trigger trg_products_published_at
  before update on public.products
  for each row execute function public.set_published_at();

-- ---------------------------------------------------------------------------
-- GARDE transitions de statut produit :
--  - propriétaire : DRAFT ↔ PENDING_REVIEW, REJECTED → PENDING_REVIEW ;
--    contenu éditable uniquement en DRAFT/REJECTED ; jamais PUBLISHED/ARCHIVED.
--  - service_role/postgres : tout (validation admin).
-- ---------------------------------------------------------------------------
create or replace function public.guard_product_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  is_owner boolean;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');

  -- Voir garde profils : security definer fait passer current_user pour
  -- postgres ; exiger aussi current_user = session_user pour la sortie early.
  if jwt_role = 'service_role'
     or (current_user = session_user and current_user in ('postgres', 'supabase_admin')) then
    return new;
  end if;

  select v.user_id = auth.uid() into is_owner
  from public.vendors v
  where v.id = new.vendor_id;

  if is_owner is not true then
    raise exception 'Produit non autorise';
  end if;

  -- Interdictions absolues pour le vendeur
  if new.status in ('PUBLISHED', 'ARCHIVED') then
    raise exception 'Seule l''administration peut publier ou archiver un produit';
  end if;

  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Seule l''administration peut definir le motif de rejet';
  end if;

  -- Transitions autorisées au vendeur
  if not (
    (old.status = 'DRAFT' and new.status = 'PENDING_REVIEW')
    or (old.status = 'PENDING_REVIEW' and new.status = 'DRAFT')
    or (old.status = 'REJECTED' and new.status = 'PENDING_REVIEW')
    or (old.status = new.status)
  ) then
    raise exception 'Transition de statut non autorisee';
  end if;

  -- Contenu modifiable seulement hors validation/publication
  if old.status not in ('DRAFT', 'REJECTED') and (
    new.title is distinct from old.title
    or new.slug is distinct from old.slug
    or new.description is distinct from old.description
    or new.short_description is distinct from old.short_description
    or new.price is distinct from old.price
    or new.currency is distinct from old.currency
    or new.category_id is distinct from old.category_id
    or new.thumbnail_url is distinct from old.thumbnail_url
  ) then
    raise exception 'Contenu fige pendant la validation ou la publication';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_guard on public.products;
create trigger trg_products_guard
  before update on public.products
  for each row execute function public.guard_product_transitions();

-- ---------------------------------------------------------------------------
-- Policies RLS produits
-- ---------------------------------------------------------------------------
drop policy if exists "products_select" on public.products;
create policy "products_select"
  on public.products for select
  using (
    (
      status = 'PUBLISHED'
      and exists (
        select 1 from public.vendors v
        where v.id = vendor_id and v.status = 'ACTIVE'
      )
    )
    or exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );

drop policy if exists "products_insert_own" on public.products;
create policy "products_insert_own"
  on public.products for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid() and v.status = 'ACTIVE'
    )
    and status = 'DRAFT'
  );

drop policy if exists "products_update_own_or_admin" on public.products;
create policy "products_update_own_or_admin"
  on public.products for update
  using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );
-- NB : le guard trigger restreint ce que le propriétaire peut réellement changer.

-- ---------------------------------------------------------------------------
-- Fichiers produits — métadonnées uniquement.
-- Le CONTENU vit dans un bucket Storage PRIVÉ (jamais public).
-- ---------------------------------------------------------------------------
create table if not exists public.product_files (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type       text not null,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);

create index if not exists idx_product_files_product on public.product_files (product_id);

alter table public.product_files enable row level security;

drop policy if exists "product_files_select_owner_or_admin" on public.product_files;
create policy "product_files_select_owner_or_admin"
  on public.product_files for select
  using (
    exists (
      select 1
      from public.products p
      join public.vendors v on v.id = p.vendor_id
      where p.id = product_id and (v.user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "product_files_insert_owner" on public.product_files;
create policy "product_files_insert_owner"
  on public.product_files for insert
  with check (
    exists (
      select 1
      from public.products p
      join public.vendors v on v.id = p.vendor_id
      where p.id = product_id and v.user_id = auth.uid()
    )
  );

drop policy if exists "product_files_delete_owner" on public.product_files;
create policy "product_files_delete_owner"
  on public.product_files for delete
  using (
    exists (
      select 1
      from public.products p
      join public.vendors v on v.id = p.vendor_id
      where p.id = product_id and v.user_id = auth.uid()
    )
  );

-- >>> DEBUT MIGRATION 0005_orders.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0005
-- Commandes, lignes de commande (snapshots), paiements, événements webhook
-- ============================================================================

-- Numérotation lisible : NC-2026-000042
create sequence if not exists public.order_number_seq;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'NC-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.order_number_seq')::text, 6, '0')
$$;

-- ---------------------------------------------------------------------------
-- Commandes — écritures réservées au serveur (checkout Phase 6 via service).
-- L'acheteur lit uniquement SES commandes.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  buyer_id     uuid not null references public.profiles (id) on delete cascade,
  order_number text not null unique default public.generate_order_number(),
  subtotal     numeric(18,2) not null default 0 check (subtotal >= 0),
  discount     numeric(18,2) not null default 0 check (discount >= 0),
  platform_fee numeric(18,2) not null default 0 check (platform_fee >= 0),
  total        numeric(18,2) not null check (total > 0),
  currency     char(3) not null check (currency in ('USD', 'CDF')),
  status       public.order_status not null default 'PENDING',
  coupon_code  citext,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_orders_buyer on public.orders (buyer_id, created_at desc);
create index if not exists idx_orders_status on public.orders (status);

alter table public.orders enable row level security;

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  using (buyer_id = auth.uid() or public.is_admin());
-- INSERT/UPDATE/DELETE : aucune policy client → service_role uniquement.

-- ---------------------------------------------------------------------------
-- Lignes de commande — SNAPSHOT immuable au moment de l'achat (§17/§19) :
-- prix, titre, taux de commission et montants figés pour toujours.
-- Contrainte d'intégrité : commission + part vendeur = total ligne.
-- ---------------------------------------------------------------------------
create table if not exists public.order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  product_id          uuid references public.products (id) on delete set null,
  vendor_id           uuid not null references public.vendors (id),
  product_title       text not null,
  unit_price          numeric(18,2) not null check (unit_price > 0),
  quantity            integer not null default 1 check (quantity between 1 and 99),
  line_total          numeric(18,2) not null check (line_total > 0),
  commission_rate_bps integer not null check (commission_rate_bps between 0 and 10000),
  commission_amount   numeric(18,2) not null check (commission_amount >= 0),
  vendor_amount       numeric(18,2) not null check (vendor_amount >= 0),
  currency            char(3) not null check (currency in ('USD', 'CDF')),
  created_at          timestamptz not null default now(),
  constraint chk_order_items_split
    check (commission_amount + vendor_amount = line_total)
);

create index if not exists idx_order_items_order on public.order_items (order_id);
create index if not exists idx_order_items_vendor on public.order_items (vendor_id);

alter table public.order_items enable row level security;

drop policy if exists "order_items_select" on public.order_items;
create policy "order_items_select"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer_id = auth.uid()
    )
    or exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );
-- Écritures : service_role uniquement.

-- ---------------------------------------------------------------------------
-- Paiements — JAMAIS lus ni créés par les clients (aucune policy).
-- Le statut visible par l'acheteur passe par orders.status.
-- UNIQUE(provider, provider_reference) = pilier anti-doublon.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders (id) on delete cascade,
  provider           text not null,
  provider_reference text,
  amount             numeric(18,2) not null check (amount > 0),
  currency           char(3) not null check (currency in ('USD', 'CDF')),
  status             public.payment_status not null default 'PENDING',
  failure_reason     text,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now()
);

create unique index if not exists uniq_payments_provider_reference
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

create index if not exists idx_payments_order on public.payments (order_id);

alter table public.payments enable row level security;
-- Aucune policy : table 100 % serveur (webhooks + back-office).

-- ---------------------------------------------------------------------------
-- Journal brut des webhooks — idempotence via (provider, event_hash).
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid references public.payments (id) on delete set null,
  provider    text not null,
  event_type  text not null,
  event_hash  text not null,
  payload     jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_hash)
);

alter table public.payment_events enable row level security;
-- Aucune policy : service_role uniquement.

-- >>> DEBUT MIGRATION 0006_downloads.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0006
-- Journal des téléchargements (audit) — le DROIT de télécharger est dérivé
-- des order_items d'une commande PAID, jamais stocké ici.
-- ============================================================================

create table if not exists public.downloads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  order_item_id   uuid not null references public.order_items (id) on delete cascade,
  product_file_id uuid references public.product_files (id) on delete set null,
  downloaded_at   timestamptz not null default now()
);

create index if not exists idx_downloads_user on public.downloads (user_id, downloaded_at desc);
create index if not exists idx_downloads_order_item on public.downloads (order_item_id);

alter table public.downloads enable row level security;

-- L'utilisateur consulte l'historique de SES téléchargements.
drop policy if exists "downloads_select_own" on public.downloads;
create policy "downloads_select_own"
  on public.downloads for select
  using (user_id = auth.uid() or public.is_admin());
-- INSERT : service_role uniquement (route /api/downloads journalise).

-- >>> DEBUT MIGRATION 0007_finance.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0007
-- Architecture financière : retraits à réservation atomique,
-- ledger immuable, RPCs sécurisées, confirmation de paiement idempotente.
--
-- Modèle de solde (§5 du cahier des charges) :
--   balance comptable   = SUM(vendor_ledger_entries.amount)
--   montant réservé     = SUM(withdrawals.amount WHERE status actif)
--   balance disponible  = comptable - réservé
-- Les statuts actifs de réservation : PENDING / APPROVED / PROCESSING.
-- ============================================================================

create table if not exists public.withdrawals (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.vendors (id) on delete cascade,
  amount         numeric(18,2) not null check (amount > 0),
  currency       char(3) not null check (currency in ('USD', 'CDF')),
  method         text not null check (method in ('mobile_money', 'bank')),
  payout_details jsonb not null,
  status         public.withdrawal_status not null default 'PENDING',
  processed_by   uuid references public.profiles (id),
  processed_note text,
  requested_at   timestamptz not null default now(),
  processed_at   timestamptz
);

create index if not exists idx_withdrawals_vendor on public.withdrawals (vendor_id, status);
create index if not exists idx_withdrawals_status on public.withdrawals (status);

alter table public.withdrawals enable row level security;

drop policy if exists "withdrawals_select_own_or_admin" on public.withdrawals;
create policy "withdrawals_select_own_or_admin"
  on public.withdrawals for select
  using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );
-- INSERT/UPDATE : via RPCs sécurisées uniquement.

-- ---------------------------------------------------------------------------
-- Ledger immuable — append-only. Toute écriture passe par les fonctions
-- definer ; TOUTE modification/suppression est bloquée même pour service_role.
-- UNIQUE(entry_type, reference) = anti double-crédit / double-débit.
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_ledger_entries (
  id            bigint generated always as identity primary key,
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  entry_type    public.ledger_entry_type not null,
  amount        numeric(18,2) not null check (amount <> 0),
  currency      char(3) not null check (currency in ('USD', 'CDF')),
  order_item_id uuid references public.order_items (id) on delete set null,
  withdrawal_id uuid references public.withdrawals (id) on delete set null,
  reference     text not null,
  description   text,
  created_at    timestamptz not null default now(),
  unique (entry_type, reference)
);

create index if not exists idx_ledger_vendor on public.vendor_ledger_entries (vendor_id, currency);

alter table public.vendor_ledger_entries enable row level security;

drop policy if exists "ledger_select_own_or_admin" on public.vendor_ledger_entries;
create policy "ledger_select_own_or_admin"
  on public.vendor_ledger_entries for select
  using (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid()
    )
    or public.is_admin()
  );
-- INSERT : uniquement dans les fonctions definer (postgres).
-- UPDATE/DELETE : interdits pour TOUS (voir trigger ci-dessous).

create or replace function public.guard_ledger_immutable()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Le ledger financier est immuable : modification interdite';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_ledger_immutable on public.vendor_ledger_entries;
create trigger trg_ledger_immutable
  before update or delete on public.vendor_ledger_entries
  for each row execute function public.guard_ledger_immutable();

-- ---------------------------------------------------------------------------
-- NB : PAS de garde trigger sur withdrawals. La table n'expose AUCUNE policy
-- d'écriture : le RLS interdit déjà toute écriture directe aux clients, et
-- les seules écritures légitimes passent par les fonctions security definer
-- ci-dessous. Un garde en definer ne pourrait pas distinguer un appel RPC
-- légitime d'une écriture directe et bloquerait cancel_my_withdrawal.
--
-- Nettoyage défensif pour les bases où une version antérieure l'aurait créé :
drop trigger if exists trg_withdrawals_guard on public.withdrawals;
drop function if exists public.guard_withdrawals();

-- Débit automatique et IDEMPOTENT quand un retrait passe à PAID.
create or replace function public.ledger_on_withdrawal_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'PAID' and old.status is distinct from 'PAID' then
    insert into public.vendor_ledger_entries
      (vendor_id, entry_type, amount, currency, withdrawal_id, reference, description)
    values
      (new.vendor_id, 'WITHDRAWAL_DEBIT', -new.amount, new.currency, new.id,
       new.id::text, 'Retrait paye')
    on conflict (entry_type, reference) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdrawals_paid on public.withdrawals;
create trigger trg_withdrawals_paid
  after update on public.withdrawals
  for each row execute function public.ledger_on_withdrawal_paid();

-- Audit automatique des changements de statut de retrait
create or replace function public.audit_withdrawal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values ('withdrawal.status_change', 'withdrawal', new.id::text,
            jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

-- NB : créé après audit_logs (migration 0008). Voir fin de fichier 0008.

-- ---------------------------------------------------------------------------
-- SOLDES
-- ---------------------------------------------------------------------------
create or replace function public.vendor_available_balance(
  p_vendor   uuid,
  p_currency char(3)
)
returns numeric(18,2)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((select sum(amount) from public.vendor_ledger_entries
              where vendor_id = p_vendor and currency = p_currency), 0)
    - coalesce((select sum(amount) from public.withdrawals
                where vendor_id = p_vendor and currency = p_currency
                  and status in ('PENDING', 'APPROVED', 'PROCESSING')), 0);
$$;

revoke all on function public.vendor_available_balance(uuid, char) from public, anon, authenticated;

-- Soldes détaillés du vendeur connecté (comptable / réservé / disponible)
create or replace function public.get_my_vendor_balances()
returns table (
  currency           char(3),
  accounting_balance numeric(18,2),
  reserved_amount    numeric(18,2),
  available_balance  numeric(18,2)
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.currency,
    coalesce(c.net, 0)::numeric(18,2)          as accounting_balance,
    coalesce(r.reserved, 0)::numeric(18,2)     as reserved_amount,
    (coalesce(c.net, 0) - coalesce(r.reserved, 0))::numeric(18,2) as available_balance
  from (
    select l.currency, sum(l.amount) as net
    from public.vendor_ledger_entries l
    join public.vendors v on v.id = l.vendor_id
    where v.user_id = auth.uid()
    group by l.currency
  ) c
  full outer join (
    select w.currency, sum(w.amount) as reserved
    from public.withdrawals w
    join public.vendors v on v.id = w.vendor_id
    where v.user_id = auth.uid()
      and w.status in ('PENDING', 'APPROVED', 'PROCESSING')
    group by w.currency
  ) r on r.currency = c.currency
  where c.currency is not null or r.currency is not null;
$$;

revoke all on function public.get_my_vendor_balances() from public, anon;
grant execute on function public.get_my_vendor_balances() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- DEMANDE DE RETRAIT — réservation ATOMIQUE :
-- verrou sur la ligne vendeur → contrôle seuil + solde disponible → insert.
-- Deux demandes concurrentes ne peuvent jamais dépasser le disponible.
-- ---------------------------------------------------------------------------
create or replace function public.request_withdrawal(
  p_currency    char(3),
  p_amount      numeric(18,2),
  p_method      text,
  p_payout jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendor uuid;
  v_cfg    jsonb;
  v_min    numeric(18,2);
  v_avail  numeric(18,2);
  v_id     uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select id into v_vendor
  from public.vendors
  where user_id = auth.uid() and status = 'ACTIVE';

  if v_vendor is null then
    raise exception 'Boutique introuvable ou non active';
  end if;

  -- Sérialise toutes les opérations financières de CE vendeur
  perform 1 from public.vendors where id = v_vendor for update;

  select value into v_cfg
  from public.app_settings
  where key = 'min_withdrawal_minor';

  if v_cfg is null or v_cfg ->> p_currency is null then
    raise exception 'Retraits indisponibles pour cette devise';
  end if;

  -- app_settings stocke le seuil en UNITÉS MINOR (ex. 2000 = 20,00 USD).
  -- La RPC reçoit des unités MAJEURES : convertir avant comparaison.
  v_min := ((v_cfg ->> p_currency)::numeric / 100);

  if p_amount < v_min then
    raise exception 'Montant minimum de retrait : % ', v_min;
  end if;

  v_avail := public.vendor_available_balance(v_vendor, p_currency);

  if p_amount > v_avail then
    raise exception 'Solde disponible insuffisant : % restant', v_avail;
  end if;

  insert into public.withdrawals (vendor_id, amount, currency, method, payout_details)
  values (v_vendor, p_amount, p_currency, p_method, p_payout)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.request_withdrawal(char, numeric, text, jsonb)
  from public, anon;
grant execute on function public.request_withdrawal(char, numeric, text, jsonb)
  to authenticated, service_role;

-- Annulation d'un retrait PENDING par son vendeur (libère la réservation)
create or replace function public.cancel_my_withdrawal(p_withdrawal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.withdrawals
  set status = 'CANCELLED',
      processed_at = now()
  where id = p_withdrawal
    and status = 'PENDING'
    and vendor_id in (select id from public.vendors where user_id = auth.uid());

  if not found then
    raise exception 'Retrait introuvable ou deja traite';
  end if;
end;
$$;

revoke all on function public.cancel_my_withdrawal(uuid) from public, anon;
grant execute on function public.cancel_my_withdrawal(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- CONFIRMATION DE PAIEMENT — cœur transactionnel (§49/§50) :
-- appelée UNIQUEMENT par le webhook validé côté serveur.
-- Idempotente : rejouer ne crée jamais deux crédits vendeur.
-- ---------------------------------------------------------------------------
create or replace function public.confirm_order_payment(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order   public.orders%rowtype;
  v_item    record;
  v_fee     numeric(18,2);
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Paiement introuvable';
  end if;

  -- IDEMPOTENCE : déjà confirmé → no-op silencieux (webhook rejoué)
  if v_payment.status = 'PAID' then
    return;
  end if;

  if v_payment.status <> 'PENDING' then
    raise exception 'Statut paiement non confirmable : %', v_payment.status;
  end if;

  select * into v_order
  from public.orders
  where id = v_payment.order_id
  for update;

  if not found then
    raise exception 'Commande introuvable';
  end if;

  if v_order.status = 'PAID' then
    -- Cohérence croisée : la commande est déjà payée, on aligne le paiement.
    update public.payments
    set status = 'PAID', confirmed_at = now()
    where id = p_payment_id;
    return;
  end if;

  if v_order.status <> 'PENDING' then
    raise exception 'Commande non en attente : %', v_order.status;
  end if;

  update public.payments
  set status = 'PAID', confirmed_at = now()
  where id = p_payment_id;

  update public.orders
  set status = 'PAID', paid_at = now()
  where id = v_order.id;

  -- Frais plateforme = somme des commissions snapshotées
  select coalesce(sum(commission_amount), 0) into v_fee
  from public.order_items
  where order_id = v_order.id;

  update public.orders
  set platform_fee = v_fee
  where id = v_order.id;

  -- Crédit ledger par ligne (UNIQUE(entry_type, reference) ⇒ idempotent)
  for v_item in
    select * from public.order_items where order_id = v_order.id
  loop
    insert into public.vendor_ledger_entries
      (vendor_id, entry_type, amount, currency, order_item_id, reference, description)
    values
      (v_item.vendor_id, 'SALE_CREDIT', v_item.vendor_amount, v_item.currency,
       v_item.id, v_item.id::text, 'Vente : ' || v_item.product_title)
    on conflict (entry_type, reference) do nothing;
  end loop;

  insert into public.audit_logs (action, entity_type, entity_id, metadata)
  values ('order.paid', 'order', v_order.id::text,
          jsonb_build_object('total', v_order.total, 'currency', v_order.currency,
                             'payment', p_payment_id));
end;
$$;

revoke all on function public.confirm_order_payment(uuid) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid) to service_role;

-- >>> DEBUT MIGRATION 0008_extras.sql
-- ============================================================================
-- NOVACONNECT MARKET — Migration 0008
-- Audit log, avis vérifiés, coupons, abonnements (squelette V1),
-- bucket Storage privé, câblage des audits.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Journal d'audit des actions sensibles (§44)
-- Écritures : triggers / serveur uniquement. Lecture : ADMIN.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  text,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_logs_action on public.audit_logs (action, created_at desc);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_select_admin" on public.audit_logs;
create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.is_admin());
-- INSERT : triggers / service_role uniquement (aucune policy client).

-- Câblage de l'audit des retraits (fonction définie en 0007)
drop trigger if exists trg_withdrawals_audit on public.withdrawals;
create trigger trg_withdrawals_audit
  after update on public.withdrawals
  for each row execute function public.audit_withdrawal_status();

-- Audit des transitions de statut produit (approbation/rejet admin…)
create or replace function public.audit_product_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (action, entity_type, entity_id, metadata)
    values (
      'product.' || lower(new.status::text),
      'product', new.id::text,
      jsonb_build_object('from', old.status, 'to', new.status,
                         'rejection_reason', new.rejection_reason)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_audit on public.products;
create trigger trg_products_audit
  after update on public.products
  for each row execute function public.audit_product_status();

-- ---------------------------------------------------------------------------
-- Avis — autorisés UNIQUEMENT après achat vérifié (commande PAID).
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists idx_reviews_product on public.reviews (product_id);

alter table public.reviews enable row level security;

drop trigger if exists trg_reviews_updated_at on public.reviews;
create trigger trg_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

drop policy if exists "reviews_select_for_published" on public.reviews;
create policy "reviews_select_for_published"
  on public.reviews for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'PUBLISHED'
    )
    or user_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists "reviews_insert_verified_buyer" on public.reviews;
create policy "reviews_insert_verified_buyer"
  on public.reviews for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.orders o
      join public.order_items oi on oi.order_id = o.id
      where o.buyer_id = auth.uid()
        and o.status = 'PAID'
        and oi.product_id = product_id
    )
  );

drop policy if exists "reviews_update_own" on public.reviews;
create policy "reviews_update_own"
  on public.reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Coupons — structure prête, flux V1 minimal (création/gestion côté serveur).
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id               uuid primary key default gen_random_uuid(),
  code             citext not null unique,
  discount_type    text not null check (discount_type in ('PERCENT', 'FIXED')),
  value            numeric(18,2) not null check (value > 0),
  currency         char(3) check (currency is null or currency in ('USD', 'CDF')),
  min_order_amount numeric(18,2) check (min_order_amount is null or min_order_amount >= 0),
  starts_at        timestamptz,
  expires_at       timestamptz,
  max_uses         integer check (max_uses is null or max_uses > 0),
  times_used       integer not null default 0 check (times_used >= 0),
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.coupons enable row level security;
-- Aucune policy client : application des coupons uniquement côté serveur.

-- ---------------------------------------------------------------------------
-- Abonnements SaaS — squelette §41, AUCUN flux actif en V1.
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id             text primary key,
  name           text not null,
  price_monthly  numeric(18,2),
  currency       char(3) default 'USD',
  features       jsonb not null default '[]'::jsonb,
  is_active      boolean not null default false
);

insert into public.plans (id, name, price_monthly, is_active) values
  ('FREE', 'Free', 0, true),
  ('STARTER', 'Starter', 9, false),
  ('PRO', 'Pro', 19, false),
  ('BUSINESS', 'Business', 49, false)
on conflict (id) do nothing;

create table if not exists public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  vendor_id    uuid not null unique references public.vendors (id) on delete cascade,
  plan_id      text not null references public.plans (id),
  status       text not null default 'INACTIVE',
  period_start timestamptz,
  period_end   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
-- Aucune policy : activation prévue après la V1.

-- ---------------------------------------------------------------------------
-- Bucket Storage PRIVÉ pour les fichiers produits (jamais public).
-- Les policies d'upload vendeur seront ajoutées à la Phase 5.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-files', 'product-files', false)
on conflict (id) do nothing;

-- >>> DEBUT MIGRATION 0009_avatars.sql
-- ============================================================================
-- 0009 — AVATARS : bucket Storage public + policies « son propre dossier »
-- ============================================================================
-- Convention de chemin : <user_id>/avatar.<ext>
-- Le dossier racine = l'id utilisateur : un compte ne peut écrire que dans
-- SON dossier (policies ci-dessous). Lecture publique via URL /object/public/.
-- Idempotent : re-exécution sans danger.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "avatars_owner_insert" on storage.objects;
create policy "avatars_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_update" on storage.objects;
create policy "avatars_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_owner_delete" on storage.objects;
create policy "avatars_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- >>> DEBUT MIGRATION 0010_vendor_role_flow.sql
-- ============================================================================
-- 0010 — FLUX VENDEUR (v2) : promotion liée explicitement au flux
--        vendors INSERT/DELETE → rôle du PROPRIÉTAIRE uniquement
-- ============================================================================
-- Un BUYER qui crée SA boutique devient VENDOR côté serveur : le client
-- n'envoie jamais `role`. La bascule est signée dans un GUC transactionnel
-- ('app.vendor_role_flow') que la garde profiles exige pour accepter la
-- transition — impossible à forger depuis l'API (profondeur de trigger ≥ 2).
-- ADMIN et STATUS restent totalement hors de portée de ce flux.
-- Idempotent : réexécution sans danger.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- GARDE PROFILS ÉTENDUE v2 :
--   - chemins historiques inchangés : service_role / session postgres réelle ;
--   - unique exception : bascule BUYER↔VENDOR du profil SIGNÉ dans le GUC,
--     posé uniquement par les triggers vendeur ci-dessous.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  signed_profile_id text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');

  if jwt_role = 'service_role'
     or (current_user = session_user and current_user in ('postgres', 'supabase_admin')) then
    return new;
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    signed_profile_id := coalesce(current_setting('app.vendor_role_flow', true), '');

    if not (
      pg_trigger_depth() > 1
      and current_user = 'postgres'
      and current_user <> session_user
      and signed_profile_id = new.id::text
      and (
        (old.role = 'BUYER' and new.role = 'VENDOR')
        or (old.role = 'VENDOR' and new.role = 'BUYER')
      )
      and new.status = old.status
    ) then
      raise exception 'Le rôle et le statut ne peuvent pas etre modifies directement';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PROMOTION : création de SA boutique → VENDOR (BUYER uniquement)
-- ---------------------------------------------------------------------------
create or replace function public.promote_to_vendor_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.vendor_role_flow', new.user_id::text, true);

  update public.profiles
  set role = 'VENDOR'
  where id = new.user_id
    and role = 'BUYER';

  return new;
end;
$$;

drop trigger if exists trg_vendors_promote_role on public.vendors;
drop trigger if exists trg_vendors_promote_role on public.vendors;
create trigger trg_vendors_promote_role
  after insert on public.vendors
  for each row execute function public.promote_to_vendor_role();

-- ---------------------------------------------------------------------------
-- DÉMOTION : suppression de la boutique → BUYER (VENDOR uniquement, jamais
-- ADMIN). No-op silencieux si le profil a déjà disparu (cascade compte).
-- ---------------------------------------------------------------------------
create or replace function public.demote_from_vendor_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.vendor_role_flow', old.user_id::text, true);

  update public.profiles
  set role = 'BUYER'
  where id = old.user_id
    and role = 'VENDOR';

  return old;
end;
$$;

drop trigger if exists trg_vendors_demote_role on public.vendors;
drop trigger if exists trg_vendors_demote_role on public.vendors;
create trigger trg_vendors_demote_role
  after delete on public.vendors
  for each row execute function public.demote_from_vendor_role();

-- >>> DEBUT MIGRATION 0011_checkout_rpc.sql
-- ============================================================================
-- 0011 — CHECKOUT : RPC atomique create_checkout_order (Phase 6)
-- ============================================================================
-- Un seul appel client typé (ids produits uniquement) crée dans UNE
-- transaction : commande PENDING + lignes snapshotées + paiement PENDING.
--
-- Sécurité :
--   - buyer_id := auth.uid() — JAMAIS un paramètre ;
--   - profil existant et ACTIVE exigé ;
--   - re-pricing intégral côté base : produits PUBLISHED de vendeurs ACTIVE,
--     prix/commission lus au moment de l'appel (aucun montant du client) ;
--   - devise unique par commande ; quantité fixée à 1 (produits numériques) ;
--   - discount = 0 en V1 (coupons : phase ultérieure, table intacte) ;
--   - commission = round(line * bps / 10000, 2) sur numeric — half-up positifs,
--     aligné avec lib/money.ts (computeCommissionAmount) ;
--   - security definer + revoke/grant explicites (D-004, D-013, D-015).
--
-- Montants sérialisés dans le JSON en TEXT au format décimal canonique (D-001).
-- Idempotent par nature : create or replace.
-- ============================================================================

create or replace function public.create_checkout_order(
  p_product_ids uuid[]
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_buyer          uuid;
  v_profile_status text;
  v_currency       char(3);
  v_subtotal       numeric(18,2) := 0;
  v_platform_fee   numeric(18,2) := 0;
  v_line           numeric(18,2);
  v_commission     numeric(18,2);
  v_vendor_amount  numeric(18,2);
  v_product        record;
  v_entry          jsonb;
  v_order_id       uuid;
  v_order_number   text;
  v_lines          jsonb := '[]'::jsonb;
begin
  -- ------------------------------------------------------------------ acheteur
  v_buyer := auth.uid();
  if v_buyer is null then
    raise exception 'Profil introuvable : connexion requise';
  end if;

  select status into v_profile_status
  from public.profiles
  where id = v_buyer;

  if v_profile_status is null then
    raise exception 'Profil introuvable : connexion requise';
  end if;
  if v_profile_status <> 'ACTIVE' then
    raise exception 'Compte suspendu : commande impossible';
  end if;

  -- ------------------------------------------------------------- entrées brutes
  if p_product_ids is null or cardinality(p_product_ids) = 0 then
    raise exception 'Panier vide';
  end if;

  -- ------------------------------------------------- re-pricing ligne à ligne
  for v_product in
    select
      p.id        as product_id,
      p.title     as product_title,
      p.price     as price,
      p.currency  as currency,
      v.id        as vendor_id,
      v.store_name as store_name,
      v.commission_rate_bps as bps
    from unnest(p_product_ids) as u(id)
    join public.products p on p.id = u.id
    join public.vendors   v on v.id = p.vendor_id
    where p.status = 'PUBLISHED'
      and v.status = 'ACTIVE'
    group by p.id, p.title, p.price, p.currency, v.id, v.store_name,
             v.commission_rate_bps
  loop
    -- Devise unique par commande
    if v_currency is null then
      v_currency := v_product.currency;
    elsif v_currency <> v_product.currency then
      raise exception 'Devises incompatibles dans le panier';
    end if;

    v_line          := v_product.price;                    -- quantité 1
    v_commission    := round(v_line * v_product.bps / 10000.0, 2);
    v_vendor_amount := v_line - v_commission;
    v_subtotal      := v_subtotal + v_line;
    v_platform_fee  := v_platform_fee + v_commission;

    v_lines := v_lines || jsonb_build_object(
      'product_id',         v_product.product_id,
      'vendor_id',          v_product.vendor_id,
      'store_name',         v_product.store_name,
      'product_title',      v_product.product_title,
      'unit_price',         v_line::text,
      'quantity',           1,
      'line_total',         v_line::text,
      'commission_rate_bps',v_product.bps,
      'commission_amount',  v_commission::text,
      'vendor_amount',      v_vendor_amount::text,
      'currency',           v_currency
    );
  end loop;

  -- Tout produit manquant / non publié / boutique non active → refus global
  if jsonb_array_length(v_lines) <>
     (select count(distinct id) from unnest(p_product_ids) as t(id)) then
    raise exception 'Produit introuvable ou non publie dans le panier';
  end if;

  -- ------------------------------------------------------------- insertion order
  insert into public.orders (buyer_id, subtotal, discount, platform_fee, total, currency, status)
  values (v_buyer, v_subtotal, 0, v_platform_fee, v_subtotal, v_currency, 'PENDING')
  returning id, order_number into v_order_id, v_order_number;

  -- ------------------------------------------------------- insertion des lignes
  for v_entry in select * from jsonb_array_elements(v_lines) loop
    insert into public.order_items (
      order_id, product_id, vendor_id, product_title,
      unit_price, quantity, line_total,
      commission_rate_bps, commission_amount, vendor_amount, currency
    ) values (
      v_order_id,
      (v_entry ->> 'product_id')::uuid,
      (v_entry ->> 'vendor_id')::uuid,
      v_entry ->> 'product_title',
      (v_entry ->> 'unit_price')::numeric(18,2),
      (v_entry ->> 'quantity')::integer,
      (v_entry ->> 'line_total')::numeric(18,2),
      (v_entry ->> 'commission_rate_bps'),
      (v_entry ->> 'commission_amount')::numeric(18,2),
      (v_entry ->> 'vendor_amount')::numeric(18,2),
      v_currency
    );
  end loop;

  -- ----------------------------------------------- paiement PENDING (Phase 7)
  insert into public.payments (order_id, provider, amount, currency, status)
  values (v_order_id, 'mock', v_subtotal, v_currency, 'PENDING');

  -- ------------------------------------------------------------------- retour
  return jsonb_build_object(
    'order_id',     v_order_id,
    'order_number', v_order_number,
    'status',       'PENDING',
    'currency',     v_currency,
    'subtotal',     v_subtotal::text,
    'discount',     (0)::numeric(18,2)::text,
    'platform_fee', v_platform_fee::text,
    'total',        v_subtotal::text,
    'items',        v_lines
  )::json;
end;
$$;

revoke all on function public.create_checkout_order(uuid[]) from public, anon;
grant execute on function public.create_checkout_order(uuid[])
  to authenticated, service_role;
