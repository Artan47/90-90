"use client";

import { useState } from "react";
import { useStore } from "@/components/Store";
import { Confirm } from "@/components/Confirm";
import { isProtected } from "@/lib/accounts";

/**
 * Barre du compte connecté, présente sur tous les écrans.
 *
 * Elle doit rester visible en permanence : c'est le garde-fou contre
 * l'erreur la plus coûteuse de l'application — saisir les séjours d'une
 * personne dans le compteur d'une autre.
 */
export function AccountBar() {
  const { account, t, signOut } = useStore();
  const [confirming, setConfirming] = useState(false);

  if (!account) return null;

  return (
    <>
      <div className="header-band flex items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-4 shrink-0 rounded-sm"
            style={{ background: "var(--brand)" }}
          />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{account.name}</span>
            <span className="block truncate text-[10px] opacity-60">
              {isProtected(account) ? `🔒 ${account.email}` : t.auth.isOpen}
            </span>
          </span>
        </span>
        <button
          onClick={() => setConfirming(true)}
          className="shrink-0 text-xs underline underline-offset-4 opacity-80"
        >
          {t.auth.signOut}
        </button>
      </div>

      {confirming ? (
        <Confirm
          title={t.auth.signOut}
          body={isProtected(account) ? t.auth.noRecovery : undefined}
          confirmLabel={t.auth.signOut}
          danger={false}
          onConfirm={() => {
            signOut();
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
