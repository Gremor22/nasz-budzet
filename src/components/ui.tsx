import { formatPln } from "@/lib/money/format";

export function Money({
  grosze,
  size = "md",
  tone = "default",
}: {
  grosze: number;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "default" | "safe" | "warn" | "danger" | "muted";
}) {
  const sizeClass =
    size === "xl"
      ? "text-3xl font-semibold tracking-tight"
      : size === "lg"
        ? "text-2xl font-semibold"
        : size === "sm"
          ? "text-sm font-medium"
          : "text-base font-semibold";

  const toneClass =
    tone === "safe"
      ? "text-[var(--safe)]"
      : tone === "warn"
        ? "text-[var(--warn)]"
        : tone === "danger"
          ? "text-[var(--danger)]"
          : tone === "muted"
            ? "text-[var(--ink-muted)]"
            : "text-[var(--ink)]";

  return <span className={`${sizeClass} ${toneClass}`}>{formatPln(grosze)}</span>;
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
      {children}
    </p>
  );
}
