-- ============================================================================
-- NOVACONNECT MARKET — Migration 0008
-- Audit log, avis vérifiés, coupons, abonnements (squelette V1),
-- bucket Storage privé, câblage des audits.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Journal d'audit des actions sensibles (§44)
-- Écritures : triggers / serveur uniquement. Lecture : ADMIN.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_role  text,
  action      text not null,
  entity_type text,
  entity_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_logs_action on public.audit_logs (action, created_at desc);
create index idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select_admin"
  on public.audit_logs for select
  using (public.is_admin());
-- INSERT : triggers / service_role uniquement (aucune policy client).

-- Câblage de l'audit des retraits (fonction définie en 0007)
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

create trigger trg_products_audit
  after update on public.products
  for each row execute function public.audit_product_status();

-- ---------------------------------------------------------------------------
-- Avis — autorisés UNIQUEMENT après achat vérifié (commande PAID).
-- ---------------------------------------------------------------------------
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index idx_reviews_product on public.reviews (product_id);

alter table public.reviews enable row level security;

create trigger trg_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

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

create policy "reviews_update_own"
  on public.reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Coupons — structure prête, flux V1 minimal (création/gestion côté serveur).
-- ---------------------------------------------------------------------------
create table public.coupons (
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
create table public.plans (
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

create table public.subscriptions (
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
