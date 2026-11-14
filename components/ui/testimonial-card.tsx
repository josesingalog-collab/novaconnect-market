interface TestimonialCardProps {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export function TestimonialCard({ quote, name, role, initials }: TestimonialCardProps) {
  return (
    <figure className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <blockquote className="text-sm leading-7 text-foreground">“{quote}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
        >
          {initials}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">{name}</span>
          <span className="block text-xs text-muted-foreground">{role}</span>
        </span>
      </figcaption>
    </figure>
  );
}
