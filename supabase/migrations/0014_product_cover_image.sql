-- ============================================================================
-- NOVACONNECT MARKET — Migration 0014
-- Images de couverture : colonne thumbnail_path sur products
-- ============================================================================
-- Ajoute une colonne nullable thumbnail_path sur products.
-- Stocke le chemin Storage complet :
--   {user_id}/products/{product_id}/cover/{uuid}.{ext}
-- thumbnail_url reste inchangé pour compatibilité rétroactive.
-- Le client ne fournit JAMAIS user_id, vendor_id ou storage_path.
-- Le serveur dérive tout depuis auth.uid().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DROP (idempotence — re-exécution sans danger)
-- ---------------------------------------------------------------------------
drop policy if exists "product_files_owner_insert" on storage.objects;
drop policy if exists "product_files_owner_select" on storage.objects;
drop policy if exists "product_files_owner_delete" on storage.objects;

-- ---------------------------------------------------------------------------
-- ALTER TABLE : ajout de thumbnail_path
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists thumbnail_path text;

create index if not exists idx_products_thumbnail_path on public.products (thumbnail_path);

-- ---------------------------------------------------------------------------
-- INSERT : un vendeur peut uploader une couverture dans son propre dossier.
--
-- Le chemin est généré entièrement côté serveur :
--   {user_id}/products/{product_id}/cover/{uuid}.{ext}
--
-- storage.foldername(name) retourne un tableau des segments du chemin.
-- [1] est le premier dossier, qui doit correspondre à auth.uid().
-- Cela empêche un vendeur d'uploader dans le dossier d'un autre vendeur.
-- Le bucket_id vérifie qu'on ne cible que product-files.
-- ---------------------------------------------------------------------------
create policy "product_files_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'product-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- SELECT : un vendeur peut lire les fichiers de ses propres produits,
-- y compris les images de couverture.
--
-- Deux cas :
--   1. Fichier numérique dans la table product_files
--   2. Image de couverture dans products.thumbnail_path
--
-- Dans les deux cas, on vérifie que le produit appartient au vendeur
-- connecté (via vendors.user_id) ou que l'utilisateur est ADMIN.
-- ---------------------------------------------------------------------------
create policy "product_files_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'product-files'
    and (
      exists (
        select 1
        from public.product_files pf
        join public.products p  on p.id  = pf.product_id
        join public.vendors    v  on v.id  = p.vendor_id
        where pf.storage_path = name
          and (v.user_id = auth.uid() or public.is_admin())
      )
      or exists (
        select 1
        from public.products p
        join public.vendors    v on v.id = p.vendor_id
        where p.thumbnail_path = name
          and (v.user_id = auth.uid() or public.is_admin())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- DELETE : un vendeur peut supprimer ses fichiers, y compris couvertures.
--
-- Même logique que SELECT : storage_path = name, vérifié via
-- product_files OU products.thumbnail_path.
-- ---------------------------------------------------------------------------
create policy "product_files_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-files'
    and (
      exists (
        select 1
        from public.product_files pf
        join public.products p on p.id = pf.product_id
        join public.vendors v on v.id = p.vendor_id
        where pf.storage_path = name
          and (v.user_id = auth.uid() or public.is_admin())
      )
      or exists (
        select 1
        from public.products p
        join public.vendors v on v.id = p.vendor_id
        where p.thumbnail_path = name
          and (v.user_id = auth.uid() or public.is_admin())
      )
    )
  );