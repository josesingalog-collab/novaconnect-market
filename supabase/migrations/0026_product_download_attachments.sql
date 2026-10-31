-- Chaque produit peut contenir jusqu'à trois pièces jointes distinctes.
-- Les fichiers sont figés dès la première vente afin de protéger l'acheteur.
create or replace function public.guard_product_file_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
begin
  if (select count(*) from public.product_files where product_id = new.product_id) >= 3 then
    raise exception 'Un produit ne peut contenir que trois fichiers';
  end if;
  if exists (select 1 from public.order_items where product_id = new.product_id) then
    raise exception 'Le fichier d''un produit vendu est immuable';
  end if;

  claims := coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
  if claims ->> 'role' = 'service_role' then return new; end if;
  raise exception 'Les fichiers produits doivent être créés par le serveur';
end;
$$;

create or replace function public.create_download_grant(
  p_order_item uuid,
  p_product_file uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_row record;
begin
  v_user := auth.uid();
  if v_user is null then raise exception 'Connexion requise'; end if;

  select
    o.buyer_id,
    oi.vendor_id,
    o.status as order_status,
    pf.id as file_id,
    pf.storage_path,
    pf.file_name,
    pf.mime_type
  into v_row
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.product_files pf on pf.id = p_product_file and pf.product_id = oi.product_id
  where oi.id = p_order_item;

  if not found then raise exception 'Fichier ou commande introuvable'; end if;
  if v_row.buyer_id = v_user and v_row.order_status = 'PAID' then
    null;
  elsif exists (
    select 1 from public.vendors v
    where v.id = v_row.vendor_id and v.user_id = v_user and v.status = 'ACTIVE'
  ) or public.is_admin() then
    null;
  else
    raise exception 'Téléchargement non autorisé';
  end if;

  insert into public.downloads (user_id, order_item_id, product_file_id)
  values (v_user, p_order_item, v_row.file_id);

  return jsonb_build_object(
    'storage_path', v_row.storage_path,
    'file_name', v_row.file_name,
    'mime_type', v_row.mime_type
  )::json;
end;
$$;

revoke all on function public.create_download_grant(uuid, uuid) from public, anon;
grant execute on function public.create_download_grant(uuid, uuid) to authenticated, service_role;

create or replace function public.list_order_item_files(p_order_item uuid)
returns table (
  id uuid,
  file_name text,
  file_size_bytes bigint,
  mime_type text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.id = p_order_item and o.buyer_id = auth.uid() and o.status = 'PAID'
  ) then
    raise exception 'Téléchargement non autorisé';
  end if;

  return query
  select pf.id, pf.file_name, pf.file_size_bytes, pf.mime_type
  from public.product_files pf
  join public.order_items oi on oi.product_id = pf.product_id
  where oi.id = p_order_item
  order by pf.created_at asc;
end;
$$;

revoke all on function public.list_order_item_files(uuid) from public, anon;
grant execute on function public.list_order_item_files(uuid) to authenticated, service_role;
