-- ============================================================================
-- SAVPAY — Migration 0006
-- Journal des téléchargements (audit) — le DROIT de télécharger est dérivé
-- des order_items d'une commande PAID, jamais stocké ici.
-- ============================================================================

create table public.downloads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  order_item_id   uuid not null references public.order_items (id) on delete cascade,
  product_file_id uuid references public.product_files (id) on delete set null,
  downloaded_at   timestamptz not null default now()
);

create index idx_downloads_user on public.downloads (user_id, downloaded_at desc);
create index idx_downloads_order_item on public.downloads (order_item_id);

alter table public.downloads enable row level security;

-- L'utilisateur consulte l'historique de SES téléchargements.
create policy "downloads_select_own"
  on public.downloads for select
  using (user_id = auth.uid() or public.is_admin());
-- INSERT : service_role uniquement (route /api/downloads journalise).
