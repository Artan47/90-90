/**
 * Point d'entrée des traductions.
 *
 * L'albanais (`sq`) est la langue de référence : le type `Messages` en est
 * dérivé, donc une clé oubliée dans une autre langue casse la compilation.
 *
 * Pour ajouter une langue : dupliquer `sq.ts`, traduire les valeurs sans
 * toucher aux clés, puis l'ajouter à `LOCALES` et à `LOCALE_LABELS`.
 */

import sq, { type Messages } from "./sq";
import fr from "./fr";

export type { Messages };
export type Locale = "sq" | "fr";

export const LOCALES: Record<Locale, Messages> = { sq, fr };

/** Libellé de chaque langue, écrit DANS cette langue. */
export const LOCALE_LABELS: Record<Locale, string> = {
  sq: "Shqip",
  fr: "Français",
};

export const LOCALE_ORDER: readonly Locale[] = ["sq", "fr"];

/**
 * Langue d'ouverture, pour tout le monde.
 *
 * L'application est destinée à des Albanophones : elle s'ouvre en albanais
 * quelle que soit la langue du téléphone. On ne déduit PLUS la langue du
 * navigateur — un proche dont le téléphone est en français ou en allemand
 * doit quand même arriver sur une interface albanaise.
 *
 * Deux moyens d'en changer : le sélecteur des réglages, dont le choix est
 * conservé, ou « ?lang=fr » dans l'adresse du lien envoyé.
 */
export const DEFAULT_LOCALE: Locale = "sq";

export function isLocale(value: unknown): value is Locale {
  return value === "sq" || value === "fr";
}

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return LOCALES[locale];
}

/**
 * Langue imposée par l'adresse, via « ?lang=sq » ou « ?lang=fr ».
 *
 * Permet d'envoyer un lien qui s'ouvre d'emblée dans la bonne langue,
 * sans dépendre des réglages du téléphone de celui qui le reçoit :
 *   https://www.sadite.ch/?lang=sq
 *
 * Le choix est ensuite conservé comme si la personne l'avait fait
 * elle-même dans les réglages.
 */
export function localeFromUrl(search?: string): Locale | null {
  const query =
    search ?? (typeof window === "undefined" ? "" : window.location.search);
  if (!query) return null;
  try {
    const value = new URLSearchParams(query).get("lang");
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * Messages de la langue par défaut.
 * Réservé à ce qui est rendu hors de React (métadonnées du document).
 * Dans un composant, utiliser `useT()` : seul le hook suit le changement
 * de langue.
 */
export const t: Messages = sq;

/**
 * Remplace les jetons d'un libellé.
 *
 *   {clé}                  → la valeur
 *   {clé#singulier#pluriel} → la forme accordée au nombre `clé`
 *
 * L'accord suit les règles réelles de la langue via Intl.PluralRules, et
 * non un `n === 1` approximatif : le français met « 0 jour » au singulier,
 * l'albanais met « 0 ditë » au pluriel. Sans ça, l'application afficherait
 * « 1 jours » et « 1 séjours » partout.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE,
): string {
  return template
    .replace(/\{(\w+)#([^#{}]*)#([^#{}]*)\}/g, (match, key: string, one: string, other: string) => {
      if (!(key in values)) return match;
      const n = Number(values[key]);
      if (!Number.isFinite(n)) return match;
      return pluralRules(locale).select(n) === "one" ? one : other;
    })
    .replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? String(values[key]) : match,
    );
}

const RULES = new Map<Locale, Intl.PluralRules>();

function pluralRules(locale: Locale): Intl.PluralRules {
  let rules = RULES.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(locale);
    RULES.set(locale, rules);
  }
  return rules;
}
