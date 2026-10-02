import { SkeletonCard, SkeletonProduct } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <section className="flex flex-col items-center gap-6 py-20">
        <SkeletonCard className="h-10 w-48" />
        <SkeletonCard className="h-6 w-96" />
      </section>
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonProduct key={i} className="aspect-video" />
        ))}
      </section>
    </main>
  );
}
