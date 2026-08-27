/**
 * Point d'entrée des traductions.
 *
 * Une seule langue pour l'instant (albanais). Pour en ajouter une :
 * dupliquer `sq.ts`, traduire les valeurs, l'importer ici et l'ajouter à
 * `LOCALES`. Le type `Messages` impose une couverture complète des clés.
 */

import sq, { type Messages } from "./sq";

export type { Messages };
export type Locale = "sq";

export const LOCALES: Record<Locale, Messages> = { sq };

export const DEFAULT_LOCALE: Locale = "sq";

export function getMessages(locale: Locale = DEFAULT_LOCALE): Messages {
  return LOCALES[locale];
}

/** Messages courants, sans passer par un contexte React. */
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
