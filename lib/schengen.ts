/**
 * MOTEUR DE CALCUL 90/180 — fonctions pures, sans UI et sans horloge.
 *
 * Base légale : article 6 §1 du règlement (UE) 2016/399 (code frontières
 * Schengen) — 90 jours maximum sur toute période de 180 jours, « ce qui
 * implique d'examiner la période de 180 jours précédant chaque jour de
 * séjour ».
 *
 * Les cinq règles implémentées ici :
 *   1. Fenêtre GLISSANTE [D − 179 ; D], 180 jours bornes incluses. Aucune
 *      remise à zéro au 1er janvier, aucun semestre.
 *   2. Le jour d'entrée et le jour de sortie comptent chacun pour une
 *      journée pleine. Entrée et sortie le même jour = 1 jour.
 *   3. On compte des JOURS DE PRÉSENCE DISTINCTS (un Set), pas une somme de
 *      durées : deux séjours qui se chevauchent ne comptent leurs jours
 *      communs qu'une fois.
 *   4. Le quota est commun à tout l'espace Schengen, pas par pays.
 *   5. Sont exclus : les jours sous visa D / titre de séjour (`exempt`) et
 *      les jours passés dans un pays qui ne fait pas partie de Schengen à
 *      cette date-là (table datée, lib/schengen-membership.ts).
 *
 * Le jour de référence est TOUJOURS un paramètre : rien ici ne lit
 * `new Date()`, ce qui rend l'ensemble testable et déterministe.
 */

import {
  type IsoDate,
  addDays, eachDay, isAfter, isBefore, isIsoDate, isSameOrBefore,
  maxDate, minDate, inclusiveDays,
} from "./date";
import { isSchengenOn } from "./schengen-membership";
import type { Stay } from "./types";

/** Largeur de la fenêtre glissante, en jours calendaires. */
export const WINDOW = 180;

/** Plafond de jours de présence à l'intérieur de la fenêtre. */
export const MAX_DAYS = 90;

/**
 * Garde-fou des boucles jour par jour. La réponse recherchée tombe toujours
 * dans les 180 jours qui suivent, on borne donc largement au-dessus pour ne
 * jamais boucler à l'infini sur une donnée aberrante.
 */
export const MAX_ITERATIONS = 400;

/** Borne inférieure d'examen : antérieure à tout séjour saisissable. */
const EARLIEST: IsoDate = "1900-01-01";

// ──────────────────────────────────────────────────────────────────────
// Fenêtre
// ──────────────────────────────────────────────────────────────────────

/** Premier jour de la fenêtre glissante qui se termine le jour `day`. */
export function windowStart(day: IsoDate): IsoDate {
  return addDays(day, -(WINDOW - 1));
}

/** Dernier jour de la fenêtre : le jour évalué lui-même. */
export function windowEnd(day: IsoDate): IsoDate {
  return day;
}

// ──────────────────────────────────────────────────────────────────────
// Comptage
// ──────────────────────────────────────────────────────────────────────

/** Durée saisie d'un séjour, bornes incluses (indépendante du quota). */
export function stayDays(stay: Stay, openEndedUntil?: IsoDate): number {
  if (!isIsoDate(stay.entry)) return 0;
  const exit = stay.exit ?? openEndedUntil ?? null;
  if (exit === null || !isIsoDate(exit)) return 0;
  if (isBefore(exit, stay.entry)) return 0;
  return inclusiveDays(stay.entry, exit);
}

/**
 * Les jours de présence qui CONSOMMENT le quota, entre `from` et `to` inclus.
 *
 * - exclut les séjours `exempt` (visa D, titre de séjour) ;
 * - exclut les séjours `planned` (voyages simulés, hors historique réel) ;
 * - exclut, jour par jour, les pays qui ne font pas partie de Schengen à
 *   cette date (un séjour à cheval sur une adhésion n'est compté que pour
 *   sa portion à partir de la date d'effet) ;
 * - DÉDOUBLONNE les chevauchements grâce au Set ;
 * - un séjour en cours (`exit === null`) est réputé se terminer le dernier
 *   jour examiné, `to`.
 */
export function countedDays(stays: Stay[], from: IsoDate, to: IsoDate): Set<IsoDate> {
  const days = new Set<IsoDate>();
  if (!isIsoDate(from) || !isIsoDate(to) || isAfter(from, to)) return days;

  for (const stay of stays) {
    if (stay.exempt) continue;
    if (stay.planned) continue;
    if (!isIsoDate(stay.entry)) continue;

    // Séjour en cours : il court jusqu'au dernier jour examiné.
    const rawExit = stay.exit ?? to;
    if (!isIsoDate(rawExit)) continue;
    if (isBefore(rawExit, stay.entry)) continue; // saisie incohérente : ignorée

    const start = maxDate(stay.entry, from);
    const end = minDate(rawExit, to);
    if (isAfter(start, end)) continue;

    for (const day of eachDay(start, end)) {
      if (isSchengenOn(stay.country, day)) days.add(day);
    }
  }
  return days;
}

/** Jours consommés dans la fenêtre glissante qui se termine le jour `day`. */
export function usedOn(stays: Stay[], day: IsoDate): number {
  return countedDays(stays, windowStart(day), day).size;
}

/** Jours encore disponibles le jour `day`, borné à 0 (jamais négatif). */
export function remainingOn(stays: Stay[], day: IsoDate): number {
  return Math.max(0, MAX_DAYS - usedOn(stays, day));
}

/** Le quota est-il respecté le jour `day` ? */
export function isCompliantOn(stays: Stay[], day: IsoDate): boolean {
  return usedOn(stays, day) <= MAX_DAYS;
}

// ──────────────────────────────────────────────────────────────────────
// Séjour en cours
// ──────────────────────────────────────────────────────────────────────

/** Le séjour non terminé qui englobe `day`, s'il existe. */
export function currentStay(stays: Stay[], day: IsoDate): Stay | null {
  for (const stay of stays) {
    if (stay.planned) continue;
    if (stay.exit !== null) continue;
    if (!isIsoDate(stay.entry)) continue;
    if (isSameOrBefore(stay.entry, day)) return stay;
  }
  return null;
}

/**
 * Dernier jour où l'on peut rester sans dépasser, quand un séjour est en
 * cours. `null` si aucun séjour n'est en cours.
 */
export function mustLeaveBy(stays: Stay[], day: IsoDate): IsoDate | null {
  const open = currentStay(stays, day);
  if (!open) return null;

  // On repart de l'entrée réelle : la limite ne dépend pas du jour où l'on
  // pose la question, seulement de l'historique et de la date d'entrée.
  let last = open.entry;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const candidate = addDays(open.entry, i);
    if (usedOn(stays, candidate) > MAX_DAYS) break;
    last = candidate;
  }
  return last;
}

// ──────────────────────────────────────────────────────────────────────
// Projection
// ──────────────────────────────────────────────────────────────────────

export interface MaxStay {
  /** Dernier jour de présence autorisé. */
  lastPossibleExit: IsoDate;
  /** Nombre de nuits (days − 1, jamais négatif). */
  nights: number;
  /** Nombre de journées pleines, entrée et sortie comprises. */
  days: number;
}

/**
 * Durée maximale d'un séjour commençant le jour `entry`.
 *
 * On avance jour par jour tant que le quota tient, en tenant compte du fait
 * que d'anciens jours SORTENT de la fenêtre pendant le séjour et libèrent du
 * crédit au fur et à mesure. C'est pourquoi le résultat est très souvent
 * supérieur au nombre de jours restants aujourd'hui (TEST B : 40 restants,
 * mais 70 jours de séjour possible).
 *
 * Si même le premier jour dépasse, `days` vaut 0 et `lastPossibleExit` est
 * la veille de l'entrée : il n'existe aucun séjour légal à cette date.
 */
export function maxStayFrom(stays: Stay[], entry: IsoDate): MaxStay {
  const probe: Stay = {
    id: "__probe__",
    entry,
    exit: entry,
    country: "DE", // pays Schengen de longue date : le cas le plus contraignant
  };
  const real = stays.filter((s) => !s.planned);

  let days = 0;
  let lastPossibleExit = addDays(entry, -1);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const candidateExit = addDays(entry, i);
    const withTrip = [...real, { ...probe, exit: candidateExit }];
    if (usedOn(withTrip, candidateExit) > MAX_DAYS) break;
    days = i + 1;
    lastPossibleExit = candidateExit;
  }

  return { lastPossibleExit, nights: Math.max(0, days - 1), days };
}

/**
 * Premier jour, à partir de `from`, où au moins un jour de présence est
 * disponible. Après un séjour continu de 90 jours, ce jour arrive quand le
 * tout premier jour consommé sort de la fenêtre — pas après 90 jours dehors.
 */
export function earliestReentry(stays: Stay[], from: IsoDate): IsoDate {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const day = addDays(from, i);
    if (remainingOn(stays, day) >= 1) return day;
  }
  return addDays(from, MAX_ITERATIONS);
}

/**
 * Premier jour, à partir de `from`, où les 90 jours sont de nouveau
 * disponibles, c'est-à-dire où la fenêtre ne contient plus aucun jour
 * consommé.
 */
export function fullResetDate(stays: Stay[], from: IsoDate): IsoDate {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const day = addDays(from, i);
    if (usedOn(stays, day) === 0) return day;
  }
  return addDays(from, MAX_ITERATIONS);
}

// ──────────────────────────────────────────────────────────────────────
// Simulation
// ──────────────────────────────────────────────────────────────────────

export interface SimulationResult {
  ok: boolean;
  /** Premier jour du voyage où le quota est dépassé. */
  firstOverflowDate?: IsoDate;
  /** Nombre de jours à retrancher du voyage pour redevenir légal. */
  daysOver?: number;
}

/** Rend « réels » les séjours planifiés, pour les inclure dans une projection. */
export function materializePlanned(stays: Stay[]): Stay[] {
  return stays.map((s) => (s.planned ? { ...s, planned: false } : s));
}

/**
 * Un voyage projeté est-il légal ?
 *
 * Les séjours déjà enregistrés comme `planned` sont ignorés : un plan ne doit
 * pas se compter lui-même dans sa propre simulation.
 */
export function simulate(
  stays: Stay[],
  trip: { entry: IsoDate; exit: IsoDate },
): SimulationResult {
  if (!isIsoDate(trip.entry) || !isIsoDate(trip.exit)) return { ok: false };
  if (isBefore(trip.exit, trip.entry)) return { ok: false };

  const real = stays.filter((s) => !s.planned);
  const withTrip: Stay[] = [
    ...real,
    { id: "__trip__", entry: trip.entry, exit: trip.exit, country: "DE" },
  ];

  let firstOverflowDate: IsoDate | undefined;
  let daysOver = 0;

  for (const day of eachDay(trip.entry, trip.exit)) {
    const excess = usedOn(withTrip, day) - MAX_DAYS;
    if (excess > 0) {
      if (!firstOverflowDate) firstOverflowDate = day;
      daysOver = Math.max(daysOver, excess);
    }
  }

  if (!firstOverflowDate) return { ok: true };
  return { ok: false, firstOverflowDate, daysOver };
}

// ──────────────────────────────────────────────────────────────────────
// Chronologie
// ──────────────────────────────────────────────────────────────────────

export interface TimelinePoint {
  date: IsoDate;
  used: number;
  remaining: number;
}

/** Un point par jour : jours consommés dans la fenêtre glissante ce jour-là. */
export function timeline(stays: Stay[], from: IsoDate, to: IsoDate): TimelinePoint[] {
  return eachDay(from, to).map((date) => {
    const used = usedOn(stays, date);
    return { date, used, remaining: Math.max(0, MAX_DAYS - used) };
  });
}

// ──────────────────────────────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────────────────────────────

export type IssueCode =
  | "OVERLAP"
  | "EXIT_BEFORE_ENTRY"
  | "FUTURE_ENTRY_IN_HISTORY"
  | "OVER_90";

export interface Issue {
  stayId: string;
  code: IssueCode;
  message: string;
  /** Renseigné pour OVER_90 : premier jour en infraction. */
  firstOverflowDate?: IsoDate;
  /** Renseigné pour OVER_90 : ampleur du dépassement, en jours. */
  daysOver?: number;
}

/**
 * Anomalies de saisie et infractions.
 *
 * `today` est facultatif : sans lui, la détection d'une entrée future
 * enregistrée comme historique est simplement omise (le moteur ne lit jamais
 * l'horloge de lui-même).
 */
export function validate(stays: Stay[], today?: IsoDate): Issue[] {
  const issues: Issue[] = [];

  for (const stay of stays) {
    if (!isIsoDate(stay.entry)) {
      issues.push({
        stayId: stay.id,
        code: "EXIT_BEFORE_ENTRY",
        message: "Data e hyrjes nuk është e vlefshme.",
      });
      continue;
    }
    if (stay.exit !== null && isIsoDate(stay.exit) && isBefore(stay.exit, stay.entry)) {
      issues.push({
        stayId: stay.id,
        code: "EXIT_BEFORE_ENTRY",
        message: "Data e daljes është para datës së hyrjes.",
      });
    }
    if (today && !stay.planned && isAfter(stay.entry, today)) {
      issues.push({
        stayId: stay.id,
        code: "FUTURE_ENTRY_IN_HISTORY",
        message: "Hyrje në të ardhmen e regjistruar si histori. Shënoje si udhëtim të planifikuar.",
      });
    }
  }

  // Chevauchements : on signale le séjour le plus récent de chaque paire.
  const real = stays.filter(
    (s) => !s.planned && isIsoDate(s.entry) && (s.exit === null || isIsoDate(s.exit)),
  );
  for (let i = 0; i < real.length; i++) {
    for (let j = i + 1; j < real.length; j++) {
      const a = real[i]!;
      const b = real[j]!;
      const aEnd = a.exit ?? "9999-12-31";
      const bEnd = b.exit ?? "9999-12-31";
      if (isBefore(aEnd, a.entry) || isBefore(bEnd, b.entry)) continue;
      const overlaps = isSameOrBefore(a.entry, bEnd) && isSameOrBefore(b.entry, aEnd);
      if (overlaps) {
        const later = isAfter(b.entry, a.entry) ? b : a;
        issues.push({
          stayId: later.id,
          code: "OVERLAP",
          message: "Ky qëndrim mbivendoset me një tjetër. Ditët e përbashkëta numërohen vetëm një herë.",
        });
      }
    }
  }

  // Dépassement du quota : premier jour en infraction et ampleur.
  const overflow = findFirstOverflow(stays);
  if (overflow) {
    issues.push({
      stayId: overflow.stayId,
      code: "OVER_90",
      message: `Kuota 90/180 është tejkaluar që më ${overflow.date} (${overflow.daysOver} ditë tepër).`,
      firstOverflowDate: overflow.date,
      daysOver: overflow.daysOver,
    });
  }

  return issues;
}

/**
 * Premier jour de l'historique où la fenêtre dépasse 90 jours, et ampleur
 * maximale du dépassement. Seuls les jours effectivement présents sont
 * examinés : le dépassement ne peut apparaître qu'un jour de présence.
 */
function findFirstOverflow(
  stays: Stay[],
): { date: IsoDate; daysOver: number; stayId: string } | null {
  const real = stays.filter((s) => !s.planned && !s.exempt && isIsoDate(s.entry));
  if (real.length === 0) return null;

  // Borne supérieure de l'examen : la dernière sortie connue. Un séjour
  // encore ouvert est examiné jusqu'à sa 400ᵉ journée, ce qui couvre très
  // largement le premier dépassement possible (91ᵉ jour au plus tard).
  let last: IsoDate | null = null;
  for (const s of real) {
    const end = s.exit && isIsoDate(s.exit) ? s.exit : addDays(s.entry, MAX_ITERATIONS - 1);
    last = last === null ? end : maxDate(last, end);
  }
  if (last === null) return null;

  let first: { date: IsoDate; stayId: string } | null = null;
  let daysOver = 0;

  const presence = countedDays(real, EARLIEST, last);
  for (const day of [...presence].sort()) {
    const excess = usedOn(real, day) - MAX_DAYS;
    if (excess > 0) {
      if (!first) {
        const owner = real.find(
          (s) =>
            isSameOrBefore(s.entry, day) &&
            isSameOrBefore(day, s.exit && isIsoDate(s.exit) ? s.exit : last!),
        );
        first = { date: day, stayId: owner?.id ?? real[0]!.id };
      }
      daysOver = Math.max(daysOver, excess);
    }
  }

  return first ? { ...first, daysOver } : null;
}

// ──────────────────────────────────────────────────────────────────────
// Voyages planifiés
// ──────────────────────────────────────────────────────────────────────

export interface PlannedTrip {
  stay: Stay;
  entry: IsoDate;
  exit: IsoDate;
  days: number;
  ok: boolean;
  firstOverflowDate?: IsoDate;
  daysOver?: number;
}

export interface PlannedOutlook {
  trips: PlannedTrip[];
  /** Au moins un voyage planifié dépasse le quota. */
  anyOverflow: boolean;
  /** Premier jour d'infraction, tous voyages planifiés confondus. */
  firstOverflowDate: IsoDate | null;
  daysOver: number;
  /** Dernier jour couvert par les voyages planifiés. */
  lastExit: IsoDate | null;
  /** Jours restants au dernier jour planifié, une fois tout pris en compte. */
  remainingAfter: number;
}

/**
 * Évalue les voyages planifiés EN BLOC, et non un par un.
 *
 * Chaque voyage est jugé dans le contexte de l'historique réel ET des autres
 * voyages planifiés : deux voyages qui passent isolément peuvent très bien
 * dépasser le quota une fois mis bout à bout. C'est le calcul unique qui
 * alimente le résumé de l'écran d'accueil.
 */
export function plannedOutlook(stays: Stay[], today: IsoDate): PlannedOutlook {
  const planned = stays
    .filter((s) => s.planned && isIsoDate(s.entry) && s.exit && isIsoDate(s.exit))
    .sort((a, b) => (isBefore(a.entry, b.entry) ? -1 : 1));

  const empty: PlannedOutlook = {
    trips: [],
    anyOverflow: false,
    firstOverflowDate: null,
    daysOver: 0,
    lastExit: null,
    remainingAfter: remainingOn(stays, today),
  };
  if (planned.length === 0) return empty;

  // Projection complète : réel + TOUS les voyages planifiés.
  const projection = materializePlanned(stays);

  const trips: PlannedTrip[] = [];
  let firstOverflowDate: IsoDate | null = null;
  let daysOver = 0;
  let lastExit: IsoDate | null = null;

  for (const stay of planned) {
    const exit = stay.exit as IsoDate;
    let tripFirst: IsoDate | undefined;
    let tripOver = 0;

    for (const day of eachDay(stay.entry, exit)) {
      const excess = usedOn(projection, day) - MAX_DAYS;
      if (excess > 0) {
        if (!tripFirst) tripFirst = day;
        tripOver = Math.max(tripOver, excess);
      }
    }

    const trip: PlannedTrip = {
      stay,
      entry: stay.entry,
      exit,
      days: inclusiveDays(stay.entry, exit),
      ok: tripFirst === undefined,
    };
    if (tripFirst) {
      trip.firstOverflowDate = tripFirst;
      trip.daysOver = tripOver;
      if (!firstOverflowDate) firstOverflowDate = tripFirst;
      daysOver = Math.max(daysOver, tripOver);
    }
    trips.push(trip);
    lastExit = lastExit === null ? exit : maxDate(lastExit, exit);
  }

  return {
    trips,
    anyOverflow: firstOverflowDate !== null,
    firstOverflowDate,
    daysOver,
    lastExit,
    remainingAfter: remainingOn(projection, lastExit ?? today),
  };
}

// ──────────────────────────────────────────────────────────────────────
// Vue d'ensemble (écran d'accueil)
// ──────────────────────────────────────────────────────────────────────

export interface Status {
  today: IsoDate;
  used: number;
  remaining: number;
  windowFrom: IsoDate;
  windowTo: IsoDate;
  compliant: boolean;
  /** Un séjour est-il en cours aujourd'hui ? */
  inside: boolean;
  /** Date limite de sortie si un séjour est en cours. */
  mustLeaveBy: IsoDate | null;
  /** Séjour maximal si l'on entrait aujourd'hui. */
  maxStay: MaxStay;
  /** Premier jour où au moins un jour est disponible. */
  earliestReentry: IsoDate;
  /** Premier jour où les 90 jours sont de nouveau disponibles. */
  fullReset: IsoDate;
  issues: Issue[];
  /** Résumé de l'historique réel. */
  summary: { stayCount: number; totalDays: number };
  /** Projection incluant les voyages planifiés. */
  planned: PlannedOutlook;
}

/** Tout ce dont l'écran d'accueil a besoin, en un seul passage. */
export function statusOn(stays: Stay[], today: IsoDate): Status {
  const used = usedOn(stays, today);
  const open = currentStay(stays, today);

  return {
    today,
    used,
    remaining: Math.max(0, MAX_DAYS - used),
    windowFrom: windowStart(today),
    windowTo: windowEnd(today),
    compliant: used <= MAX_DAYS,
    inside: open !== null,
    mustLeaveBy: mustLeaveBy(stays, today),
    maxStay: maxStayFrom(stays, today),
    earliestReentry: earliestReentry(stays, today),
    fullReset: fullResetDate(stays, today),
    issues: validate(stays, today),
    summary: summarize(stays, today),
    planned: plannedOutlook(stays, today),
  };
}

/** Nombre de séjours réels et total de jours saisis. */
export function summarize(
  stays: Stay[],
  today: IsoDate,
): { stayCount: number; totalDays: number } {
  const real = stays.filter((s) => !s.planned && isIsoDate(s.entry));
  return {
    stayCount: real.length,
    totalDays: real.reduce((n, s) => n + stayDays(s, today), 0),
  };
}
