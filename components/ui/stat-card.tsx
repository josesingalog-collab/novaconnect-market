import React, { type ReactNode, forwardRef } from "react";
import { Card, CardContent } from "./card";
import type { CardProps } from "./card";

export interface StatCardProps extends Omit<CardProps, "children"> {
  label: string;
  value: string | number;
  icon?: ReactNode;
  description?: string;
  variation?: {
    value: string;
    trend: "up" | "down" | "neutral";
  };
}

const trendStyles = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const trendIcons = {
  up: (
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
        d="M5 10l7-7m0 0l7 7m-7-7v18"
      />
    </svg>
  ),
  down: (
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
        d="M19 14l-7 7m0 0l-7-7m7 7V3"
      />
    </svg>
  ),
  neutral: null,
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, icon, description, variation, className, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        variant="bordered"
        className={["overflow-hidden rounded-2xl bg-card p-1 shadow-soft", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <CardContent className="flex min-h-28 flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            {icon && (
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary">
                {icon}
              </span>
            )}
          </div>
          <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {variation && (
            <div
              className={["flex items-center gap-1 text-xs", trendStyles[variation.trend]]
                .filter(Boolean)
                .join(" ")}
            >
              {trendIcons[variation.trend]}
              {variation.value}
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
);

StatCard.displayName = "StatCard";
