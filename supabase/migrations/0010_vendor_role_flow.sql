-- ============================================================================
-- 0010 — FLUX VENDEUR (v2) : promotion liée explicitement au flux
--        vendors INSERT/DELETE → rôle du PROPRIÉTAIRE uniquement
-- ============================================================================
-- Un BUYER qui crée SA boutique devient VENDOR côté serveur : le client
-- n'envoie jamais `role`. La bascule est signée dans un GUC transactionnel
-- ('app.vendor_role_flow') que la garde profiles exige pour accepter la
-- transition — impossible à forger depuis l'API (profondeur de trigger ≥ 2).
-- ADMIN et STATUS restent totalement hors de portée de ce flux.
-- Idempotent : réexécution sans danger.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- GARDE PROFILS ÉTENDUE v2 :
--   - chemins historiques inchangés : service_role / session postgres réelle ;
--   - unique exception : bascule BUYER↔VENDOR du profil SIGNÉ dans le GUC,
--     posé uniquement par les triggers vendeur ci-dessous.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_sensitive()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
  signed_profile_id text;
begin
  jwt_role := coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '');

  if jwt_role = 'service_role'
     or (current_user = session_user and current_user in ('postgres', 'supabase_admin')) then
    return new;
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    signed_profile_id := coalesce(current_setting('app.vendor_role_flow', true), '');

    if not (
      pg_trigger_depth() > 1
      and current_user = 'postgres'
      and current_user <> session_user
      and signed_profile_id = new.id::text
      and (
        (old.role = 'BUYER' and new.role = 'VENDOR')
        or (old.role = 'VENDOR' and new.role = 'BUYER')
      )
      and new.status = old.status
    ) then
      raise exception 'Le rôle et le statut ne peuvent pas etre modifies directement';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- PROMOTION : création de SA boutique → VENDOR (BUYER uniquement)
-- ---------------------------------------------------------------------------
create or replace function public.promote_to_vendor_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.vendor_role_flow', new.user_id::text, true);

  update public.profiles
  set role = 'VENDOR'
  where id = new.user_id
    and role = 'BUYER';

  return new;
end;
$$;

drop trigger if exists trg_vendors_promote_role on public.vendors;
create trigger trg_vendors_promote_role
  after insert on public.vendors
  for each row execute function public.promote_to_vendor_role();

-- ---------------------------------------------------------------------------
-- DÉMOTION : suppression de la boutique → BUYER (VENDOR uniquement, jamais
-- ADMIN). No-op silencieux si le profil a déjà disparu (cascade compte).
-- ---------------------------------------------------------------------------
create or replace function public.demote_from_vendor_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.vendor_role_flow', old.user_id::text, true);

  update public.profiles
  set role = 'BUYER'
  where id = old.user_id
    and role = 'VENDOR';

  return old;
end;
$$;

drop trigger if exists trg_vendors_demote_role on public.vendors;
create trigger trg_vendors_demote_role
  after delete on public.vendors
  for each row execute function public.demote_from_vendor_role();
