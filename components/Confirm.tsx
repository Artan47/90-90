"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";
import { useT } from "@/components/Store";

/**
 * Boîte de confirmation intégrée.
 *
 * Remplace window.confirm(), qui ne fonctionne PAS dans une iframe
 * sandboxée sans `allow-modals` : l'appel n'y renvoie jamais, et l'action
 * demandée (une suppression, par exemple) ne partait donc jamais.
 */
export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
}: {
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div
        className="pop surface w-full max-w-sm rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-lg font-bold">{title}</p>
        {body ? <p className="mt-2 text-sm muted">{body}</p> : null}
        <div className="mt-5 flex flex-col gap-2">
          <Button onClick={onConfirm} variant={danger ? "danger" : "primary"}>
            {confirmLabel ?? t.common.confirm}
          </Button>
          <Button onClick={onCancel} variant="ghost">
            {t.common.cancelAction}
          </Button>
        </div>
      </div>
    </div>
  );
}
