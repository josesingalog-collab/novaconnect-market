-- ============================================================================
-- SAVPAY — Migration 0027
-- Notifications in-app S5+ (Phase 9) : table destinataire, RLS, garde
-- read_at seul, fonction notify_user definer, triggers émetteurs
-- (commande payée, statut retrait, statut produit, statut boutique).
--
-- La table n'a AUCUNE policy d'insertion : seule la base (triggers definer)
-- et service_role créent des notifications. Le client ne peut qu'UI-lire,
-- marquer lu, ou supprimer ses propres lignes.
-- ============================================================================

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  metadata   jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  check (
    type in (
      'order.paid',
      'withdrawal.approved',
      'withdrawal.processing',
      'withdrawal.paid',
      'withdrawal.rejected',
      'withdrawal.cancelled',
      'product.published',
      'product.rejected',
    'vendor.approved',
    'vendor.suspended',
    'vendor.rejected',
    'vendor.sale'
    )
  )
);

create index idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index idx_notifications_user_unread
  on public.notifications (user_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_delete_own"
  on public.notifications for delete
  using (user_id = auth.uid());
-- INSERT : triggers definer / service_role uniquement (aucune policy client).

-- ---------------------------------------------------------------------------
-- Garde : le destinataire ne peut QUE marquer sa notification lue.
-- Le payload (destinataire, type, titre, corps, lien) est immuable.
-- ---------------------------------------------------------------------------
create or replace function public.guard_notification_payload()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.link is distinct from old.link
     or new.metadata is distinct from old.metadata
     or new.created_at is distinct from old.created_at then
    raise exception 'Seul read_at peut être modifié sur une notification';
  end if;
  return new;
end;
$$;

create trigger trg_notifications_guard
  before update on public.notifications
  for each row execute function public.guard_notification_payload();

-- ---------------------------------------------------------------------------
-- notify_user : unique point d'écriture applicatif. Appelée par les triggers
-- definer ci-dessous ; silencieuse si destinataire inconnu (null).
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text default null,
  p_link    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

revoke all on function public.notify_user(uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.notify_user(uuid, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Commande payée → notification acheteur (passage PAID unique) + notification
-- « nouvelle vente » à chaque vendeur d'une ligne de commande.
-- Tirée dans transaction definer de confirm_order_payment.
-- ---------------------------------------------------------------------------
create or replace function public.notify_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_user_id uuid;
begin
  if new.status::text = 'PAID' and old.status::text is distinct from 'PAID' then
    perform public.notify_user(
      new.buyer_id,
      'order.paid',
      'Paiement confirmé',
      'Votre commande est confirmée. Vos fichiers sont disponibles au téléchargement.',
      '/dashboard/commandes'
    );

    for v_item in
      select oi.vendor_id, oi.product_title, oi.vendor_amount, oi.currency
      from public.order_items oi
      where oi.order_id = new.id
    loop
      select user_id into v_user_id
      from public.vendors
      where id = v_item.vendor_id;

      perform public.notify_user(
        v_user_id,
        'vendor.sale',
        'Nouvelle vente',
        v_item.product_title || ' : votre part vendeur ' ||
          to_char(v_item.vendor_amount, 'FM999999999990.00') || ' ' || v_item.currency ||
          ' vient d''être créditée sur votre solde.',
        '/vendor/finances'
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_notify_paid on public.orders;
create trigger trg_orders_notify_paid
  after update on public.orders
  for each row execute function public.notify_order_paid();

-- ---------------------------------------------------------------------------
-- Statut retrait → notification vendeur (APPROVED / PROCESSING / PAID /
-- REJECTED / CANCELLED ; PENDING initial exclu car statut d'insertion).
-- ---------------------------------------------------------------------------
create or replace function public.notify_withdrawal_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_title   text;
  v_body    text;
begin
  if new.status::text is distinct from old.status::text then
    select user_id into v_user_id
    from public.vendors
    where id = new.vendor_id;

    if v_user_id is not null and new.status::text <> 'PENDING' then
      v_title := case new.status::text
        when 'APPROVED'   then 'Retrait approuvé'
        when 'PROCESSING' then 'Retrait en cours de traitement'
        when 'PAID'       then 'Retrait payé'
        when 'REJECTED'   then 'Retrait refusé'
        when 'CANCELLED'  then 'Retrait annulé'
        else 'Retrait mis à jour'
      end;
      v_body := case new.status::text
        when 'APPROVED'   then 'Votre demande de retrait est approuvée par l''administration.'
        when 'PROCESSING' then 'Votre retrait est en cours de traitement.'
        when 'PAID'       then 'Votre retrait a été payé : le montant a été débité de votre solde.'
        when 'REJECTED'   then 'Votre demande de retrait a été refusée.'
        when 'CANCELLED'  then 'Votre demande de retrait a été annulée.'
        else null
      end;

      perform public.notify_user(
        v_user_id,
        'withdrawal.' || lower(new.status::text),
        v_title,
        v_body,
        '/vendor/finances'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_withdrawals_notify on public.withdrawals;
create trigger trg_withdrawals_notify
  after update on public.withdrawals
  for each row execute function public.notify_withdrawal_status();

-- ---------------------------------------------------------------------------
-- Statut produit → notification vendeur (PUBLISHED / REJECTED avec motif).
-- ---------------------------------------------------------------------------
create or replace function public.notify_product_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if new.status::text is distinct from old.status::text then
    select v.user_id into v_user_id
    from public.products p
    join public.vendors v on v.id = p.vendor_id
    where p.id = new.id;

    if v_user_id is not null then
      if new.status::text = 'PUBLISHED' then
        perform public.notify_user(
          v_user_id,
          'product.published',
          'Produit publié',
          'Votre produit est désormais en ligne dans le catalogue public.',
          '/vendor/catalogue'
        );
      elsif new.status::text = 'REJECTED' then
        perform public.notify_user(
          v_user_id,
          'product.rejected',
          'Produit refusé',
          coalesce(new.rejection_reason,
                   'Votre produit a été refusé. Corrigez-le avant de le republier.'),
          '/vendor/catalogue'
        );
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_notify on public.products;
create trigger trg_products_notify
  after update on public.products
  for each row execute function public.notify_product_status();

-- ---------------------------------------------------------------------------
-- Statut boutique → notification vendeur (ACTIVE / SUSPENDED / REJECTED).
-- PENDING : statut d'insertion initial → pas de notification.
-- ---------------------------------------------------------------------------
create or replace function public.notify_vendor_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text is distinct from old.status::text then
    if new.status::text = 'ACTIVE' then
      perform public.notify_user(
        new.user_id,
        'vendor.approved',
        'Boutique activée',
        'Votre boutique est active : vous pouvez publier vos produits.',
        '/vendor'
      );
    elsif new.status::text = 'SUSPENDED' then
      perform public.notify_user(
        new.user_id,
        'vendor.suspended',
        'Boutique suspendue',
        'Votre boutique a été suspendue par l''administration.',
        '/vendor'
      );
    elsif new.status::text = 'REJECTED' then
      perform public.notify_user(
        new.user_id,
        'vendor.rejected',
        'Boutique rejetée',
        'Votre boutique a été rejetée. Corrigez vos informations puis contactez l''administration.',
        '/vendor'
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_vendors_notifications on public.vendors;
create trigger trg_vendors_notifications
  after update on public.vendors
  for each row execute function public.notify_vendor_status();
