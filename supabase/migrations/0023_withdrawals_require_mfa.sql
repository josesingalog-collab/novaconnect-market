-- Les retraits touchent aux fonds : toute écriture initiée par un utilisateur
-- exige une session AAL2 et un profil ACTIVE, y compris via RPC direct.
create or replace function public.guard_withdrawal_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  claims jsonb;
begin
  claims := coalesce(current_setting('request.jwt.claims', true)::jsonb, '{}'::jsonb);
  if claims ->> 'role' = 'service_role' then
    if TG_OP = 'DELETE' then return old; end if;
    return new;
  end if;
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if claims ->> 'aal' <> 'aal2' then
    raise exception 'Vérification en deux étapes requise';
  end if;
  if not exists (
    select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE'
  ) then
    raise exception 'Compte inactif';
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists trg_withdrawals_require_mfa on public.withdrawals;
create trigger trg_withdrawals_require_mfa
  before insert or update or delete on public.withdrawals
  for each row execute function public.guard_withdrawal_write();
