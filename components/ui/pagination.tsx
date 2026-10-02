import { type HTMLAttributes, forwardRef } from "react";
import { Button } from "./button";

export interface PaginationProps extends HTMLAttributes<HTMLDivElement> {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = forwardRef<HTMLDivElement, PaginationProps>(
  ({ currentPage, totalPages, onPageChange, className, ...props }, ref) => {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

    return (
      <div
        ref={ref}
        className={["flex flex-wrap items-center justify-center", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <nav aria-label="Pagination" className="flex items-center justify-center gap-1 sm:gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label="Page précédente"
          >
            ← Précédent
          </Button>
          {pages.map((page) => (
            <Button
              key={page}
              variant={page === currentPage ? "primary" : "outline"}
              size="sm"
              disabled={page === currentPage}
              onClick={() => onPageChange(page)}
              aria-label={`Page ${page}`}
              aria-current={page === currentPage ? "page" : undefined}
            >
              {page}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label="Page suivante"
          >
            Suivant →
          </Button>
        </nav>
      </div>
    );
  },
);

Pagination.displayName = "Pagination";

export interface PaginationInfoProps extends HTMLAttributes<HTMLParagraphElement> {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  className?: string;
}

export const PaginationInfo = forwardRef<HTMLParagraphElement, PaginationInfoProps>(
  ({ currentPage, totalPages, totalItems, className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={["text-sm text-muted-foreground", className].filter(Boolean).join(" ")}
        {...props}
      >
        Page {currentPage} sur {totalPages}
        {totalItems !== undefined ? ` · ${totalItems} élément${totalItems > 1 ? "s" : ""}` : ""}
      </p>
    );
  },
);

PaginationInfo.displayName = "PaginationInfo";
