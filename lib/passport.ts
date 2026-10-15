/**
 * Contrôles de validité du passeport — fonctions pures, sans horloge.
 *
 * Les règles s'expriment en MOIS calendaires, pas en multiples de 30 jours :
 * « valable au moins 3 mois après la sortie prévue », « délivré depuis moins
 * de 10 ans ». On passe donc par addMonths / addYears.
 *
 * Rappel : ces contrôles ne font pas partie de la règle 90/180. Un compteur
 * au vert ne sert à rien si le passeport est refusé à la frontière.
 */

import {
  type IsoDate, addMonths, addYears, isIsoDate, isAfter, isBefore,
  diffDays, isSameOrAfter,
} from "./date";
import type { Profile } from "./types";

/** Validité minimale exigée après la date de sortie prévue. */
export const MONTHS_AFTER_EXIT = 3;

/** Durée de vie maximale d'un passeport biométrique. */
export const MAX_PASSPORT_YEARS = 10;

/** Seuil d'alerte anticipée sur l'expiration. */
export const WARN_MONTHS_BEFORE_EXPIRY = 6;

export interface PassportStatus {
  /** Une date d'expiration est renseignée. */
  hasExpiry: boolean;
  /** Le passeport a déjà expiré au jour évalué. */
  expired: boolean;
  /** Il expire dans moins de 6 mois. */
  expiringSoon: boolean;
  /** Jours restants avant expiration (négatif si expiré). */
  daysUntilExpiry: number | null;
  /** Date à partir de laquelle l'alerte 6 mois se déclenche. */
  warnFrom: IsoDate | null;
  /** Délivré il y a plus de 10 ans. */
  tooOld: boolean;
  /** Date limite des 10 ans. */
  tenYearLimit: IsoDate | null;
  /**
   * Ne couvre pas la sortie prévue + 3 mois.
   * `null` si aucune sortie n'est connue.
   */
  insufficientForExit: boolean | null;
  /** Date d'expiration minimale pour la sortie prévue. */
  requiredExpiry: IsoDate | null;
  /** Au moins un point bloquant ou à surveiller. */
  anyWarning: boolean;
}

export function passportStatus(
  profile: Profile,
  today: IsoDate,
  plannedExit: IsoDate | null = null,
): PassportStatus {
  const expiry = isIsoDate(profile.passportExpiry) ? profile.passportExpiry : null;
  const issued = isIsoDate(profile.passportIssued) ? profile.passportIssued : null;

  const expired = expiry !== null && isBefore(expiry, today);
  const warnFrom = expiry !== null ? addMonths(expiry, -WARN_MONTHS_BEFORE_EXPIRY) : null;
  const expiringSoon =
    expiry !== null && !expired && warnFrom !== null && isSameOrAfter(today, warnFrom);

  const tenYearLimit = issued !== null ? addYears(issued, MAX_PASSPORT_YEARS) : null;
  const tooOld = tenYearLimit !== null && isBefore(tenYearLimit, today);

  const requiredExpiry =
    plannedExit !== null && isIsoDate(plannedExit)
      ? addMonths(plannedExit, MONTHS_AFTER_EXIT)
      : null;
  const insufficientForExit =
    expiry === null || requiredExpiry === null ? null : isBefore(expiry, requiredExpiry);

  return {
    hasExpiry: expiry !== null,
    expired,
    expiringSoon,
    daysUntilExpiry: expiry !== null ? diffDays(today, expiry) : null,
    warnFrom,
    tooOld,
    tenYearLimit,
    insufficientForExit,
    requiredExpiry,
    anyWarning: expired || expiringSoon || tooOld || insufficientForExit === true,
  };
}

/** Vrai si `date` est strictement postérieure à `other`. */
export const laterThan = isAfter;
