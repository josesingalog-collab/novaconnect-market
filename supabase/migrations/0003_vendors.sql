-- ============================================================================
-- SAVPAY — Migration 0003
-- Boutiques vendeurs + garde sur statut/commission
-- ============================================================================

create table public.vendors (
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

create index idx_vendors_status on public.vendors (status);

alter table public.vendors enable row level security;

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

create trigger trg_vendors_guard
  before update on public.vendors
  for each row execute function public.guard_vendor_sensitive();

-- ---------------------------------------------------------------------------
-- Policies RLS boutiques
-- ---------------------------------------------------------------------------
-- Lecture publique des boutiques actives (vitrine marketplace) ;
-- le propriétaire voit toujours la sienne (même PENDING).
create policy "vendors_select_public_or_own"
  on public.vendors for select
  using (status = 'ACTIVE' or user_id = auth.uid() or public.is_admin());

-- Un utilisateur crée SA boutique (1 max via unique user_id), toujours PENDING.
create policy "vendors_insert_own"
  on public.vendors for insert
  with check (
    user_id = auth.uid()
    and status = 'PENDING'
  );

-- Le propriétaire édite sa vitrine ; le guard bloque statut/commission.
create policy "vendors_update_own"
  on public.vendors for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
