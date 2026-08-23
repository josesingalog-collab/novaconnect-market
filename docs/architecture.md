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
Supabase : PostgreSQL + RLS + Auth          Storage PRIVÉ (product-files)
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
6. **Rôles** : `profiles.role` non modifiable via API/RLS ; ADMIN promu uniquement en SQL manuel.
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

## Phases

Voir tableau de statut dans `README.md`. Chaque phase se termine par lint + typecheck + tests + build verts et un commit conventionnel.
