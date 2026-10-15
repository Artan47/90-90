"use client";

/**
 * État applicatif partagé : les comptes, la session ouverte, et la date du
 * jour.
 *
 * Les comptes sont LOCAUX : aucun serveur, aucune inscription distante.
 * Un compte protégé range son contenu chiffré (lib/crypto.ts) ; il n'est
 * déchiffré qu'en mémoire, le temps de la session. La clé est gardée dans
 * `sessionStorage` pour qu'un simple rechargement ne déconnecte pas, mais
 * fermer l'application l'efface.
 *
 * La date du jour est tenue ici et rafraîchie au retour au premier plan :
 * le moteur de calcul, lui, ne lit jamais l'horloge.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import type { AppData, Person, Profile, Stay } from "@/lib/types";
import { emptyData, activeAccount } from "@/lib/types";
import type { Account, AccountContent } from "@/lib/accounts";
import {
  accountToPerson, emailTaken, emptyContent, findByEmail, isProtected, openContent,
} from "@/lib/accounts";
import {
  deriveKey, exportKey, importKey, randomBytes, normalizeEmail, seal, unseal,
  fromBase64, isEmailLike, isPasswordAcceptable,
} from "@/lib/crypto";
import {
  loadData, saveData, newId, isStorageAvailable, peekLocale, sanitizeContent,
} from "@/lib/storage";
import { todayIso, type IsoDate } from "@/lib/date";
import {
  detectLocale, getMessages, fill, DEFAULT_LOCALE, type Locale, type Messages,
} from "@/lib/i18n";

export type AuthResult =
  | "ok" | "unknown-email" | "wrong-password" | "email-taken" | "invalid";

const SESSION_KEY = "sa-dite:session";

interface StoreValue {
  data: AppData;
  today: IsoDate;
  ready: boolean;
  storageOk: boolean;

  accounts: Account[];
  account: Account | null;
  signedIn: boolean;
  person: Person | null;
  profile: Profile;

  signIn: (email: string, password: string) => Promise<AuthResult>;
  openAccount: (id: string) => void;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  createOpenAccount: (name: string) => void;
  protectAccount: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => void;
  renameAccount: (id: string, name: string) => void;
  removeAccount: (id: string) => void;

  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
  fmt: (template: string, values: Record<string, string | number>) => string;

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
  const [detected, setDetected] = useState<Locale>(DEFAULT_LOCALE);

  /** Contenu déchiffré du compte connecté — jamais écrit en clair. */
  const [content, setContent] = useState<AccountContent | null>(null);
  /** Clé AES du compte connecté, pour le temps de la session. */
  const [key, setKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    const detectedLocale = detectLocale();
    setDetected(detectedLocale);
    // La langue DÉJÀ enregistrée l'emporte sur celle du navigateur.
    const defaultName = getMessages(peekLocale() ?? detectedLocale).people.defaultName;
    const loaded = loadData(defaultName);
    setData(loaded);
    setStorageOk(isStorageAvailable());
    setToday(todayIso());
    void restoreSession(loaded).finally(() => setReady(true));
    if (loaded.accounts.length > 0) saveData(loaded);
  }, []);

  /** Rouvre la session d'un rechargement, si la clé est encore en mémoire. */
  async function restoreSession(loaded: AppData) {
    const account = activeAccount(loaded);
    if (!account) return;
    if (!isProtected(account)) {
      setContent(openContent(account) ?? emptyContent());
      return;
    }
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      raw = null;
    }
    if (!raw) return;
    const restored = await importKey(raw);
    if (!restored) return;
    const decoded = await unseal(restored, account.sealed!);
    if (decoded === null) return;
    setKey(restored);
    setContent(sanitizeContent(decoded));
  }

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

  const locale: Locale = data.locale ?? detected;
  const messages = getMessages(locale);
  const account = activeAccount(data);
  const signedIn = account !== null && content !== null;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<StoreValue>(() => {
    /** Range le contenu : chiffré si le compte est protégé, clair sinon. */
    const writeContent = async (next: AccountContent) => {
      setContent(next);
      if (!account) return;
      if (isProtected(account) && key) {
        const sealed = await seal(key, fromBase64(account.sealed!.salt), next);
        persist({
          ...data,
          accounts: data.accounts.map((a) =>
            a.id === account.id ? { ...a, sealed } : a,
          ),
        });
      } else {
        persist({
          ...data,
          accounts: data.accounts.map((a) =>
            a.id === account.id ? { ...a, content: next } : a,
          ),
        });
      }
    };

    const patchContent = (fn: (c: AccountContent) => AccountContent) => {
      if (!content) return;
      void writeContent(fn(content));
    };

    const rememberKey = async (k: CryptoKey) => {
      try {
        window.sessionStorage.setItem(SESSION_KEY, await exportKey(k));
      } catch {
        // Stockage de session indisponible : la session durera le temps
        // de la navigation, sans survivre à un rechargement.
      }
    };

    const forgetKey = () => {
      try {
        window.sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* rien à faire */
      }
    };

    return {
      data,
      today,
      ready,
      storageOk,

      accounts: data.accounts,
      account,
      signedIn,
      person: account && content ? accountToPerson(account, content) : null,
      profile: content?.profile ?? {},

      signIn: async (email, password) => {
        const found = findByEmail(data.accounts, email);
        if (!found || !found.sealed) return "unknown-email";
        const derived = await deriveKey(password, fromBase64(found.sealed.salt));
        const decoded = await unseal(derived, found.sealed);
        if (decoded === null) return "wrong-password";
        setKey(derived);
        setContent(sanitizeContent(decoded));
        await rememberKey(derived);
        persist({ ...data, activeId: found.id });
        return "ok";
      },

      openAccount: (id) => {
        const target = data.accounts.find((a) => a.id === id);
        if (!target || isProtected(target)) return;
        setKey(null);
        forgetKey();
        setContent(openContent(target) ?? emptyContent());
        persist({ ...data, activeId: id });
      },

      register: async (name, email, password) => {
        if (!isEmailLike(email) || !isPasswordAcceptable(password)) return "invalid";
        if (emailTaken(data.accounts, email)) return "email-taken";
        const salt = randomBytes(16);
        const derived = await deriveKey(password, salt);
        const fresh = emptyContent();
        const sealed = await seal(derived, salt, fresh);
        const created: Account = {
          id: newId(),
          name: name.trim().slice(0, 40) || messages.people.defaultName,
          email: normalizeEmail(email),
          sealed,
        };
        setKey(derived);
        setContent(fresh);
        await rememberKey(derived);
        persist({ ...data, accounts: [...data.accounts, created], activeId: created.id });
        return "ok";
      },

      createOpenAccount: (name) => {
        const created: Account = {
          id: newId(),
          name: name.trim().slice(0, 40) || messages.people.defaultName,
          email: null,
          content: emptyContent(),
        };
        setKey(null);
        forgetKey();
        setContent(emptyContent());
        persist({ ...data, accounts: [...data.accounts, created], activeId: created.id });
      },

      protectAccount: async (email, password) => {
        if (!account || !content) return "invalid";
        if (!isEmailLike(email) || !isPasswordAcceptable(password)) return "invalid";
        if (emailTaken(data.accounts, email, account.id)) return "email-taken";
        const salt = randomBytes(16);
        const derived = await deriveKey(password, salt);
        const sealed = await seal(derived, salt, content);
        setKey(derived);
        await rememberKey(derived);
        persist({
          ...data,
          accounts: data.accounts.map((a) =>
            a.id === account.id
              ? { id: a.id, name: a.name, email: normalizeEmail(email), sealed }
              : a,
          ),
        });
        return "ok";
      },

      signOut: () => {
        setKey(null);
        setContent(null);
        forgetKey();
        persist({ ...data, activeId: null });
      },

      renameAccount: (id, name) =>
        persist({
          ...data,
          accounts: data.accounts.map((a) =>
            a.id === id ? { ...a, name: name.trim().slice(0, 40) || a.name } : a,
          ),
        }),

      removeAccount: (id) => {
        const accounts = data.accounts.filter((a) => a.id !== id);
        if (data.activeId === id) {
          setKey(null);
          setContent(null);
          forgetKey();
        }
        persist({
          ...data,
          accounts,
          activeId: data.activeId === id ? null : data.activeId,
        });
      },

      locale,
      setLocale: (next: Locale) => persist({ ...data, locale: next }),
      t: messages,
      fmt: (template, values) => fill(template, values, locale),

      stays: content?.stays ?? [],
      addStay: (stay) => {
        const created: Stay = { ...stay, id: newId() };
        patchContent((c) => ({ ...c, stays: [...c.stays, created] }));
        return created;
      },
      updateStay: (id, patch) =>
        patchContent((c) => ({
          ...c,
          stays: c.stays.map((s) => (s.id === id ? { ...s, ...patch } : s)),
        })),
      removeStay: (id) =>
        patchContent((c) => ({ ...c, stays: c.stays.filter((s) => s.id !== id) })),
      setProfile: (patch) =>
        patchContent((c) => ({ ...c, profile: { ...c.profile, ...patch } })),

      replaceAll: (next) => {
        setKey(null);
        setContent(null);
        forgetKey();
        persist({ ...next, activeId: null });
      },
      clearAll: () => {
        setKey(null);
        setContent(null);
        forgetKey();
        persist(emptyData());
      },
    };
  }, [data, account, content, key, signedIn, today, locale, messages, ready, storageOk, persist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/**
 * Libellés de la langue courante.
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
