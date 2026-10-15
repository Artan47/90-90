/**
 * Persistance locale.
 *
 * Aucune donnée ne quitte l'appareil : tout vit dans localStorage, et rien
 * d'autre. Le wrapper doit survivre à trois situations réelles :
 *   - le rendu serveur de Next (pas de `window`) ;
 *   - la navigation privée de Safari, où `setItem` lève une exception ;
 *   - un navigateur où le stockage est désactivé par politique.
 * Dans ces cas on bascule sur une mémoire volatile : l'app reste utilisable
 * pendant la session, et l'interface prévient que rien ne sera conservé.
 */

import type { AppData, Person, Profile, Stay } from "./types";
import { emptyData } from "./types";
import type { Account, AccountContent } from "./accounts";
import { personToAccount } from "./accounts";
import { normalizeEmail } from "./crypto";
import { isIsoDate } from "./date";
import { isLocale, type Locale } from "./i18n";

const KEY = "sa-dite:v1";

let memoryFallback: string | null = null;
let storageUsable: boolean | null = null;

/** Le stockage persistant est-il réellement disponible ? */
export function isStorageAvailable(): boolean {
  if (storageUsable !== null) return storageUsable;
  if (typeof window === "undefined") return (storageUsable = false);
  try {
    const probe = "__sa_dite_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return (storageUsable = true);
  } catch {
    return (storageUsable = false);
  }
}

function readRaw(): string | null {
  if (!isStorageAvailable()) return memoryFallback;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return memoryFallback;
  }
}

function writeRaw(value: string): void {
  memoryFallback = value;
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    // Quota dépassé ou stockage verrouillé : on garde la copie en mémoire.
    storageUsable = false;
  }
}

/**
 * Valide une structure venue de localStorage ou d'un fichier importé, et
 * MIGRE les anciennes sauvegardes.
 *
 *   v1 — une personne implicite      → un compte ouvert
 *   v2 — plusieurs personnes         → un compte ouvert par personne
 *   v3 — comptes (format courant)
 *
 * Aucune donnée n'est jamais perdue : une personne sans mot de passe
 * devient un compte OUVERT, que l'interface invite ensuite à protéger.
 * Exiger un mot de passe pendant la migration aurait rendu les données
 * inaccessibles à qui n'aurait pas compris l'écran.
 */
export function parseData(raw: unknown, defaultName = "Unë"): AppData {
  if (typeof raw !== "object" || raw === null) return emptyData();
  const obj = raw as Record<string, unknown>;

  const locale = isLocale(obj.locale) ? obj.locale : null;

  // ── Version 3 : comptes ──────────────────────────────────────────────
  if (Array.isArray(obj.accounts)) {
    const accounts = obj.accounts.flatMap((a) => sanitizeAccount(a, defaultName));
    const activeId =
      typeof obj.activeId === "string" && accounts.some((a) => a.id === obj.activeId)
        ? obj.activeId
        : null;
    return { version: 3, accounts, activeId, locale };
  }

  // ── Version 2 : personnes ────────────────────────────────────────────
  if (Array.isArray(obj.people)) {
    const accounts = obj.people
      .flatMap((p) => sanitizePerson(p, defaultName))
      .map(personToAccount);
    return { version: 3, accounts, activeId: null, locale };
  }

  // ── Version 1 : une seule personne, implicite ────────────────────────
  if (Array.isArray(obj.stays) || typeof obj.profile === "object") {
    const person = sanitizePerson(
      { id: newId(), name: defaultName, stays: obj.stays, profile: obj.profile },
      defaultName,
    )[0];
    if (!person) return { ...emptyData(), locale };
    const legacy = person.profile.locale;
    delete person.profile.locale;
    return {
      version: 3,
      accounts: [personToAccount(person)],
      activeId: null,
      locale: locale ?? (isLocale(legacy) ? legacy : null),
    };
  }

  return { ...emptyData(), locale };
}

function sanitizeAccount(raw: unknown, defaultName: string): Account[] {
  if (typeof raw !== "object" || raw === null) return [];
  const a = raw as Record<string, unknown>;

  const id = typeof a.id === "string" && a.id.length > 0 ? a.id : newId();
  const name =
    typeof a.name === "string" && a.name.trim().length > 0
      ? a.name.trim().slice(0, 40)
      : defaultName;
  const email =
    typeof a.email === "string" && a.email.trim().length > 0
      ? normalizeEmail(a.email)
      : null;

  const sealedRaw = a.sealed as Record<string, unknown> | undefined;
  const sealed =
    sealedRaw &&
    typeof sealedRaw.salt === "string" &&
    typeof sealedRaw.iv === "string" &&
    typeof sealedRaw.data === "string"
      ? { salt: sealedRaw.salt, iv: sealedRaw.iv, data: sealedRaw.data }
      : undefined;

  // Protégé : on ne garde QUE le chiffré. Ouvert : on ne garde que le clair.
  if (email !== null && sealed) return [{ id, name, email, sealed }];
  return [{ id, name, email: null, content: sanitizeContent(a.content) }];
}

export function sanitizeContent(raw: unknown): AccountContent {
  if (typeof raw !== "object" || raw === null) return { stays: [], profile: {} };
  const c = raw as Record<string, unknown>;
  const person = sanitizePerson({ id: "x", name: "x", stays: c.stays, profile: c.profile }, "x")[0];
  return { stays: person?.stays ?? [], profile: person?.profile ?? {} };
}

function sanitizePerson(raw: unknown, defaultName: string): Person[] {
  if (typeof raw !== "object" || raw === null) return [];
  const p = raw as Record<string, unknown>;

  const stays = Array.isArray(p.stays) ? p.stays.flatMap(sanitizeStay) : [];
  const profileRaw =
    typeof p.profile === "object" && p.profile !== null
      ? (p.profile as Record<string, unknown>)
      : {};

  const profile: Profile = {};
  if (isIsoDate(profileRaw.passportExpiry)) profile.passportExpiry = profileRaw.passportExpiry;
  if (isIsoDate(profileRaw.passportIssued)) profile.passportIssued = profileRaw.passportIssued;
  if (isLocale(profileRaw.locale)) profile.locale = profileRaw.locale;

  const name =
    typeof p.name === "string" && p.name.trim().length > 0
      ? p.name.trim().slice(0, 40)
      : defaultName;

  return [{ id: typeof p.id === "string" && p.id.length > 0 ? p.id : newId(), name, stays, profile }];
}

function sanitizeStay(raw: unknown): Stay[] {
  if (typeof raw !== "object" || raw === null) return [];
  const s = raw as Record<string, unknown>;
  if (!isIsoDate(s.entry)) return [];
  const exit = s.exit === null || s.exit === undefined ? null : isIsoDate(s.exit) ? s.exit : null;

  const stay: Stay = {
    id: typeof s.id === "string" && s.id.length > 0 ? s.id : newId(),
    entry: s.entry,
    exit,
    country:
      typeof s.country === "string" && s.country.length > 0
        ? s.country.toUpperCase()
        : "OTHER",
  };
  if (typeof s.note === "string" && s.note.length > 0) stay.note = s.note;
  if (s.exempt === true) stay.exempt = true;
  if (s.planned === true) stay.planned = true;
  return [stay];
}

export function peekLocale(): Locale | null {
  const raw = readRaw();
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    if (isLocale(obj.locale)) return obj.locale;
    const profile = obj.profile as Record<string, unknown> | undefined;
    if (profile && isLocale(profile.locale)) return profile.locale; // version 1
    return null;
  } catch {
    return null;
  }
}

export function loadData(defaultName = "Unë"): AppData {
  const raw = readRaw();
  if (!raw) return emptyData();
  try {
    return parseData(JSON.parse(raw), defaultName);
  } catch {
    return emptyData();
  }
}

export function saveData(data: AppData): void {
  writeRaw(JSON.stringify(data));
}

/** Identifiant local : crypto.randomUUID si disponible, sinon repli. */
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const rnd =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join("")
      : Math.random().toString(16).slice(2, 18);
  return `s_${rnd}`;
}

// ── Export / import JSON ───────────────────────────────────────────────

export function toExportString(data: AppData): string {
  return JSON.stringify(
    { app: "sa-dite", exportedAt: new Date().toISOString(), ...data },
    null,
    2,
  );
}

export function fromImportString(text: string, defaultName = "Unë"): AppData {
  return parseData(JSON.parse(text), defaultName);
}

/** Déclenche le téléchargement du fichier de sauvegarde. */
export function downloadExport(data: AppData, filename: string): void {
  const blob = new Blob([toExportString(data)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
