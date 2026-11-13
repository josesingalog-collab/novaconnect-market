-- ============================================================================
-- SAVPAY — Migration 0016
-- Transitions admin sécurisées pour les retraits :
--   PENDING → APPROVED → PROCESSING → PAID
--   PENDING → REJECTED
-- Validation serveur stricte de payout_details.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TRANSITIONS ADMIN — RPCs sécurisés, ADMIN ONLY
-- ---------------------------------------------------------------------------

-- Approuver un retrait PENDING (→ APPROVED uniquement)
create or replace function public.approve_withdrawal(p_withdrawal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_current_status public.withdrawal_status;
begin
  -- Vérification auth.uid()
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'Authentification requise';
  end if;

  -- Vérification profil ADMIN et ACTIVE
  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  -- Récupérer le statut actuel et vérifier la transition
  select status into v_current_status
  from public.withdrawals
  where id = p_withdrawal
  for update;

  if v_current_status is null then
    raise exception 'Retrait introuvable';
  end if;

  if v_current_status <> 'PENDING' then
    raise exception 'Transition non autorisee : statut actuel %', v_current_status;
  end if;

  update public.withdrawals
  set status = 'APPROVED',
      processed_by = v_admin_id,
      processed_at = now()
  where id = p_withdrawal;

  if not found then
    raise exception 'Retrait introuvable';
  end if;
end;
$$;

revoke all on function public.approve_withdrawal(uuid) from public, anon;
grant execute on function public.approve_withdrawal(uuid) to authenticated, service_role;

-- Passer un retrait APPROVED à PROCESSING
create or replace function public.process_withdrawal(p_withdrawal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_current_status public.withdrawal_status;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select status into v_current_status
  from public.withdrawals
  where id = p_withdrawal
  for update;

  if v_current_status is null then
    raise exception 'Retrait introuvable';
  end if;

  if v_current_status <> 'APPROVED' then
    raise exception 'Transition non autorisee : statut actuel %', v_current_status;
  end if;

  update public.withdrawals
  set status = 'PROCESSING',
      processed_by = v_admin_id,
      processed_at = now()
  where id = p_withdrawal;

  if not found then
    raise exception 'Retrait introuvable';
  end if;
end;
$$;

revoke all on function public.process_withdrawal(uuid) from public, anon;
grant execute on function public.process_withdrawal(uuid) to authenticated, service_role;

-- Passer un retrait PROCESSING à PAID (déclenche le trigger trg_withdrawals_paid)
create or replace function public.mark_withdrawal_paid(p_withdrawal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_current_status public.withdrawal_status;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select status into v_current_status
  from public.withdrawals
  where id = p_withdrawal
  for update;

  if v_current_status is null then
    raise exception 'Retrait introuvable';
  end if;

  if v_current_status <> 'PROCESSING' then
    raise exception 'Transition non autorisee : statut actuel %', v_current_status;
  end if;

  update public.withdrawals
  set status = 'PAID',
      processed_by = v_admin_id,
      processed_at = now()
  where id = p_withdrawal;

  if not found then
    raise exception 'Retrait introuvable';
  end if;
end;
$$;

revoke all on function public.mark_withdrawal_paid(uuid) from public, anon;
grant execute on function public.mark_withdrawal_paid(uuid) to authenticated, service_role;

-- Rejeter un retrait PENDING (→ REJECTED uniquement)
create or replace function public.reject_withdrawal(p_withdrawal uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_id uuid;
  v_current_status public.withdrawal_status;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select status into v_current_status
  from public.withdrawals
  where id = p_withdrawal
  for update;

  if v_current_status is null then
    raise exception 'Retrait introuvable';
  end if;

  if v_current_status <> 'PENDING' then
    raise exception 'Transition non autorisee : statut actuel %', v_current_status;
  end if;

  update public.withdrawals
  set status = 'REJECTED',
      processed_by = v_admin_id,
      processed_at = now()
  where id = p_withdrawal;

  if not found then
    raise exception 'Retrait introuvable';
  end if;
end;
$$;

revoke all on function public.reject_withdrawal(uuid) from public, anon;
grant execute on function public.reject_withdrawal(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- VALIDATION SERVEUR STRICTE DE PAYOUT_DETAILS
-- Ajoutée dans request_withdrawal pour valider la structure de payout_details
-- selon la méthode choisie.
-- ---------------------------------------------------------------------------
create or replace function public.validate_withdrawal_payout(
  p_method text,
  p_payout jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keys text[];
begin
  if p_payout is null then
    raise exception 'payout_details est requis';
  end if;

  v_keys := array(SELECT jsonb_object_keys(p_payout));

  if p_method = 'mobile_money' then
    if p_payout ->> 'phone' is null or p_payout ->> 'phone' = '' then
      raise exception 'phone obligatoire pour mobile_money';
    end if;
    if p_payout ->> 'operator' is null or p_payout ->> 'operator' = '' then
      raise exception 'operator obligatoire pour mobile_money';
    end if;
    if COALESCE(array_length(v_keys, 1), 0) <> 2
       or not (v_keys @> array['phone', 'operator']::text[])
       or v_keys @> array['account_number', 'account_name', 'bank_name']::text[] then
      raise exception 'Structure payout_details invalide pour mobile_money';
    end if;

  elsif p_method = 'bank' then
    if p_payout ->> 'account_number' is null or p_payout ->> 'account_number' = '' then
      raise exception 'account_number obligatoire pour bank';
    end if;
    if p_payout ->> 'account_name' is null or p_payout ->> 'account_name' = '' then
      raise exception 'account_name obligatoire pour bank';
    end if;
    if p_payout ->> 'bank_name' is null or p_payout ->> 'bank_name' = '' then
      raise exception 'bank_name obligatoire pour bank';
    end if;
    if COALESCE(array_length(v_keys, 1), 0) <> 3
       or not (v_keys @> array['account_number', 'account_name', 'bank_name']::text[])
       or v_keys @> array['phone', 'operator']::text[] then
      raise exception 'Structure payout_details invalide pour bank';
    end if;

  else
    raise exception 'Méthode de paiement invalide : %', p_method;
  end if;
end;
$$;

revoke all on function public.validate_withdrawal_payout(text, jsonb) from public, anon;
grant execute on function public.validate_withdrawal_payout(text, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- MISE À JOUR DE request_withdrawal : validation payout_details
-- ---------------------------------------------------------------------------
-- La fonction request_withdrawal existante est mise à jour pour valider
-- la structure de payout_details avant l'insert.
-- On supprime et recrée la fonction avec la validation ajoutée.
--
-- NB : cette mise à jour préserve toute la logique existante (concurrence,
-- seuil, solde disponible) et ajoute uniquement la validation payout_details.
-- ---------------------------------------------------------------------------
create or replace function public.request_withdrawal(
  p_currency    char(3),
  p_amount      numeric(18,2),
  p_method      text,
  p_payout      jsonb
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

  -- Validation serveur stricte de payout_details
  perform public.validate_withdrawal_payout(p_method, p_payout);

  select id into v_vendor
  from public.vendors
  where user_id = auth.uid() and status = 'ACTIVE';

  if v_vendor is null then
    raise exception 'Boutique introuvable ou non active';
  end if;

  perform 1 from public.vendors where id = v_vendor for update;

  select value into v_cfg
  from public.app_settings
  where key = 'min_withdrawal_minor';

  if v_cfg is null or v_cfg ->> p_currency is null then
    raise exception 'Retraits indisponibles pour cette devise';
  end if;

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
