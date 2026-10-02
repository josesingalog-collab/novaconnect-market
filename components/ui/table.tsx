import React, { type HTMLAttributes, type ReactNode, forwardRef } from "react";

export interface TableProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const Table = forwardRef<HTMLDivElement, TableProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={["relative w-full overflow-x-auto", className].filter(Boolean).join(" ")}
        {...props}
      >
        <table className="w-full caption-bottom text-sm">{children}</table>
      </div>
    );
  },
);

Table.displayName = "Table";

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  return (
    <thead
      ref={ref}
      className={["[&_tr]:border-b", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

TableHeader.displayName = "TableHeader";

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  return (
    <tbody
      ref={ref}
      className={["[&_tr:last-child]:border-0", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

TableBody.displayName = "TableBody";

export const TableRow = forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={[
          "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );
  },
);

TableRow.displayName = "TableRow";

export const TableHead = forwardRef<
  HTMLTableCellElement,
  React.HTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  return (
    <th
      ref={ref}
      className={[
        "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

TableHead.displayName = "TableHead";

export const TableCell = forwardRef<
  HTMLTableCellElement,
  React.HTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  return (
    <td
      ref={ref}
      className={["p-4 align-middle [&:has([role=checkbox])]:pr-0", className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

TableCell.displayName = "TableCell";

export const TableCaption = forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => {
  return (
    <caption
      ref={ref}
      className={["mt-4 text-sm text-muted-foreground", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

TableCaption.displayName = "TableCaption";
