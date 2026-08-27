"use client";

import { useEffect } from "react";

/** Enregistre le service worker qui rend l'app utilisable hors ligne. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Hors ligne au premier chargement, ou contexte non sécurisé :
        // l'app fonctionne quand même, sans cache.
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
    return;
  }, []);

  return null;
}
