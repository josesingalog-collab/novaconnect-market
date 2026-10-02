import {
  type ReactNode,
  type ReactNode as ReactNodeType,
  createContext,
  useContext,
  useState,
  useCallback,
} from "react";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

export function ToastProvider({ children }: { children: ReactNodeType }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, "id">) => {
    const id = `toast-${++toastCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const typeStyles: Record<ToastMessage["type"], string> = {
  success: "border-success bg-success/5",
  error: "border-destructive bg-destructive/5",
  warning: "border-warning bg-warning/5",
  info: "border-info bg-info/5",
};

const typeIconColors: Record<ToastMessage["type"], string> = {
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
  info: "text-info",
};

const typeIcons: Record<ToastMessage["type"], ReactNode> = {
  success: (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  error: (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  warning: (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg
      className="h-5 w-5 shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

export function ToastContainer({ className }: { className?: string }) {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className={[
        "fixed right-4 bottom-4 z-50 flex flex-col gap-2 sm:right-6 sm:bottom-6",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "flex w-full max-w-sm items-start gap-3 rounded-lg border p-4 shadow-lg",
            typeStyles[toast.type],
          ]
            .filter(Boolean)
            .join(" ")}
          role={toast.type === "error" || toast.type === "warning" ? "alert" : "status"}
        >
          <span className={["shrink-0", typeIconColors[toast.type]].filter(Boolean).join(" ")}>
            {typeIcons[toast.type]}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-sm text-muted-foreground">{toast.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="shrink-0 rounded rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label="Fermer la notification"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
