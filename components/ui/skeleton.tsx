import { type HTMLAttributes, forwardRef } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "rectangular", width, height, style, ...props }, ref) => {
    const radius =
      variant === "circular"
        ? "9999px"
        : variant === "text"
          ? "0.375rem"
          : "0.5rem";

    return (
      <div
        ref={ref}
        className={[
          "animate-pulse rounded-md bg-muted",
          variant === "circular" ? "rounded-full" : "",
          className,
        ].filter(Boolean).join(" ")}
        style={{ width, height, borderRadius: radius, ...style }}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

export function SkeletonText({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={["flex flex-col gap-2", className].filter(Boolean).join(" ")}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={i === lines - 1 ? "w-3/4" : "w-full"}
          style={{ height: "0.875rem" }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={["rounded-xl border border-border bg-card p-4", className].filter(Boolean).join(" ")}>
      <Skeleton variant="rectangular" className="h-48 w-full" />
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton variant="text" className="h-4 w-3/4" />
        <Skeleton variant="text" className="h-4 w-1/2" />
        <Skeleton variant="text" className="h-4 w-2/3" />
      </div>
    </div>
  );
}
