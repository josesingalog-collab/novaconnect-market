# Architecture — NovaConnect Market V1

## Vue générale

```
Navigateur (React + Tailwind + Zod client)
        │ HTTPS
Next.js App Router ── Server Actions · Route Handlers
        │
   lib/ (config, env, money, supabase clients)  ← fondations partagées
   services/ (logique métier par domaine)
        │
Supabase : PostgreSQL + RLS + Auth          Storage : product-files PRIVÉ · avatars PUBLIC
        ▲
Provider de paiement (interface PaymentProvider → Mock en V1)
        └── webhook signé = SEULE source de vérité d'un paiement réussi
```

## Règles de couches

| Couche           | Autorisé                                      | Interdit                                                     |
| ---------------- | --------------------------------------------- | ------------------------------------------------------------ |
| `app/` pages     | Composer des composants, appeler des services | Logique métier, accès DB direct                              |
| `services/`      | Règles métier, orchestration, transactions    | Manipuler du JSX, lire `process.env`                         |
| `lib/supabase/*` | Création clients                              | Contourner la RLS hors `admin.ts`                            |
| `components/`    | Présentation                                  | Importer `services/*` directement (passer par props/actions) |

## Invariants de sécurité

1. **RLS partout** : le client serveur standard utilise la clé anon ; la RLS est la barrière réelle.
2. **Service-role** : uniquement dans `lib/supabase/admin.ts` (`server-only` + règle ESLint), réservé aux webhooks/jobs système.
3. **Fichiers privés** : bucket non public ; téléchargement = contrôle de droit (order_item PAID) puis signed URL ≤ 60 s.
4. **Paiement** : jamais PAID sur déclaration frontend. Chaîne : webhook signé → vérif signature → idempotence (`payment_events` unique) → comparaison montant/devise → fonction SQL atomique `confirm_order_payment`.
5. **Double-crédit / double-retrait** : contraintes UNIQUE sur ledger + verrou transactionnel dans les RPC financières.
6. **Rôles** : `profiles.role` non modifiable via API/RLS, **sauf** la transition signée du flux vendeur (voir Phase 5) ; ADMIN promu uniquement en SQL manuel.
7. **Audit** : toute action sensible écrit dans `audit_logs`.
8. **Secrets** : uniquement via variables d'environnement validées (`lib/env.ts`) ; `.env*` ignorés par Git.

## Représentation monétaire

- Stockage : colonnes `numeric(18,2)` — exact en base, sérialisées en string JSON (aucune perte int8).
- Logique : `MinorAmount = bigint` (unités mineures). Précisions ISO 4217 :
  - USD exponent 2 (cents),
  - CDF exponent 2 (centimes).
- Arrondi métier : half-up en arithmétique entière (`computeCommissionAmount`).
- Aucune conversion croisée USD↔CDF en V1.

Voir `lib/money.ts` (implémentation + tests `tests/lib/money.test.ts`).

## Flux paiement (référence)

```
Checkout serveur → recalcul total (jamais confiance client)
  → INSERT order PENDING + order_items (snapshot prix/commission)
  → payment PENDING → createPayment(provider, référence unique)
  → Provider → webhook signé → POST /api/webhooks/payments
  → vérif signature → idempotence → vérif montant/devise
  → RPC atomique : order PAID + ledger vendeurs crédités + audit
  → droit de téléchargement actif (dérivé de order_items PAID)
```

## Profils, rôles & espaces (Phase 3)

### Modèle
- `profiles` : `full_name`, `phone`, `avatar_url`, `role` (BUYER/VENDOR/ADMIN), `status` (ACTIVE/SUSPENDED) ;
- création auto par trigger `handle_new_user` (rôle BUYER) ; promotion = SQL manuel uniquement (invariant 6) ;
- garde PostgreSQL (`security definer` + test `current_user = session_user`) : aucun client ne peut modifier `role`/`status`.

### Accès au profil côté serveur
- `lib/profile.ts` → `getCurrentProfile()` : union discriminée pure (`unauthenticated` / `missing-profile` / `ok`), client anon + RLS, aucune navigation intégrée.
- `lib/guards.ts` → `requireRole(role, nextPath)` : revalidation serveur dans les layouts `/vendor` et `/admin` ; rôle absent ou compte SUSPENDED → redirection `/dashboard`.

### Édition du profil (`/dashboard/profil`)
- Schéma Zod (`schemas/profile.ts`) puis action serveur : payload limité à `full_name`/`phone`/`avatar_url` — `role`/`status` n'y figurent jamais (double protection RLS + garde SQL).

### Avatar (bucket Storage PUBLIC `avatars`)
- Chemin fixe `<user_id>/avatar.<ext>` avec **upsert** : remplacement, jamais de doublon ;
- type vérifié par **signature binaire** JPEG/PNG/WebP (le `type` du navigateur est falsifiable), taille ≤ 2 Mo ;
- policies Storage : lecture publique du bucket ; écriture limitée à `(storage.foldername(name))[1] = auth.uid()::text` ;
- URL publique enregistrée dans `profiles.avatar_url` via UPDATE RLS.

### Changement de mot de passe (`/dashboard/mot-de-passe`)
- Action serveur → `auth.updateUser({ password })` avec le client à session cookie ; zéro service-role, aucune donnée métier. La session reste valide.

### Défense en profondeur des espaces rôles
`proxy.ts` (barrière UX) → layout serveur `requireRole` (profil réel via RLS) → policies PostgreSQL.

## Flux vendeur BUYER → VENDOR (Phase 5)

### Principe
Un seul compte : la création de la boutique par un BUYER bascule automatiquement son
profil en VENDOR, et sa suppression le ramène BUYER. La bascule vit **dans la base**
(migration `0010_vendor_role_flow.sql`) — le client n'envoie jamais `role`.

```
BUYER crée SA boutique (INSERT vendors, policy vendors_insert_own)
  → trigger trg_vendors_promote_role → promote_to_vendor_role()
      set_config('app.vendor_role_flow', user_id)   ← signature transactionnelle
      UPDATE profiles SET role='VENDOR' WHERE id=user_id AND role='BUYER'
VENDOR supprime sa boutique (DELETE vendors)
  → trigger trg_vendors_demote_role → démission symétrique (role='VENDOR' only)
```

### Garde profils v2 (`guard_profile_sensitive`)
L'écriture de `role`/`status` reste interdite à tout client ; l'unique exception est
la transition du flux, validée si ET SEULEMENT SI :
1. profondeur de trigger > 1 (impossible depuis une requête API directe) ;
2. exécution definer réelle (`current_user='postgres'` ≠ `session_user`) ;
3. GUC `app.vendor_role_flow` == id du profil modifié — posé par nos triggers via
   `set_config(..., true)` (transactionnel, non forgeable par le client) ;
4. transition exacte `BUYER→VENDOR` ou `VENDOR→BUYER` ;
5. `status` strictement inchangé.
→ ADMIN jamais touché (condition `role='BUYER'/'VENDOR'`), statut totalement
protégé, usurpation d'un autre profil impossible (GUC ≠ id). Détails : D-019…D-021.

### Création de boutique (`/dashboard/devenir-vendeur`)
- Action serveur `createVendorAction` : BUYER uniquement ; slug généré et
  dédoublonné serveur (`slugifyFr`, suffixe -2/-3…) — jamais accepté du client ;
- INSERT via client anon/session (RLS `vendors_insert_own` : `user_id=auth.uid()`
  et `status='PENDING'`) ; doublon boutique → erreur friendly (UNIQUE user_id).

### Espace vendeur (`/vendor`)
Lecture seule via RLS (`vendors_select_public_or_own`) : fiche boutique + bandeau
par statut (PENDING/ACTIVE/REJECTED/SUSPENDED), état vide sinon. Aucun chemin
d'écriture du statut (policy insert-only PENDING + `guard_vendor_sensitive`).

## Phases

Voir tableau de statut dans `README.md`. Chaque phase se termine par lint + typecheck + tests + build verts et un commit conventionnel.
