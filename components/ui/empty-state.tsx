import { type ReactNode } from "react";
import Link from "next/link";
import { Button } from "./button";
import { Card } from "./card";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card variant="bordered" className={["overflow-hidden", className].filter(Boolean).join(" ")}>
      <div
        className="flex flex-col items-center justify-center p-6 text-center sm:p-8"
        role="status"
      >
        {icon && (
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground sm:h-16 sm:w-16">
            {icon}
          </div>
        )}
        <h3 className="text-base font-semibold text-foreground sm:text-lg">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground sm:text-base">{description}</p>
        {action && (
          <div className="mt-5">
            {action.onClick ? (
              <Button variant="outline" size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            ) : (
              <Button variant="default" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
