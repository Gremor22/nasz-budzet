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

  return <span className={`${sizeClass} ${toneClass} tabular-nums whitespace-nowrap`}>{formatPln(grosze)}</span>;
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
      className={`min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

/** Wspólna klasa pól tekstowych / selectów (pod Label). */
export const fieldClass =
  "mt-1 block w-full min-w-0 max-w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5";

/** To samo bez marginesu górnego (np. pierwsze pole w formularzu). */
export const fieldBareClass = fieldClass.replace("mt-1 ", "");

/** Pole daty — wrapper zapobiega overflow na iOS. */
export function DateField({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="mt-1 min-w-0 overflow-hidden rounded-xl border border-[var(--line)] bg-white">
      <input
        type="date"
        {...props}
        className={`block w-full min-w-0 max-w-full border-0 bg-transparent px-3 py-2.5 ${className}`}
      />
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ink-muted)]">
      {children}
    </p>
  );
}
