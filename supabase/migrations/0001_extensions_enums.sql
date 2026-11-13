-- ============================================================================
-- SAVPAY — Migration 0001
-- Extensions, types énumérés, table de configuration, helper updated_at
-- ============================================================================

create extension if not exists citext;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Types énumérés métier
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('BUYER', 'VENDOR', 'ADMIN');
create type public.account_status as enum ('ACTIVE', 'SUSPENDED');
create type public.vendor_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
create type public.product_status as enum ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');
create type public.order_status as enum ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
create type public.payment_status as enum ('PENDING', 'PAID', 'FAILED', 'CANCELLED');
create type public.withdrawal_status as enum ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED');
create type public.ledger_entry_type as enum ('SALE_CREDIT', 'WITHDRAWAL_DEBIT', 'REFUND_DEBIT', 'ADJUSTMENT');

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
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- Valeurs initiales alignées avec lib/config.ts :
--   commission 10 % = 1000 bps ; seuil retrait 20,00 USD ; CDF désactivé.
insert into public.app_settings (key, value) values
  ('platform_commission_bps', '1000'),
  ('min_withdrawal_minor', '{"USD": "2000"}')
on conflict (key) do nothing;
