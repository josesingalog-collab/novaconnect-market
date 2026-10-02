import React, { useEffect, useRef, type ReactNode, forwardRef } from "react";
import { createPortal } from "react-dom";

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    { open, onOpenChange, title, description, children, actions, size = "md", className, ...props },
    ref,
  ) => {
    const contentRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);
    const titleId = `modal-title-${React.useId()}`;
    const descriptionId = `modal-description-${React.useId()}`;

    useEffect(() => {
      if (open) {
        previousActiveElement.current = document.activeElement as HTMLElement;
        const timer = setTimeout(() => {
          contentRef.current?.focus();
        }, 0);
        return () => clearTimeout(timer);
      } else {
        previousActiveElement.current?.focus();
      }
    }, [open]);

    useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
          return;
        }
        if (e.key === "Tab" && contentRef.current) {
          const focusable = contentRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          );
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey) {
            if (document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            }
          } else {
            if (document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }, [open, onOpenChange]);

    if (!open) return null;

    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        <div
          ref={(node) => {
            contentRef.current = node;
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={[
            "relative w-full rounded-xl border border-border bg-card shadow-xl",
            sizeStyles[size],
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 id={titleId} className="text-lg font-semibold text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fermer"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          {description && (
            <p id={descriptionId} className="px-6 pt-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          <div className="px-6 py-4">{children}</div>
          {actions && (
            <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
              {actions}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  },
);

Modal.displayName = "Modal";
