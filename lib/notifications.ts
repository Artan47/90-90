/**
 * Rappels locaux — strictement côté appareil.
 *
 * Aucun serveur, aucune souscription push : on utilise l'API Notification
 * locale au moment où l'app est ouverte, et on n'alerte qu'une fois par jour
 * et par seuil (mémorisé dans localStorage).
 *
 * Seuils demandés : moins de 15 jours restants, moins de 7 jours restants,
 * et 3 jours avant la date limite de sortie.
 */

import type { IsoDate } from "./date";
import { diffDays, formatDate } from "./date";
import { passportStatus } from "./passport";
import type { Profile } from "./types";
import { fill, getMessages, DEFAULT_LOCALE, type Locale, type Messages } from "./i18n";

const SEEN_KEY = "sa-dite:notified:v1";

export type NotificationSupport = "granted" | "denied" | "default" | "unsupported";

export function notificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationSupport;
}

export async function requestNotifications(): Promise<NotificationSupport> {
  if (notificationSupport() === "unsupported") return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotificationSupport;
  } catch {
    return "denied";
  }
}

function alreadySent(key: string): boolean {
  try {
    const seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}") as
      Record<string, boolean>;
    return seen[key] === true;
  } catch {
    return false;
  }
}

function markSent(key: string): void {
  try {
    const seen = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}") as
      Record<string, boolean>;
    seen[key] = true;
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Stockage indisponible : on renoncera simplement à la déduplication.
  }
}

export interface ReminderInput {
  today: IsoDate;
  remaining: number;
  mustLeaveBy: IsoDate | null;
  /** Profil, pour l'alerte d'expiration du passeport. */
  profile?: Profile;
  /** Langue des rappels ; l'albanais par défaut. */
  locale?: Locale;
}

/**
 * Décide quels rappels sont dus. Fonction pure : testable, et sans effet de
 * bord — l'envoi est fait par `runReminders`.
 */
export function dueReminders(
  input: ReminderInput,
): Array<{ key: string; title: string; body: string }> {
  const out: Array<{ key: string; title: string; body: string }> = [];
  const { today, remaining, mustLeaveBy } = input;
  const t: Messages = getMessages(input.locale ?? DEFAULT_LOCALE);

  if (remaining < 7) {
    out.push({
      key: `lt7:${today}`,
      title: t.appName,
      body: fill(t.notifications.under7, { n: remaining }, input.locale ?? DEFAULT_LOCALE),
    });
  } else if (remaining < 15) {
    out.push({
      key: `lt15:${today}`,
      title: t.appName,
      body: fill(t.notifications.under15, { n: remaining }, input.locale ?? DEFAULT_LOCALE),
    });
  }

  if (mustLeaveBy) {
    const left = diffDays(today, mustLeaveBy);
    if (left <= 3 && left >= 0) {
      out.push({
        key: `leave:${mustLeaveBy}:${today}`,
        title: t.appName,
        body: fill(t.home.insideBanner, { date: formatDate(mustLeaveBy) }, input.locale ?? DEFAULT_LOCALE),
      });
    }
  }

  // Passeport : alerte dès qu'il reste moins de 6 mois de validité, puis
  // une fois expiré. La clé inclut la date d'expiration pour qu'un nouveau
  // passeport réarme l'alerte.
  if (input.profile) {
    const passport = passportStatus(input.profile, today);
    if (passport.expired) {
      out.push({
        key: `passport-expired:${input.profile.passportExpiry}:${today}`,
        title: t.appName,
        body: t.settings.passportExpired,
      });
    } else if (passport.expiringSoon && passport.daysUntilExpiry !== null) {
      out.push({
        key: `passport-6m:${input.profile.passportExpiry}:${today}`,
        title: t.appName,
        body: fill(t.notifications.passportSoon, {
          date: formatDate(input.profile.passportExpiry as IsoDate),
          n: passport.daysUntilExpiry,
        }, input.locale ?? DEFAULT_LOCALE),
      });
    }
  }

  return out;
}

/** Envoie les rappels dus qui n'ont pas déjà été envoyés aujourd'hui. */
export function runReminders(input: ReminderInput): void {
  if (notificationSupport() !== "granted") return;
  for (const r of dueReminders(input)) {
    if (alreadySent(r.key)) continue;
    try {
      new Notification(r.title, { body: r.body, icon: "/icons/icon-192.png", tag: r.key });
      markSent(r.key);
    } catch {
      // Certaines plateformes (iOS hors PWA installée) refusent le
      // constructeur : on abandonne silencieusement.
      return;
    }
  }
}
