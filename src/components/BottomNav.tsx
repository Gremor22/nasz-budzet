"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: {
  href: string;
  label: string;
  icon: string;
  primary?: boolean;
}[] = [
  { href: "/", label: "Pulpit", icon: "⌂" },
  { href: "/transakcje", label: "Transakcje", icon: "☰" },
  { href: "/dodaj", label: "Dodaj", icon: "+", primary: true },
  { href: "/prognoza", label: "Prognoza", icon: "↗" },
  { href: "/wiecej", label: "Więcej", icon: "⋯" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--line)] bg-[var(--card)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/90"
      aria-label="Nawigacja główna"
    >
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pb-2 pt-2">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          if (item.primary) {
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour="nav-add"
                className="relative -top-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-xl font-semibold text-white shadow-md"
                aria-label="Dodaj"
              >
                {item.icon}
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={
                item.href === "/prognoza"
                  ? "nav-prognoza"
                  : item.href === "/wiecej"
                    ? "nav-wiecej"
                    : undefined
              }
              className={`flex min-h-11 min-w-[3.5rem] flex-col items-center justify-center gap-0.5 px-2 py-1 text-xs ${
                active ? "text-[var(--accent)]" : "text-[var(--ink-muted)]"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
