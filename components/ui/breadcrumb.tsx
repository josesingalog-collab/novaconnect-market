import { type HTMLAttributes, forwardRef } from "react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
  ({ items, className, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        aria-label="Breadcrumb"
        className={["flex items-center gap-1 text-sm text-muted-foreground", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <ol className="flex list-none items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={item.label} className="flex items-center gap-1">
                {index > 0 && (
                  <svg
                    className="h-3 w-3 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
                {isLast ? (
                  <span className="font-medium text-foreground" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link
                    href={item.href ?? "#"}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  },
);

Breadcrumb.displayName = "Breadcrumb";
