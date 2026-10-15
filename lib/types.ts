import type { IsoDate } from "./date";
import type { Locale } from "./i18n";

export type { IsoDate };

export interface Stay {
  id: string;
  /** Premier jour de présence. Compte comme journée pleine. */
  entry: IsoDate;
  /** Dernier jour de présence. `null` = séjour en cours, non terminé. */
  exit: IsoDate | null;
  /** ISO-3166-1 alpha-2, informatif — le quota est commun à tout Schengen. */
  country: string;
  note?: string;
  /** Visa national long séjour (type D) ou titre de séjour → ne compte pas. */
  exempt?: boolean;
  /** Voyage simulé : exclu de l'historique réel. */
  planned?: boolean;
}

/** Pièces d'identité d'une personne. */
export interface Profile {
  passportExpiry?: IsoDate;
  passportIssued?: IsoDate;
  /**
   * @deprecated La langue est un réglage de l'application, pas d'une
   * personne. Conservé pour relire les sauvegardes de la version 1.
   */
  locale?: Locale | null;
}

/**
 * Une personne suivie par l'application.
 *
 * Chacune a SON historique et SON passeport : le quota 90/180 est
 * individuel, et mélanger deux personnes dans un même compteur donnerait
 * un résultat faux sans le moindre avertissement.
 */
export interface Person {
  id: string;
  name: string;
  stays: Stay[];
  profile: Profile;
}

export interface AppData {
  version: 2;
  people: Person[];
  /** Personne affichée. `null` si la liste est vide. */
  activeId: string | null;
  /** Langue de l'interface — commune à toutes les personnes. */
  locale: Locale | null;
}

export const DEFAULT_PROFILE: Profile = {};

export function makePerson(id: string, name: string): Person {
  return { id, name, stays: [], profile: { ...DEFAULT_PROFILE } };
}

export function emptyData(): AppData {
  return { version: 2, people: [], activeId: null, locale: null };
}

/** La personne affichée, ou `null` si aucune. */
export function activePerson(data: AppData): Person | null {
  if (data.people.length === 0) return null;
  return data.people.find((p) => p.id === data.activeId) ?? data.people[0] ?? null;
}
