"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/Store";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Invite à installer l'app sur l'écran d'accueil.
 * Sur Android/Chrome on utilise `beforeinstallprompt` ; iOS ne l'expose pas,
 * on affiche donc l'instruction manuelle (Partager → Sur l'écran d'accueil).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const t = useT();

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = window.navigator.userAgent;
    if (/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua)) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (deferred) {
    return (
      <button
        onClick={() => {
          void deferred.prompt();
          setDeferred(null);
        }}
        className="surface w-full rounded-2xl p-4 text-left"
      >
        <p className="font-semibold">⬇︎ {t.common.install}</p>
        <p className="mt-0.5 text-xs muted">{t.common.installHint}</p>
      </button>
    );
  }

  if (iosHint) {
    return (
      <div className="surface rounded-2xl p-4">
        <p className="font-semibold">⬇︎ {t.common.install}</p>
        <p className="mt-0.5 text-xs muted">
          {t.common.installHint} — Safari: <strong>􀈂</strong> → “Add to Home Screen”.
        </p>
      </div>
    );
  }

  return null;
}
