"use client";

import Link from "next/link";
import { useT } from "@/components/Store";

/** Bandeau permanent : l'outil n'a aucune valeur juridique. */
export function Disclaimer() {
  const t = useT();
  return (
    <div className="fixed inset-x-0 bottom-[54px] z-10 border-t border-[var(--border)] bg-[var(--bg)]/95 px-4 py-1.5 backdrop-blur">
      <p className="mx-auto max-w-lg text-center text-[10.5px] leading-tight muted">
        ⚖️ {t.disclaimer}{" "}
        <Link href="/about" className="underline underline-offset-2">
          {t.settings.about}
        </Link>
      </p>
    </div>
  );
}
