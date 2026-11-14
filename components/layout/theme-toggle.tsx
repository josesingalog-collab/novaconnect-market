"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "savpay-theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("savpay-theme-change", onChange);
  return () => {
    observer.disconnect();
    window.removeEventListener("savpay-theme-change", onChange);
  };
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => null;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Stockage indisponible : le thème reste actif pour la session.
    }
    window.dispatchEvent(new Event("savpay-theme-change"));
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        dark === null ? "Changer de thème" : dark ? "Activer le mode clair" : "Activer le mode sombre"
      }
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent hover:text-accent-foreground ${className}`}
    >
      {dark === null ? (
        <span className="h-4 w-4" aria-hidden="true" />
      ) : dark ? (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" strokeWidth={2} />
          <path
            strokeLinecap="round"
            strokeWidth={2}
            d="M12 2.5v2m0 15v2m9.5-9.5h-2m-15 0h-2m16.16-6.66-1.42 1.42M6.34 17.66l-1.42 1.42m14.16 0-1.42-1.42M6.34 6.34 4.92 4.92"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"
          />
        </svg>
      )}
    </button>
  );
}
