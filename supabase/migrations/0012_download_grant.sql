-- ============================================================================
-- SAVPAY â€” Migration 0012
-- Livraison numÃ©rique : RPC `create_download_grant` â€” le DROIT de tÃ©lÃ©charger
-- est DÃ‰RIVÃ‰ (jamais stockÃ©) : commande PAID + acheteur = auth.uid(), ou
-- vendeur propriÃ©taire du fichier, ou admin. Chaque demande est journalisÃ©e
-- dans `downloads`. Le bucket `product-files` reste PRIVÃ‰ : la route serveur
-- seule forge une signed URL courte (120 s max).
-- ============================================================================

create or replace function public.create_download_grant(
  p_order_item uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user        uuid;
  v_row         record;
  v_file        record;
  v_vendor_id   uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Profil introuvable : connexion requise';
  end if;

  if not exists (
    select 1 from public.profiles where id = v_user and status = 'ACTIVE'
  ) then
    raise exception 'Profil introuvable : connexion requise';
  end if;

  -- Ligne de commande + sa commande + le fichier publiÃ© liÃ© au produit.
  select
    oi.id            as item_id,
    oi.vendor_id     as vendor_id,
    o.buyer_id       as buyer_id,
    o.status         as order_status
  into v_row
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = p_order_item;

  if not found then
    raise exception 'Commande ou ligne introuvable';
  end if;

  -- Droit dÃ©rivÃ© : acheteur d'une commande PAID, vendeur de la ligne, admin.
  if v_row.buyer_id = v_user and v_row.order_status = 'PAID' then
    null; -- autorisÃ©
  elsif exists (
    select 1 from public.vendors v
    where v.id = v_row.vendor_id
      and v.user_id = v_user
      and v.status = 'ACTIVE'
  ) then
    null; -- le vendeur peut rÃ©cupÃ©rer ses propres fichiers
  elsif public.is_admin() then
    null;
  else
    raise exception 'Téléchargement non autorisé';
  end if;

  -- Fichier courant du produit snapshot (version la plus rÃ©cente).
  select pf.storage_path, pf.file_name, pf.mime_type, pf.id as file_id
  into v_file
  from public.product_files pf
  where pf.product_id = (
    select product_id from public.order_items where id = p_order_item
  )
  order by pf.version desc
  limit 1;

  if not found then
    raise exception 'Fichier du produit introuvable';
  end if;

  -- Journal d'audit â€” une ligne par demande rÃ©ussie.
  insert into public.downloads (user_id, order_item_id, product_file_id)
  values (v_user, p_order_item, v_file.file_id);

  return jsonb_build_object(
    'storage_path', v_file.storage_path,
    'file_name',    v_file.file_name,
    'mime_type',    v_file.mime_type
  )::json;
end;
$$;

revoke all on function public.create_download_grant(uuid) from public, anon;
grant execute on function public.create_download_grant(uuid)
  to authenticated, service_role;
