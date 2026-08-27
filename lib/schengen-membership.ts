/**
 * TABLE DATÉE D'APPARTENANCE À L'ESPACE SCHENGEN — SOURCE UNIQUE DE VÉRITÉ.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ DERNIÈRE VÉRIFICATION : 2026-08-27                                   │
 * │ PROCHAINE ÉCHÉANCE ATTENDUE : Chypre. Son adhésion pleine est        │
 * │ discutée pour 2026-2027 ; tant qu'elle n'est pas effective, Chypre    │
 * │ garde son propre quota 90/180 et NE COMPTE PAS ici.                  │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Pourquoi une table DATÉE et non une simple liste : l'appartenance change.
 * Un séjour de 20 jours en Roumanie en mai 2023 ne consommait aucun jour du
 * quota Schengen ; le même séjour en mai 2026 en consomme 20. Le moteur doit
 * donc trancher pays PAR JOUR, pas pays par pays.
 *
 * POUR METTRE À JOUR (voir aussi README.md § « Mettre à jour la table ») :
 *   1. Vérifier la date d'effet sur le site du Conseil de l'UE ou au Journal
 *      officiel de l'Union européenne (décision d'application de l'acquis).
 *   2. Modifier UNIQUEMENT ce fichier : y ajouter/déplacer le code pays et
 *      sa date d'effet (`since`), ou retirer le pays de NON_SCHENGEN.
 *   3. Mettre à jour LAST_VERIFIED ci-dessous.
 *   4. Ajouter un cas dans lib/schengen.test.ts (« avant / après » la date).
 *   5. `npm test`.
 * Aucun autre fichier ne doit contenir de liste de pays.
 */

import type { IsoDate } from "./date";
import { isSameOrAfter } from "./date";

/** Date à laquelle cette table a été confrontée aux sources officielles. */
export const LAST_VERIFIED: IsoDate = "2026-08-27";

/** Nombre d'États de l'espace Schengen à la date de vérification. */
export const SCHENGEN_STATE_COUNT = 29;

export interface CountryInfo {
  /** ISO-3166-1 alpha-2. */
  code: string;
  /** Nom en albanais. */
  name: string;
  /** Drapeau emoji, pour l'affichage. */
  flag: string;
  /**
   * Premier jour où un séjour dans ce pays consomme le quota Schengen.
   * `null` = ne compte à aucune date (pays tiers, opt-out, ou Schengen partiel).
   */
  since: IsoDate | null;
  /** Explication affichée dans l'interface quand le pays ne compte pas. */
  note?: string;
}

/**
 * Les 29 États de l'espace Schengen, plus les pays voisins qui NE comptent
 * PAS mais que l'on veut pouvoir enregistrer (ils sont fréquemment visités et
 * l'utilisateur doit voir explicitement qu'ils ne consomment rien).
 *
 * `ALWAYS` = membre de longue date. On date cette valeur au 26 mars 1995,
 * entrée en vigueur de la convention d'application de Schengen : aucun
 * séjour antérieur ne relève du quota de toute façon.
 */
const ALWAYS = "1995-03-26";

export const COUNTRIES: readonly CountryInfo[] = [
  // ── Membres de longue date ────────────────────────────────────────────
  { code: "AT", name: "Austri", flag: "🇦🇹", since: ALWAYS },
  { code: "BE", name: "Belgjikë", flag: "🇧🇪", since: ALWAYS },
  { code: "CZ", name: "Çeki", flag: "🇨🇿", since: ALWAYS },
  { code: "DE", name: "Gjermani", flag: "🇩🇪", since: ALWAYS },
  { code: "DK", name: "Danimarkë", flag: "🇩🇰", since: ALWAYS },
  { code: "EE", name: "Estoni", flag: "🇪🇪", since: ALWAYS },
  { code: "ES", name: "Spanjë", flag: "🇪🇸", since: ALWAYS },
  { code: "FI", name: "Finlandë", flag: "🇫🇮", since: ALWAYS },
  { code: "FR", name: "Francë", flag: "🇫🇷", since: ALWAYS },
  { code: "GR", name: "Greqi", flag: "🇬🇷", since: ALWAYS },
  { code: "HU", name: "Hungari", flag: "🇭🇺", since: ALWAYS },
  { code: "IT", name: "Itali", flag: "🇮🇹", since: ALWAYS },
  { code: "LT", name: "Lituani", flag: "🇱🇹", since: ALWAYS },
  { code: "LU", name: "Luksemburg", flag: "🇱🇺", since: ALWAYS },
  { code: "LV", name: "Letoni", flag: "🇱🇻", since: ALWAYS },
  { code: "MT", name: "Maltë", flag: "🇲🇹", since: ALWAYS },
  { code: "NL", name: "Holandë", flag: "🇳🇱", since: ALWAYS },
  { code: "PL", name: "Poloni", flag: "🇵🇱", since: ALWAYS },
  { code: "PT", name: "Portugali", flag: "🇵🇹", since: ALWAYS },
  { code: "SE", name: "Suedi", flag: "🇸🇪", since: ALWAYS },
  { code: "SI", name: "Slloveni", flag: "🇸🇮", since: ALWAYS },
  { code: "SK", name: "Sllovaki", flag: "🇸🇰", since: ALWAYS },
  // États associés (non-UE), membres de longue date
  { code: "CH", name: "Zvicër", flag: "🇨🇭", since: ALWAYS },
  { code: "IS", name: "Islandë", flag: "🇮🇸", since: ALWAYS },
  { code: "LI", name: "Lihtenshtajn", flag: "🇱🇮", since: ALWAYS },
  { code: "NO", name: "Norvegji", flag: "🇳🇴", since: ALWAYS },

  // ── Adhésions récentes : la date d'effet est déterminante ─────────────
  {
    code: "HR",
    name: "Kroaci",
    flag: "🇭🇷",
    since: "2023-01-01",
    note: "Pjesë e Schengenit që nga 01.01.2023.",
  },
  {
    code: "BG",
    name: "Bullgari",
    flag: "🇧🇬",
    since: "2024-03-31",
    note: "Kufijtë ajrorë dhe detarë nga 31.03.2024; anëtarësim i plotë nga 01.01.2025.",
  },
  {
    code: "RO",
    name: "Rumani",
    flag: "🇷🇴",
    since: "2024-03-31",
    note: "Kufijtë ajrorë dhe detarë nga 31.03.2024; anëtarësim i plotë nga 01.01.2025.",
  },

  // ── Ne comptent pas ───────────────────────────────────────────────────
  {
    code: "CY",
    name: "Qipro",
    flag: "🇨🇾",
    since: null,
    note: "Nuk i ka hequr kontrollet e brendshme: ka kuotën e vet 90/180, të ndarë nga Schengeni.",
  },
  {
    code: "IE",
    name: "Irlandë",
    flag: "🇮🇪",
    since: null,
    note: "Opt-out nga Schengeni: regjim kombëtar, nuk prek kuotën.",
  },
  {
    code: "GB",
    name: "Mbretëria e Bashkuar",
    flag: "🇬🇧",
    since: null,
    note: "Vend i tretë: nuk prek kuotën Schengen.",
  },
  {
    code: "XK",
    name: "Kosovë",
    flag: "🇽🇰",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "AL",
    name: "Shqipëri",
    flag: "🇦🇱",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "MK",
    name: "Maqedoni e Veriut",
    flag: "🇲🇰",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "ME",
    name: "Mal i Zi",
    flag: "🇲🇪",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "RS",
    name: "Serbi",
    flag: "🇷🇸",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "BA",
    name: "Bosnjë dhe Hercegovinë",
    flag: "🇧🇦",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "TR",
    name: "Turqi",
    flag: "🇹🇷",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "US",
    name: "SHBA",
    flag: "🇺🇸",
    since: null,
    note: "Jashtë Schengenit.",
  },
  {
    code: "OTHER",
    name: "Vend tjetër (jo-Schengen)",
    flag: "🌍",
    since: null,
    note: "Jashtë Schengenit.",
  },
];

const BY_CODE: ReadonlyMap<string, CountryInfo> = new Map(
  COUNTRIES.map((c) => [c.code, c]),
);

export function getCountry(code: string): CountryInfo | undefined {
  return BY_CODE.get(code.toUpperCase());
}

/**
 * Le pays `code` fait-il partie de l'espace Schengen le jour `day` ?
 *
 * Un code inconnu est traité comme un pays tiers : on ne consomme jamais de
 * quota sur une donnée qu'on ne sait pas interpréter, mais l'interface
 * signale le pays comme non reconnu.
 */
export function isSchengenOn(code: string, day: IsoDate): boolean {
  const country = getCountry(code);
  if (!country || country.since === null) return false;
  return isSameOrAfter(day, country.since);
}

/** Vrai si le pays compte au moins à une date (utile pour les badges UI). */
export function countsEver(code: string): boolean {
  const country = getCountry(code);
  return Boolean(country && country.since !== null);
}

/** Liste triée par nom albanais, pour les sélecteurs. */
export function countriesForPicker(): CountryInfo[] {
  return [...COUNTRIES].sort((a, b) => {
    const aCounts = a.since !== null;
    const bCounts = b.since !== null;
    if (aCounts !== bCounts) return aCounts ? -1 : 1;
    return a.name.localeCompare(b.name, "sq");
  });
}
