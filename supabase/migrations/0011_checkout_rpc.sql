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
