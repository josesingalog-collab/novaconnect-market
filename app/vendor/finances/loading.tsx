import { SkeletonCard } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div>
        <SkeletonCard className="h-3 w-36" />
        <SkeletonCard className="h-8 w-48 sm:h-10" />
        <SkeletonCard className="h-4 w-72" />
      </div>

      <section aria-label="Soldes">
        <SkeletonCard className="h-4 w-36" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      </section>

      <section aria-label="Historique">
        <SkeletonCard className="h-4 w-48" />
        <div className="mt-3 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} className="h-14" />
          ))}
        </div>
      </section>
    </div>
  );
}
