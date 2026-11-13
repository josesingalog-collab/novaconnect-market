-- ============================================================================
-- SAVPAY — Migration 0013
-- Storage : policies vendeur pour bucket privé product-files
-- ============================================================================
-- Le bucket `product-files` existe déjà (migration 0008) mais sans aucune
-- policy Storage. Sans policies, aucun upload ni lecture via l'API Storage
-- n'est possible. Cette migration ajoute les 3 policies nécessaires :
--   INSERT, SELECT, DELETE.
-- Pas de policy UPDATE : le remplacement se fait par INSERT d'une nouvelle
-- version (product_files.version + 1), l'ancien fichier reste orphelin.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- DROP POLICY (idempotence — re-exécution sans danger)
-- ---------------------------------------------------------------------------
drop policy if exists "product_files_owner_insert" on storage.objects;
drop policy if exists "product_files_owner_select" on storage.objects;
drop policy if exists "product_files_owner_delete" on storage.objects;

-- ---------------------------------------------------------------------------
-- INSERT : un vendeur peut uploader uniquement dans son propre dossier.
--
-- Le chemin est généré entièrement côté serveur :
--   {user_id}/products/{product_id}/{uuid}.{ext}
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
-- SELECT : un vendeur peut lire les fichiers de ses propres produits.
--
-- On vérifie que le storage_path de l'objet Storage correspond à une ligne
-- product_files, que le produit appartient à un vendeur dont l'user_id
-- correspond à auth.uid(), OU que l'utilisateur est ADMIN.
--
-- Jointure : storage.objects.name = product_files.storage_path
--            → products → vendors.user_id
-- ---------------------------------------------------------------------------
create policy "product_files_owner_select"
  on storage.objects for select
  using (
    bucket_id = 'product-files'
    and exists (
      select 1
      from public.product_files pf
      join public.products p on p.id = pf.product_id
      join public.vendors   v on v.id = p.vendor_id
      where pf.storage_path = name
        and (v.user_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- DELETE : un vendeur peut supprimer les fichiers de ses propres produits.
--
-- Même logique que SELECT : le storage_path doit correspondre à une ligne
-- product_files appartenant au vendeur connecté (ou à un admin).
-- ---------------------------------------------------------------------------
create policy "product_files_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-files'
    and exists (
      select 1
      from public.product_files pf
      join public.products p on p.id = pf.product_id
      join public.vendors   v on v.id = p.vendor_id
      where pf.storage_path = name
        and (v.user_id = auth.uid() or public.is_admin())
    )
  );