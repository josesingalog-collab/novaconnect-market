-- ============================================================================
-- NOVACONNECT MARKET — Migration 0004
-- Catalogue : catégories, produits, fichiers produits (privés)
-- ============================================================================

create table public.categories (
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

create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

create policy "categories_select_active_or_admin"
  on public.categories for select
  using (is_active or public.is_admin());
-- Écriture : service_role / postgres uniquement (aucune policy d'écriture).

-- ---------------------------------------------------------------------------
-- Produits
-- ---------------------------------------------------------------------------
create table public.products (
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

create index idx_products_vendor on public.products (vendor_id);
create index idx_products_published on public.products (status, category_id) where status = 'PUBLISHED';
create index idx_products_title_trgm on public.products using gin (title gin_trgm_ops);

alter table public.products enable row level security;

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

create trigger trg_products_guard
  before update on public.products
  for each row execute function public.guard_product_transitions();

-- ---------------------------------------------------------------------------
-- Policies RLS produits
-- ---------------------------------------------------------------------------
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

create policy "products_insert_own"
  on public.products for insert
  with check (
    exists (
      select 1 from public.vendors v
      where v.id = vendor_id and v.user_id = auth.uid() and v.status = 'ACTIVE'
    )
    and status = 'DRAFT'
  );

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
create table public.product_files (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.products (id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type       text not null,
  version         integer not null default 1,
  created_at      timestamptz not null default now()
);

create index idx_product_files_product on public.product_files (product_id);

alter table public.product_files enable row level security;

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
