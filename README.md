# NovaConnect Market

Marketplace SaaS de produits numériques multi-vendeurs pour créateurs d'Afrique francophone (RDC en priorité) : e-books, formations, templates, fichiers CAD/BIM, scripts, ressources professionnelles.

## Stack

| Couche     | Technologie                                                     |
| ---------- | --------------------------------------------------------------- |
| Frontend   | Next.js (App Router), React, TypeScript strict, Tailwind CSS v4 |
| Backend    | Supabase (Auth, PostgreSQL + RLS, Storage privé)                |
| Validation | Zod (client + serveur)                                          |
| Tests      | Vitest                                                          |
| Qualité    | ESLint (flat config) + Prettier                                 |

## Démarrage

```bash
npm install
copy .env.example .env.local   # puis remplir les valeurs Supabase
npm run dev
```

> Windows/PowerShell : si `npm` est bloqué par l'Execution Policy, utiliser `npm.cmd`
> ou exécuter `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Scripts

| Commande            | Rôle                               |
| ------------------- | ---------------------------------- |
| `npm run dev`       | Serveur de développement           |
| `npm run build`     | Build de production                |
| `npm run lint`      | ESLint                             |
| `npm run typecheck` | TypeScript strict (`tsc --noEmit`) |
| `npm test`          | Tests Vitest                       |
| `npm run test:integration` | Tests d'intégration Supabase local |
| `npm run format`    | Formatage Prettier                 |

### Tests d'intégration

Les tests d'intégration n'utilisent jamais le projet Supabase de production. Configurez soit
Supabase local avec `npx supabase start`, soit un projet Supabase exclusivement dédié aux tests.
Renseignez `.env.integration` à partir de `.env.integration.example`, puis lancez
`npm run test:integration`. Un projet distant exige son identifiant et la confirmation explicite
`INTEGRATION_REMOTE_TEST_ACKNOWLEDGEMENT=dedicated-test-project`.

## Structure

```

app/            Routes Next.js (App Router)
components/     UI réutilisables (ui · marketplace · vendor · admin)
lib/            config centrale · env validée · money · clients Supabase
services/       logique métier par domaine (orders, payments, ledger…)
schemas/        schémas Zod partagés
types/          types partagés (+ Database généré plus tard)
supabase/       migrations SQL versionnées
tests/          tests unitaires des modules critiques
docs/           architecture.md · decisions.md · database.md…
```

## Statut du projet (V1)

- [x] **Phase 1** — Fondations (Next.js strict, config, money system, clients Supabase)
- [x] **Phase 2** — Schéma DB, migrations, RLS
- [x] **Phase 3** — Auth + profils + rôles
- [x] **Phase 4** — Marketplace publique (catalogue, filtres, fiche produit, navigation)
- [x] **Phase 5** — Espace vendeur (création de boutique, flux BUYER→VENDOR, statut boutique)
- [x] **Phase 6** — Panier + commandes (checkout RPC atomique, re-pricing serveur, snapshots)
- [x] **Phase 7** — Paiement simulé (webhook HMAC signé idempotent, RPC `confirm_order_payment`, simulation acheteur)
- [x] **Phase 8** — Livraison numérique sécurisée (RPC `create_download_grant`, bucket privé, signed URL 120 s, audit downloads)
- [ ] Phase 9 — Ledger + retraits (S1 ✅ vendor_id immuable · S2 ✅ gestion produit · S3 ✅ upload Storage privé · S4 ✅ docs `architecture.md` §Ledger · S5+ ⏳)
- [x] Phase 10 — Back-office admin (modération vendeurs/produits, pipeline retraits)
- [ ] Phase 11 — Tests & audit sécurité
- [ ] Phase 12 — Production

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — architecture, flux, invariants de sécurité
- [`docs/decisions.md`](docs/decisions.md) — décisions techniques consignées (ADR)

## Règles non négociables

1. Aucun float dans les calculs financiers → `lib/money.ts` (bigint, unités mineures).
2. Les fichiers produits restent PRIVÉS (bucket + signed URLs courte durée).
3. Une commande n'est PAID que sur confirmation webhook serveur validée et idempotente.
4. Le client service-role Supabase n'est importable que depuis `lib/supabase/admin.ts` (règle ESLint).
5. Toute écriture financière passe par une fonction PostgreSQL atomique et auditable.
