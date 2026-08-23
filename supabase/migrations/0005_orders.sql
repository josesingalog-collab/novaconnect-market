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
create table public.orders (
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

create index idx_orders_buyer on public.orders (buyer_id, created_at desc);
create index idx_orders_status on public.orders (status);

alter table public.orders enable row level security;

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create policy "orders_select_own_or_admin"
  on public.orders for select
  using (buyer_id = auth.uid() or public.is_admin());
-- INSERT/UPDATE/DELETE : aucune policy client → service_role uniquement.

-- ---------------------------------------------------------------------------
-- Lignes de commande — SNAPSHOT immuable au moment de l'achat (§17/§19) :
-- prix, titre, taux de commission et montants figés pour toujours.
-- Contrainte d'intégrité : commission + part vendeur = total ligne.
-- ---------------------------------------------------------------------------
create table public.order_items (
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

create index idx_order_items_order on public.order_items (order_id);
create index idx_order_items_vendor on public.order_items (vendor_id);

alter table public.order_items enable row level security;

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
create table public.payments (
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

create unique index uniq_payments_provider_reference
  on public.payments (provider, provider_reference)
  where provider_reference is not null;

create index idx_payments_order on public.payments (order_id);

alter table public.payments enable row level security;
-- Aucune policy : table 100 % serveur (webhooks + back-office).

-- ---------------------------------------------------------------------------
-- Journal brut des webhooks — idempotence via (provider, event_hash).
-- ---------------------------------------------------------------------------
create table public.payment_events (
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
