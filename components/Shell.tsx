"use client";

import { useStore } from "@/components/Store";
import { AccountBar } from "@/components/AccountBar";
import { Auth } from "@/components/Auth";
import { Disclaimer } from "@/components/Disclaimer";
import { Nav } from "@/components/Nav";

/**
 * Enveloppe de l'application : écran de connexion tant qu'aucune session
 * n'est ouverte, application complète ensuite.
 *
 * Tant qu'on n'est pas connecté, on n'affiche NI la navigation NI un
 * compteur : montrer « 90 jours restants » sans savoir de qui l'on parle
 * serait un chiffre inventé.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const { ready, signedIn } = useStore();

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-lg p-4">
        <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]" />
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <div className="header-band px-4 py-3">
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-4 w-4 rounded-sm"
              style={{ background: "var(--brand)" }}
            />
            <span className="font-bold">Sa ditë</span>
          </span>
        </div>
        <main className="flex-1 px-4 py-5">
          <Auth />
        </main>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <AccountBar />
      <main className="flex-1 px-4 pb-40 pt-4">{children}</main>
      <Disclaimer />
      <Nav />
    </div>
  );
}
