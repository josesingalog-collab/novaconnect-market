-- ============================================================================
-- SAVPAY — Migration 0015
-- Type de produit : enum product_type, colonne sur products
-- ============================================================================
-- Ajoute :
--   1. L'enum public.product_type ('SERVICE', 'PHYSICAL', 'DIGITAL')
--   2. La colonne product_type sur public.products (DEFAULT 'PHYSICAL')
--   3. Garde SQL : interdiction de modifier product_type après création
--
-- Stratégie pour produits existants :
--   Tous les produits existants reçoivent DEFAULT 'PHYSICAL'.
--   Cela préserve la compatibilité : le comportement actuel (couverture +
--   fichier requis pour soumission) reste inchangé.
--   Aucun produit n'est perdu ou reclassifié automatiquement.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Création de l'enum (idempotent)
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.product_type as enum ('SERVICE', 'PHYSICAL', 'DIGITAL');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Ajout de la colonne product_type (idempotent)
-- ---------------------------------------------------------------------------
-- DEFAULT 'PHYSICAL' garantit que tous les produits existants sont
-- classifiés comme PHYSIQUE sans perte de données.
-- Le type est fixé à la création et immuable (voir garde ci-dessous).
alter table public.products add column if not exists product_type public.product_type default 'PHYSICAL';

-- Index pour le filtrage par type (justifié pour le catalogue public futur)
create index if not exists idx_products_product_type on public.products (product_type);

-- ---------------------------------------------------------------------------
-- 3. Garde SQL : empêcher la modification de product_type
--    après la création du produit
-- ---------------------------------------------------------------------------
-- Le guard_product_transitions existe déjà. On met à jour pour ajouter
-- une vérification : si product_type change et le produit est PUBLISHED
-- ou ARCHIVED, refuser.
--
-- Pour les statuts DRAFT/REJECTED/PENDING_REVIEW, la modification est
-- techniquement autorisée mais non recommandée. Cette migration ne
-- bloque pas ce cas car le parcours n'est pas encore implémenté.
-- ---------------------------------------------------------------------------
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

  select v.user_id = auth.uid() into is_owner
  from public.vendors v
  where v.id = new.vendor_id;

  if is_owner is not true then
    raise exception 'Produit non autorise';
  end if;

  -- vendor_id IMMUTABLE pour le propriétaire : un vendeur ne peut
  -- jamais rattacher son produit à une autre boutique.
  if new.vendor_id is distinct from old.vendor_id then
    raise exception 'vendor_id immuable';
  end if;

  -- Interdictions absolues pour le vendeur
  if new.status in ('PUBLISHED', 'ARCHIVED') then
    raise exception 'Seule l''administration peut publier ou archiver un produit';
  end if;

  if new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'Seule l''administration peut definir le motif de rejet';
  end if;

  -- Transitions autorisées au vendeur
  if not (
    (old.status = 'DRAFT' and new.status = 'PENDING_REVIEW')
    or (old.status = 'PENDING_REVIEW' and new.status = 'DRAFT')
    or (old.status = 'REJECTED' and new.status = 'PENDING_REVIEW')
    or (old.status = new.status)
  ) then
    raise exception 'Transition de statut non autorisee';
  end if;

  -- Contenu modifiable seulement hors validation/publication
  if old.status not in ('DRAFT', 'REJECTED') and (
    new.title is distinct from old.title
    or new.slug is distinct from old.slug
    or new.description is distinct from old.description
    or new.short_description is distinct from old.short_description
    or new.price is distinct from old.price
    or new.currency is distinct from old.currency
    or new.category_id is distinct from old.category_id
    or new.thumbnail_url is distinct from old.thumbnail_url
    or new.thumbnail_path is distinct from old.thumbnail_path
    or new.product_type is distinct from old.product_type
  ) then
    raise exception 'Contenu fige pendant la validation ou la publication';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Mettre à jour la colonne existante pour que DEFAULT fonctionne
--    (PostgreSQL ne met pas à jour les lignes existantes avec un DEFAULT
--    ajouté après coup. On fait un UPDATE explicite.)
-- ---------------------------------------------------------------------------
update public.products
set product_type = 'PHYSICAL'
where product_type is null;

-- ---------------------------------------------------------------------------
-- 5. Rendre la colonne NOT NULL après avoir rempli toutes les valeurs
-- ---------------------------------------------------------------------------
alter table public.products alter column product_type set not null;

-- ---------------------------------------------------------------------------
-- 6. Policies RLS : aucune modification nécessaire
--    La colonne product_type n'affecte pas les policies existantes.
--    Les produits sont toujours accessibles via vendor_id.
-- ---------------------------------------------------------------------------
