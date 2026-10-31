-- Les vendeurs publient directement leurs propres produits.
-- La modération PENDING_REVIEW/REJECTED n'est plus utilisée par le parcours vendeur.
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

  select v.user_id = auth.uid() into is_owner from public.vendors v where v.id = new.vendor_id;
  if is_owner is not true then raise exception 'Produit non autorise'; end if;
  if new.vendor_id is distinct from old.vendor_id then raise exception 'vendor_id immuable'; end if;
  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Seule l''administration peut definir le motif de rejet';
  end if;
  if new.status = 'ARCHIVED' then raise exception 'Seule l''administration peut archiver un produit'; end if;
  if not (
    (old.status = 'DRAFT' and new.status in ('DRAFT', 'PUBLISHED'))
    or (old.status = 'PUBLISHED' and new.status in ('PUBLISHED', 'DRAFT'))
    or old.status = new.status
  ) then
    raise exception 'Transition de statut non autorisee';
  end if;
  return new;
end;
$$;
