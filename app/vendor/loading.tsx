import { SkeletonCard } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div>
        <SkeletonCard className="h-3 w-36" />
        <SkeletonCard className="h-8 w-64 sm:h-10" />
        <SkeletonCard className="h-4 w-80" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <SkeletonCard className="h-10 w-10 rounded-full" />
          <div className="flex flex-col gap-1">
            <SkeletonCard className="h-5 w-40" />
            <SkeletonCard className="h-4 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonCard className="h-9 w-28" />
          <SkeletonCard className="h-9 w-32" />
        </div>
      </div>

      <section aria-label="Statistiques des produits">
        <SkeletonCard className="h-4 w-48" />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} className="h-16" />
          ))}
        </div>
      </section>

      <section aria-label="Produits nécessitant votre attention">
        <SkeletonCard className="h-4 w-36" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      </section>

      <section aria-label="Vos derniers produits">
        <SkeletonCard className="h-4 w-44" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      </section>

      <section aria-label="Guide débutant">
        <SkeletonCard className="h-6 w-56" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="h-5" />
          ))}
        </div>
      </section>
    </div>
  );
}
