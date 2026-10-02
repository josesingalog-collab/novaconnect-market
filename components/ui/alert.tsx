import React, { type ReactNode, forwardRef } from "react";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children: ReactNode;
}

const variantStyles: Record<NonNullable<AlertProps["variant"]>, string> = {
  info: "border-info bg-info/5 text-foreground",
  success: "border-success bg-success/5 text-foreground",
  warning: "border-warning bg-warning/5 text-foreground",
  error: "border-destructive bg-destructive/5 text-foreground",
};

const variantIcons: Record<NonNullable<AlertProps["variant"]>, ReactNode> = {
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
};

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = "info", title, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="alert"
        className={[
          "flex items-start gap-3 rounded-lg border p-4",
          variantStyles[variant],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <span className="mt-0.5 shrink-0">{variantIcons[variant]}</span>
        <div className="flex-1">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          <div className="mt-1 text-sm text-foreground">{children}</div>
        </div>
      </div>
    );
  },
);

Alert.displayName = "Alert";
