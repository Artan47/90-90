/**
 * Pure calendar-date helpers.
 *
 * RÈGLE D'OR : une date est une date calendaire, sans heure ni fuseau.
 * Elle est toujours transportée sous la forme d'une chaîne "YYYY-MM-DD".
 *
 * Interdit dans tout le projet :
 *   new Date("2026-01-05").getDate()   // → 4 janvier à l'ouest de Greenwich
 *   new Date(2026, 0, 5).toISOString() // → décalage à l'est de Greenwich
 *
 * Toute l'arithmétique ci-dessous passe par Date.UTC / getUTC*, donc le
 * résultat est identique quel que soit le fuseau de l'appareil.
 */

/** Une date calendaire au format "YYYY-MM-DD". */
export type IsoDate = string;

const MS_PER_DAY = 86_400_000;

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Vrai si la chaîne est une date calendaire réellement existante. */
export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string") return false;
  const m = ISO_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  // Rejette le 31 février : Date.UTC normalise, on compare donc au retour.
  const back = new Date(utc(y, mo, d));
  return (
    back.getUTCFullYear() === y &&
    back.getUTCMonth() === mo - 1 &&
    back.getUTCDate() === d
  );
}

/**
 * Date.UTC(y, …) mappe les années 0–99 sur 1900–1999 : on repasse donc
 * explicitement l'année pour que « 0007-01-01 » reste l'an 7.
 */
function utc(y: number, mo: number, d: number): number {
  const t = Date.UTC(y, mo - 1, d);
  if (y >= 0 && y <= 99) {
    const fixed = new Date(t);
    fixed.setUTCFullYear(y);
    return fixed.getTime();
  }
  return t;
}

function assertIso(value: IsoDate): void {
  if (!isIsoDate(value)) {
    throw new RangeError(`Datë e pavlefshme (format i pritur YYYY-MM-DD): ${String(value)}`);
  }
}

/** "YYYY-MM-DD" → timestamp UTC de minuit. */
export function fromIso(date: IsoDate): number {
  assertIso(date);
  const m = ISO_RE.exec(date) as RegExpExecArray;
  return utc(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** Timestamp UTC → "YYYY-MM-DD". */
export function toIso(timestamp: number): IsoDate {
  const d = new Date(timestamp);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** Décale une date d'un nombre entier de jours (négatif accepté). */
export function addDays(date: IsoDate, days: number): IsoDate {
  return toIso(fromIso(date) + days * MS_PER_DAY);
}

/**
 * Nombre de jours de `from` à `to` (to − from).
 * diffDays("2026-03-10", "2026-03-11") === 1
 */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((fromIso(to) - fromIso(from)) / MS_PER_DAY);
}

/**
 * Nombre de jours calendaires d'un intervalle bornes incluses.
 * Le jour d'entrée et le jour de sortie comptent tous deux (règle 2.2 §2).
 */
export function inclusiveDays(from: IsoDate, to: IsoDate): number {
  return diffDays(from, to) + 1;
}

export function compareDates(a: IsoDate, b: IsoDate): number {
  const ta = fromIso(a);
  const tb = fromIso(b);
  return ta < tb ? -1 : ta > tb ? 1 : 0;
}

export const isBefore = (a: IsoDate, b: IsoDate): boolean => compareDates(a, b) < 0;
export const isAfter = (a: IsoDate, b: IsoDate): boolean => compareDates(a, b) > 0;
export const isSameOrBefore = (a: IsoDate, b: IsoDate): boolean => compareDates(a, b) <= 0;
export const isSameOrAfter = (a: IsoDate, b: IsoDate): boolean => compareDates(a, b) >= 0;

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return isBefore(a, b) ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return isAfter(a, b) ? a : b;
}

export function clampDate(date: IsoDate, lo: IsoDate, hi: IsoDate): IsoDate {
  return minDate(maxDate(date, lo), hi);
}

/** Toutes les dates de `from` à `to`, bornes incluses. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  if (isAfter(from, to)) return out;
  const end = fromIso(to);
  for (let t = fromIso(from); t <= end; t += MS_PER_DAY) out.push(toIso(t));
  return out;
}

/**
 * La date du jour dans le fuseau de l'appareil, exprimée en date calendaire.
 * Seul endroit du projet qui lit l'horloge : le moteur de calcul reçoit
 * toujours le jour en paramètre.
 */
export function todayIso(now: Date = new Date()): IsoDate {
  const y = String(now.getFullYear()).padStart(4, "0");
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

/** "2026-08-27" → "27.08.2026" (format d'affichage albanais). */
export function formatDate(date: IsoDate): string {
  if (!isIsoDate(date)) return "—";
  const m = ISO_RE.exec(date) as RegExpExecArray;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

const SQ_MONTHS = [
  "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor",
  "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor",
] as const;

/** "2026-08-27" → "Gusht 2026". */
export function formatMonthYear(date: IsoDate): string {
  const m = ISO_RE.exec(date) as RegExpExecArray | null;
  if (!m) return "—";
  return `${SQ_MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** Premier jour du mois d'une date. */
export function startOfMonth(date: IsoDate): IsoDate {
  const m = ISO_RE.exec(date) as RegExpExecArray;
  return `${m[1]}-${m[2]}-01`;
}
