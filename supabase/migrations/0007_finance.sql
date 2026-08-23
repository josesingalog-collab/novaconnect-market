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

create table public.withdrawals (
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

create index idx_withdrawals_vendor on public.withdrawals (vendor_id, status);
create index idx_withdrawals_status on public.withdrawals (status);

alter table public.withdrawals enable row level security;

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
create table public.vendor_ledger_entries (
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

create index idx_ledger_vendor on public.vendor_ledger_entries (vendor_id, currency);

alter table public.vendor_ledger_entries enable row level security;

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
