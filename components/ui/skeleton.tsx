import { type HTMLAttributes, forwardRef } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "text" | "circular" | "rectangular" | "title" | "avatar";
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "rectangular", width, height, style, ...props }, ref) => {
    const radius =
      variant === "circular"
        ? "9999px"
        : variant === "text" || variant === "title"
          ? "0.375rem"
          : variant === "avatar"
            ? "9999px"
            : "0.5rem";

    const defaultHeight =
      variant === "title" ? "1.25rem" : variant === "avatar" ? "2.5rem" : undefined;

    return (
      <div
        ref={ref}
        className={[
          "animate-pulse rounded-md bg-muted",
          variant === "circular" || variant === "avatar" ? "rounded-full" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ width, height: height ?? defaultHeight, borderRadius: radius, ...style }}
        aria-hidden="true"
        {...props}
      />
    );
  },
);

Skeleton.displayName = "Skeleton";

export interface SkeletonTextProps {
  className?: string;
  lines?: number;
}

export function SkeletonText({ className, lines = 1 }: SkeletonTextProps) {
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

export interface SkeletonCardProps {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      className={["rounded-xl border border-border bg-card p-4", className]
        .filter(Boolean)
        .join(" ")}
    >
      <Skeleton variant="rectangular" className="h-48 w-full" />
      <div className="mt-4 flex flex-col gap-2">
        <Skeleton variant="title" className="h-5 w-3/4" />
        <Skeleton variant="text" className="h-4 w-1/2" />
        <Skeleton variant="text" className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export interface SkeletonProductProps {
  className?: string;
}

export function SkeletonProduct({ className }: SkeletonProductProps) {
  return (
    <div
      className={["overflow-hidden rounded-xl border border-border bg-card", className]
        .filter(Boolean)
        .join(" ")}
    >
      <Skeleton variant="rectangular" className="aspect-video w-full" />
      <div className="p-4">
        <Skeleton variant="title" className="h-5 w-3/4" />
        <Skeleton variant="text" className="mt-2 h-4 w-1/2" />
        <Skeleton variant="text" className="mt-2 h-4 w-1/3" />
      </div>
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export function SkeletonTable({ rows = 5, columns = 3, className }: SkeletonTableProps) {
  return (
    <div
      className={["rounded-xl border border-border bg-card", className].filter(Boolean).join(" ")}
    >
      <div className="border-b border-border p-4">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton
              key={i}
              variant="title"
              className={i === 0 ? "w-1/4" : "w-1/3"}
              style={{ height: "1rem" }}
            />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex gap-4 border-b border-border p-4 last:border-0">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton
              key={col}
              variant="text"
              className={col === 0 ? "w-1/4" : "w-1/3"}
              style={{ height: "0.875rem" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
