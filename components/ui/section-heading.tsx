import type { ReactNode } from "react";

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "left" | "center";
}

export function SectionHeading({ eyebrow, title, lead, align = "left" }: SectionHeadingProps) {
  const isCenter = align === "center";

  return (
    <div className={isCenter ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
        {title}
      </h2>
      {lead !== undefined && <p className="mt-4 text-base leading-8 text-muted-foreground">{lead}</p>}
    </div>
  );
}
