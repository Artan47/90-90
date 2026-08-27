import type { IsoDate } from "./date";

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

export interface Profile {
  passportExpiry?: IsoDate;
  passportIssued?: IsoDate;
  locale: "sq";
}

export interface AppData {
  version: 1;
  stays: Stay[];
  profile: Profile;
}

export const DEFAULT_PROFILE: Profile = { locale: "sq" };

export function emptyData(): AppData {
  return { version: 1, stays: [], profile: { ...DEFAULT_PROFILE } };
}
