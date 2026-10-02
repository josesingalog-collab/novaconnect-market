import { type HTMLAttributes, type ReactNode, forwardRef } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "bordered" | "elevated" | "interactive";
  interactive?: boolean;
}

const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "shadow-sm",
  bordered: "border border-border",
  elevated: "shadow-lg",
  interactive: "hover:shadow-md hover:border-primary/50 transition-shadow cursor-pointer",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, children, padding = "md", variant = "default", interactive = false, ...props },
    ref,
  ) => {
    const resolvedVariant = interactive ? "interactive" : variant;
    return (
      <div
        ref={ref}
        className={[
          "rounded-xl bg-card text-card-foreground",
          paddingStyles[padding],
          variantStyles[resolvedVariant],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  },
);

CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={["text-sm font-semibold tracking-tight text-foreground", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </h3>
    );
  },
);

CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={["text-sm text-muted-foreground", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </p>
    );
  },
);

CardDescription.displayName = "CardDescription";

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={[className].filter(Boolean).join(" ")} {...props}>
        {children}
      </div>
    );
  },
);

CardContent.displayName = "CardContent";

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={["flex items-center gap-2", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  },
);

CardFooter.displayName = "CardFooter";
