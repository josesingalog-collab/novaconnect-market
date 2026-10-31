-- Les boutiques sont publiques dès leur création. Les boutiques suspendues
-- restent suspendues ; seules celles en attente de l'ancien workflow sont activées.
alter table public.vendors alter column status set default 'ACTIVE';

drop policy if exists "vendors_insert_own" on public.vendors;
create policy "vendors_insert_own"
  on public.vendors for insert
  with check (
    user_id = auth.uid()
    and status = 'ACTIVE'
  );

alter table public.vendors disable trigger trg_vendors_guard;
update public.vendors
set status = 'ACTIVE'
where status = 'PENDING';
alter table public.vendors enable trigger trg_vendors_guard;
