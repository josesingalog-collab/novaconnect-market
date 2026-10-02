import { SkeletonCard, SkeletonProduct } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <SkeletonCard className="h-3 w-48" />
        <SkeletonCard className="h-7 w-56" />
        <SkeletonCard className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SkeletonCard className="h-11 w-48" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} className="h-16" />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SkeletonCard className="h-11 flex-1" />
        <SkeletonCard className="h-11 w-32" />
        <SkeletonCard className="h-11 w-20" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonProduct key={i} />
        ))}
      </div>
    </div>
  );
}
