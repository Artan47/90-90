"use client";

/**
 * État applicatif partagé : les séjours, le profil, et la date du jour.
 *
 * La date du jour est tenue ici et rafraîchie au retour au premier plan :
 * le moteur de calcul, lui, ne lit jamais l'horloge (elle lui est passée).
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { AppData, Profile, Stay } from "@/lib/types";
import { emptyData } from "@/lib/types";
import { loadData, saveData, newId, isStorageAvailable } from "@/lib/storage";
import { todayIso, type IsoDate } from "@/lib/date";
import {
  detectLocale, getMessages, fill, DEFAULT_LOCALE,
  type Locale, type Messages,
} from "@/lib/i18n";

interface StoreValue {
  data: AppData;
  today: IsoDate;
  /** Langue effective : celle choisie, sinon celle du navigateur. */
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Libellés de la langue effective. */
  t: Messages;
  /** Remplit les jetons d'un libellé en accordant au nombre et à la langue. */
  fmt: (template: string, values: Record<string, string | number>) => string;
  ready: boolean;
  storageOk: boolean;
  stays: Stay[];
  addStay: (stay: Omit<Stay, "id">) => Stay;
  updateStay: (id: string, patch: Partial<Omit<Stay, "id">>) => void;
  removeStay: (id: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  replaceAll: (data: AppData) => void;
  clearAll: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [today, setToday] = useState<IsoDate>(() => todayIso());
  // La détection ne peut avoir lieu qu'au montage : le rendu serveur et la
  // première passe client doivent produire le même HTML.
  const [detected, setDetected] = useState<Locale>(DEFAULT_LOCALE);

  // Chargement au montage seulement : localStorage n'existe pas au rendu
  // serveur, et l'hydratation doit partir du même état vide.
  useEffect(() => {
    setData(loadData());
    setStorageOk(isStorageAvailable());
    setToday(todayIso());
    setDetected(detectLocale());
    setReady(true);
  }, []);

  // L'app reste ouverte des jours entiers sur un téléphone : on recale la
  // date au retour au premier plan, sinon le compteur se fige à hier.
  useEffect(() => {
    const refresh = () => setToday(todayIso());
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const persist = useCallback((next: AppData) => {
    setData(next);
    saveData(next);
  }, []);

  const locale: Locale = data.profile.locale ?? detected;
  const messages = getMessages(locale);

  // `lang` doit refléter la langue affichée : lecteurs d'écran, correction
  // orthographique et césure s'appuient dessus.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<StoreValue>(() => {
    const addStay = (stay: Omit<Stay, "id">): Stay => {
      const created: Stay = { ...stay, id: newId() };
      persist({ ...data, stays: [...data.stays, created] });
      return created;
    };

    return {
      data,
      today,
      locale,
      setLocale: (next: Locale) =>
        persist({ ...data, profile: { ...data.profile, locale: next } }),
      t: messages,
      fmt: (template, values) => fill(template, values, locale),
      ready,
      storageOk,
      stays: data.stays,
      addStay,
      updateStay: (id, patch) =>
        persist({
          ...data,
          stays: data.stays.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        }),
      removeStay: (id) =>
        persist({ ...data, stays: data.stays.filter((s) => s.id !== id) }),
      setProfile: (patch) =>
        persist({ ...data, profile: { ...data.profile, ...patch } }),
      replaceAll: (next) => persist(next),
      clearAll: () => persist(emptyData()),
    };
  }, [data, today, locale, messages, ready, storageOk, persist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/**
 * Libellés de la langue courante.
 *
 * À utiliser partout dans l'interface : contrairement à l'export statique
 * `t` de lib/i18n, ce hook re-rend le composant au changement de langue.
 */
export function useT(): Messages {
  return useStore().t;
}

/** Formateur accordé à la langue courante. */
export function useFmt(): StoreValue["fmt"] {
  return useStore().fmt;
}
