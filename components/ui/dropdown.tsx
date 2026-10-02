import React, { useState, useRef, useEffect, type ReactNode, forwardRef } from "react";
import { createPortal } from "react-dom";

export interface DropdownItem {
  label: string;
  value?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect?: (item: DropdownItem) => void;
  align?: "start" | "center" | "end";
  className?: string;
}

const alignStyles = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  ({ trigger, items, onSelect, align = "start", className, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
          return;
        }
      };

      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };

      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [open]);

    useEffect(() => {
      if (open && menuRef.current) {
        const firstItem = menuRef.current.querySelector<HTMLElement>("button:not([disabled])");
        firstItem?.focus();
      }
    }, [open]);

    const handleItemClick = (item: DropdownItem) => {
      if (item.disabled) return;
      setOpen(false);
      triggerRef.current?.focus();
      onSelect?.(item);
    };

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={["relative inline-block", className].filter(Boolean).join(" ")}
        {...props}
      >
        <div ref={triggerRef} onClick={() => setOpen((prev) => !prev)} className="cursor-pointer">
          {trigger}
        </div>
        {open &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Menu"
              className={[
                "absolute z-50 min-w-[8rem] rounded-lg border border-border bg-card py-1 shadow-lg",
                alignStyles[align],
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  role="menuitem"
                  type="button"
                  disabled={item.disabled}
                  onClick={() => handleItemClick(item)}
                  className={[
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-accent hover:text-accent-foreground",
                    item.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

Dropdown.displayName = "Dropdown";
