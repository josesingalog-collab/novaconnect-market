"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * Panier client — persisté dans localStorage (clé versionnée), jamais envoyé
 * tel quel au serveur : le checkout re-price tout depuis la base (Phase 6-S3).
 * Produits numériques ⇒ quantité toujours 1, dédoublonnage par productId.
 * Une seule devise à la fois : l'ajout d'un produit d'une autre devise est refusé.
 *
 * Implémentation : store externe + useSyncExternalStore (aucun effet de
 * synchronisation, rendu serveur = panier vide, hydratation sans mismatch,
 * synchronisation multi-onglets via l'événement natif "storage").
 */
export interface CartItem {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  /** Montant en decimal string (D-001) — affichage uniquement. */
  readonly price: string;
  readonly currency: string;
  readonly storeName: string;
  readonly thumbnailUrl: string | null;
}

export type AddToCartResult = "added" | "duplicate" | "currency-conflict";

interface CartContextValue {
  readonly items: readonly CartItem[];
  readonly currency: string | null;
  add: (item: CartItem) => AddToCartResult;
  remove: (productId: string) => void;
  clear: () => void;
  has: (productId: string) => boolean;
}

const STORAGE_KEY = "nc-cart-v1";
const EMPTY: readonly CartItem[] = [];

const listeners = new Set<() => void>();
let cache: readonly CartItem[] | null = null;

function isValidItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["productId"] === "string" &&
    typeof v["slug"] === "string" &&
    typeof v["title"] === "string" &&
    typeof v["price"] === "string" &&
    typeof v["currency"] === "string" &&
    typeof v["storeName"] === "string" &&
    (v["thumbnailUrl"] === null || typeof v["thumbnailUrl"] === "string")
  );
}

function readStoredItems(): readonly CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const items = parsed.filter(isValidItem);
    return items.length > 0 ? items : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** Cache invalide + notification des abonnés (même onglet et autres onglets). */
function notify() {
  cache = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) notify();
  };
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): readonly CartItem[] {
  if (cache === null) cache = readStoredItems();
  return cache;
}

function getServerSnapshot(): readonly CartItem[] {
  return EMPTY;
}

function write(next: readonly CartItem[]) {
  try {
    if (next.length === 0) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // quota indisponible / navigation privée : le panier reste en mémoire
  }
  notify();
}

function addToStore(item: CartItem): AddToCartResult {
  const current = getSnapshot();
  if (current.some((entry) => entry.productId === item.productId)) {
    return "duplicate";
  }
  const existingCurrency = current[0]?.currency;
  if (existingCurrency !== undefined && existingCurrency !== item.currency) {
    return "currency-conflict";
  }
  write([...current, item]);
  return "added";
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((item: CartItem) => addToStore(item), []);

  const remove = useCallback((productId: string) => {
    write(getSnapshot().filter((entry) => entry.productId !== productId));
  }, []);

  const clear = useCallback(() => {
    write(EMPTY);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      currency: items[0]?.currency ?? null,
      add,
      remove,
      clear,
      has: (productId: string) => items.some((entry) => entry.productId === productId),
    }),
    [items, add, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (ctx === null) {
    throw new Error("useCart doit être utilisé dans un CartProvider");
  }
  return ctx;
}
