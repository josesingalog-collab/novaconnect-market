import { type ReactNode as ReactNodeType, createContext, useContext, useState, useCallback } from "react";

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

const typeIcons: Record<ToastMessage["type"], string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function ToastContainer({ className }: { className?: string }) {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className={["fixed bottom-4 right-4 z-50 flex flex-col gap-2", className].filter(Boolean).join(" ")} aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={[
            "flex items-start gap-3 rounded-lg border p-4 shadow-lg max-w-sm",
            typeStyles[toast.type],
          ].filter(Boolean).join(" ")}
          role="alert"
        >
          <span className={["text-sm", typeIconColors[toast.type]].filter(Boolean).join(" ")} aria-hidden="true">
            {typeIcons[toast.type]}
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{toast.title}</p>
            {toast.description && <p className="text-sm text-muted-foreground">{toast.description}</p>}
          </div>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground rounded p-1"
            aria-label="Fermer la notification"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
