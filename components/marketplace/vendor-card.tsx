import Link from "next/link";
import type { ActiveVendor } from "@/services/vendors/public";

export function VendorCard({ vendor }: { vendor: ActiveVendor }) {
  const initials = vendor.storeName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <Link
      href={`/boutique/${vendor.slug}`}
      className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <span
        aria-hidden
        className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-sm font-bold text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
      >
        {vendor.logoUrl !== null ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL fournie par le vendeur
          <img src={vendor.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials || "NC"
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {vendor.storeName}
        </span>
        <span className="mt-0.5 line-clamp-1 block text-xs text-zinc-500 dark:text-zinc-400">
          {vendor.description ?? "Vendeur de produits numériques"}
        </span>
      </span>
    </Link>
  );
}
