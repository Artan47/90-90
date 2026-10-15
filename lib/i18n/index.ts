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

export const DEFAULT_LOCALE: Locale = "sq";

export function isLocale(value: unknown): value is Locale {
  return value === "sq" || value === "fr";
}

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return LOCALES[locale];
}

/**
 * Langue à utiliser au premier lancement, déduite du navigateur.
 * Tout ce qui n'est pas clairement du français retombe sur l'albanais :
 * c'est la langue des utilisateurs visés.
 */
export function detectLocale(
  languages: readonly string[] = typeof navigator !== "undefined"
    ? navigator.languages ?? [navigator.language]
    : [],
): Locale {
  for (const lang of languages) {
    const code = lang.toLowerCase();
    if (code.startsWith("sq")) return "sq";
    if (code.startsWith("fr")) return "fr";
  }
  return DEFAULT_LOCALE;
}

/**
 * Messages de la langue par défaut.
 * Réservé à ce qui est rendu hors de React (métadonnées du document).
 * Dans un composant, utiliser `useT()` : seul le hook suit le changement
 * de langue.
 */
export const t: Messages = sq;

/** Remplace les jetons {clé} d'un libellé. */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
