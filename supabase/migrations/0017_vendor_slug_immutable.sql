-- ============================================================================
-- 0017 — Le slug vendeur est immuable après la création de la boutique.
-- ============================================================================

create or replace function public.guard_vendor_slug_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'Le slug d''une boutique ne peut pas être modifié après sa création';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_vendors_slug_immutable on public.vendors;
create trigger trg_vendors_slug_immutable
  before update on public.vendors
  for each row execute function public.guard_vendor_slug_immutable();
