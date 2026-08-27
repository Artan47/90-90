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

interface StoreValue {
  data: AppData;
  today: IsoDate;
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

  // Chargement au montage seulement : localStorage n'existe pas au rendu
  // serveur, et l'hydratation doit partir du même état vide.
  useEffect(() => {
    setData(loadData());
    setStorageOk(isStorageAvailable());
    setToday(todayIso());
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

  const value = useMemo<StoreValue>(() => {
    const addStay = (stay: Omit<Stay, "id">): Stay => {
      const created: Stay = { ...stay, id: newId() };
      persist({ ...data, stays: [...data.stays, created] });
      return created;
    };

    return {
      data,
      today,
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
  }, [data, today, ready, storageOk, persist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore duhet përdorur brenda StoreProvider");
  return ctx;
}
