-- ============================================================================
-- 0018 — Modération administrateur des boutiques vendeurs.
-- Transitions autorisées :
--   PENDING → ACTIVE | REJECTED
--   ACTIVE → SUSPENDED
--   SUSPENDED → ACTIVE
-- ============================================================================

-- Les RPC SECURITY DEFINER ci-dessous authentifient et autorisent l'admin avec
-- is_admin(). Cette même autorisation est nécessaire au trigger existant.
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
    if jwt_role <> 'service_role'
       and not (current_user = session_user and current_user in ('postgres', 'supabase_admin'))
       and not public.is_admin() then
      raise exception 'Seule l''administration peut modifier le statut ou la commission d''une boutique';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.admin_transition_vendor(
  p_vendor uuid,
  p_target public.vendor_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.vendor_status;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if not public.is_admin() then
    raise exception 'Accès admin requis';
  end if;

  select status into v_current
  from public.vendors
  where id = p_vendor
  for update;

  if v_current is null then
    raise exception 'Boutique introuvable';
  end if;

  if not (
    (v_current = 'PENDING' and p_target in ('ACTIVE', 'REJECTED'))
    or (v_current = 'ACTIVE' and p_target = 'SUSPENDED')
    or (v_current = 'SUSPENDED' and p_target = 'ACTIVE')
  ) then
    raise exception 'Transition non autorisee : % vers %', v_current, p_target;
  end if;

  update public.vendors
  set status = p_target
  where id = p_vendor;
end;
$$;

revoke all on function public.admin_transition_vendor(uuid, public.vendor_status) from public, anon;
grant execute on function public.admin_transition_vendor(uuid, public.vendor_status)
  to authenticated, service_role;
