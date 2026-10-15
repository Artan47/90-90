import { describe, it, expect } from "vitest";
import {
  addDays, addMonths, addYears, diffDays, inclusiveDays, toIso, fromIso, isIsoDate, eachDay,
  formatDate, formatMonthYear, minDate, maxDate, clampDate, startOfMonth,
  todayIso, compareDates, isBefore, isAfter, isSameOrBefore, isSameOrAfter,
} from "./date";

describe("lib/date — arithmétique calendaire", () => {
  it("aller-retour ISO ↔ timestamp", () => {
    expect(toIso(fromIso("2026-01-05"))).toBe("2026-01-05");
    expect(toIso(fromIso("1999-12-31"))).toBe("1999-12-31");
  });

  it("addDays traverse les mois, les années et le 29 février", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29"); // bissextile
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // non bissextile
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-04-09", -179)).toBe("2025-10-12");
    expect(addDays("2026-08-27", 0)).toBe("2026-08-27");
  });

  it("addMonths borne au dernier jour du mois d'arrivée", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29"); // bissextile
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
    expect(addMonths("2026-06-15", 0)).toBe("2026-06-15");
    expect(addMonths("2026-06-15", 12)).toBe("2027-06-15");
    expect(addMonths("2026-06-15", -18)).toBe("2024-12-15");
  });

  it("addYears gère le 29 février", () => {
    expect(addYears("2024-02-29", 1)).toBe("2025-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
    expect(addYears("2026-05-05", 10)).toBe("2036-05-05");
    expect(addYears("2026-05-05", -10)).toBe("2016-05-05");
  });

  it("diffDays et inclusiveDays", () => {
    expect(diffDays("2026-03-10", "2026-03-11")).toBe(1);
    expect(diffDays("2026-03-11", "2026-03-10")).toBe(-1);
    expect(inclusiveDays("2026-03-10", "2026-03-10")).toBe(1);
    expect(inclusiveDays("2025-10-12", "2026-04-09")).toBe(180);
  });

  it("valide et rejette les dates impossibles", () => {
    expect(isIsoDate("2026-02-29")).toBe(false); // 2026 n'est pas bissextile
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("2026-00-10")).toBe(false);
    expect(isIsoDate("2026-04-31")).toBe(false);
    expect(isIsoDate("26-04-01")).toBe(false);
    expect(isIsoDate("2026-4-1")).toBe(false);
    expect(isIsoDate(20260401)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(() => fromIso("pas-une-date")).toThrow();
  });

  it("comparaisons et bornes", () => {
    expect(compareDates("2026-01-01", "2026-01-02")).toBe(-1);
    expect(compareDates("2026-01-02", "2026-01-01")).toBe(1);
    expect(compareDates("2026-01-01", "2026-01-01")).toBe(0);
    expect(isBefore("2026-01-01", "2026-01-02")).toBe(true);
    expect(isAfter("2026-01-02", "2026-01-01")).toBe(true);
    expect(isSameOrBefore("2026-01-01", "2026-01-01")).toBe(true);
    expect(isSameOrAfter("2026-01-01", "2026-01-01")).toBe(true);
    expect(minDate("2026-05-01", "2026-01-01")).toBe("2026-01-01");
    expect(maxDate("2026-05-01", "2026-01-01")).toBe("2026-05-01");
    expect(clampDate("2025-01-01", "2026-01-01", "2026-12-31")).toBe("2026-01-01");
    expect(clampDate("2027-01-01", "2026-01-01", "2026-12-31")).toBe("2026-12-31");
    expect(clampDate("2026-06-01", "2026-01-01", "2026-12-31")).toBe("2026-06-01");
  });

  it("eachDay est inclusif et vide si l'intervalle est inversé", () => {
    expect(eachDay("2026-03-10", "2026-03-12")).toEqual([
      "2026-03-10", "2026-03-11", "2026-03-12",
    ]);
    expect(eachDay("2026-03-12", "2026-03-10")).toEqual([]);
    expect(eachDay("2026-03-10", "2026-03-10")).toEqual(["2026-03-10"]);
  });

  it("formatage d'affichage", () => {
    expect(formatDate("2026-08-27")).toBe("27.08.2026");
    expect(formatDate("bruit")).toBe("—");
    expect(formatMonthYear("2026-08-27")).toBe("Gusht 2026");
    expect(formatMonthYear("bruit")).toBe("—");
    expect(startOfMonth("2026-08-27")).toBe("2026-08-01");
  });

  it("todayIso lit le calendrier local, pas UTC", () => {
    // 5 janvier 2026 à 23h30 heure locale : la date locale est bien le 5,
    // même si en UTC on est déjà le 6 (ou encore le 5 au matin).
    const local = new Date(2026, 0, 5, 23, 30, 0);
    expect(todayIso(local)).toBe("2026-01-05");
    expect(todayIso(new Date(2026, 0, 5, 0, 30, 0))).toBe("2026-01-05");
  });
});

describe("TEST E — indépendance au fuseau horaire", () => {
  it("le fuseau du processus ne change aucun résultat", () => {
    // Les valeurs ci-dessous sont vérifiées à l'identique sous TZ=UTC,
    // TZ=Pacific/Kiritimati (UTC+14) et TZ=Pacific/Niue (UTC−11) : c'est le
    // script npm run test:tz qui rejoue toute la suite dans ces trois fuseaux.
    expect(toIso(fromIso("2026-01-05"))).toBe("2026-01-05");
    expect(addDays("2026-01-05", 1)).toBe("2026-01-06");
    expect(addDays("2026-04-09", -179)).toBe("2025-10-12");
    expect(inclusiveDays("2026-01-10", "2026-04-09")).toBe(90);
    expect(formatDate("2026-01-05")).toBe("05.01.2026");
    // Le piège classique : le constructeur local décale d'un jour.
    expect(new Date("2026-01-05T00:00:00Z").getUTCDate()).toBe(5);
  });

  it("le décalage local est bien réel dans les fuseaux extrêmes", () => {
    // Ce test documente POURQUOI les helpers existent : hors UTC, lire une
    // date ISO avec les accesseurs locaux donne un autre jour.
    const offset = new Date("2026-01-05T00:00:00Z").getTimezoneOffset();
    const localDay = new Date("2026-01-05T00:00:00Z").getDate();
    if (offset > 0) expect(localDay).toBe(4);       // à l'ouest de Greenwich
    else if (offset < 0) expect(localDay).toBe(5);  // à l'est
    else expect(localDay).toBe(5);
  });
});
