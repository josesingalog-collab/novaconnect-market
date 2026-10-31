-- La publication directe reste possible, mais les prérequis sont contrôlés
-- dans PostgreSQL afin de ne pas pouvoir être contournés via l'API REST.
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
  if jwt_role = 'service_role'
     or (current_user = session_user and current_user in ('postgres', 'supabase_admin')) then
    return new;
  end if;

  select v.user_id = auth.uid() and v.status = 'ACTIVE'
  into is_owner
  from public.vendors v
  where v.id = new.vendor_id;
  if is_owner is not true then raise exception 'Produit non autorise'; end if;
  if new.vendor_id is distinct from old.vendor_id then raise exception 'vendor_id immuable'; end if;
  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Seule l''administration peut definir le motif de rejet';
  end if;
  if new.thumbnail_path is distinct from old.thumbnail_path
     and new.thumbnail_path is not null
     and new.thumbnail_path not like (
       (select user_id::text from public.vendors where id = new.vendor_id)
       || '/products/' || new.id::text || '/cover/%'
     ) then
    raise exception 'Chemin de couverture non autorise';
  end if;
  if new.status = 'ARCHIVED' then raise exception 'Seule l''administration peut archiver un produit'; end if;

  if not (
    (old.status = 'DRAFT' and new.status in ('DRAFT', 'PUBLISHED'))
    or (old.status = 'PUBLISHED' and new.status in ('PUBLISHED', 'DRAFT'))
    or (old.status = 'REJECTED' and new.status in ('REJECTED', 'PUBLISHED'))
    or old.status = new.status
  ) then
    raise exception 'Transition de statut non autorisee';
  end if;

  if new.status = 'PUBLISHED' and old.status is distinct from 'PUBLISHED' then
    if new.product_type in ('DIGITAL', 'PHYSICAL') and (
      new.thumbnail_path is null
      or not exists (
        select 1 from storage.objects
        where bucket_id = 'product-files' and name = new.thumbnail_path
      )
    ) then
      raise exception 'Une image de couverture est requise pour publier ce produit';
    end if;
    if new.product_type = 'DIGITAL' and not exists (
      select 1
      from public.product_files pf
      join storage.objects so on so.bucket_id = 'product-files' and so.name = pf.storage_path
      where pf.product_id = new.id
    ) then
      raise exception 'Un fichier numerique est requis pour publier ce produit';
    end if;
  end if;

  -- Une vente fige définitivement le contenu livré à l'acheteur.
  if exists (select 1 from public.order_items where product_id = old.id) and (
    new.title is distinct from old.title
    or new.slug is distinct from old.slug
    or new.description is distinct from old.description
    or new.short_description is distinct from old.short_description
    or new.price is distinct from old.price
    or new.currency is distinct from old.currency
    or new.category_id is distinct from old.category_id
    or new.thumbnail_url is distinct from old.thumbnail_url
    or new.thumbnail_path is distinct from old.thumbnail_path
    or new.product_type is distinct from old.product_type
  ) then
    raise exception 'Le contenu d''un produit vendu est immuable';
  end if;

  return new;
end;
$$;

create or replace function public.guard_product_file_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('request.jwt.claims', true)::json ->> 'role' = 'service_role' then
    return new;
  end if;
  raise exception 'Les fichiers produits doivent être créés par le serveur';
end;
$$;

drop trigger if exists trg_product_files_guard_insert on public.product_files;
create trigger trg_product_files_guard_insert
  before insert on public.product_files
  for each row execute function public.guard_product_file_insert();

-- Les uploads passent par les routes serveur après vérification du propriétaire.
-- Les clients authentifiés ne peuvent donc pas créer de métadonnées ou d'objets
-- Storage arbitraires via l'API Supabase.
drop policy if exists "product_files_insert_owner" on public.product_files;
drop policy if exists "product_files_delete_owner" on public.product_files;
drop policy if exists "product_files_owner_insert" on storage.objects;
drop policy if exists "product_files_owner_delete" on storage.objects;
