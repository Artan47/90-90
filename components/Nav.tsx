"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";

const ITEMS = [
  { href: "/", label: t.nav.home, icon: "◎" },
  { href: "/stays", label: t.nav.stays, icon: "≡" },
  { href: "/plan", label: t.nav.plan, icon: "✈" },
  { href: "/timeline", label: t.nav.timeline, icon: "▤" },
  { href: "/settings", label: t.nav.settings, icon: "⚙" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t.appName}
    >
      <ul className="mx-auto flex w-full max-w-lg">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                  active ? "font-semibold text-[var(--text)]" : "muted"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
