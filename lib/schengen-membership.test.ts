import { describe, it, expect } from "vitest";
import {
  COUNTRIES, LAST_VERIFIED, SCHENGEN_STATE_COUNT,
  getCountry, isSchengenOn, countsEver, countriesForPicker,
} from "./schengen-membership";
import { isIsoDate } from "./date";

describe("table datée d'appartenance à Schengen", () => {
  it("porte une date de dernière vérification valide", () => {
    expect(isIsoDate(LAST_VERIFIED)).toBe(true);
  });

  it("contient exactement les 29 États de l'espace Schengen", () => {
    const members = COUNTRIES.filter((c) => c.since !== null);
    expect(members).toHaveLength(SCHENGEN_STATE_COUNT);
    expect(SCHENGEN_STATE_COUNT).toBe(29);
  });

  it("chaque entrée a un code alpha-2 unique et une date d'effet valide", () => {
    const codes = new Set<string>();
    for (const c of COUNTRIES) {
      expect(codes.has(c.code)).toBe(false);
      codes.add(c.code);
      if (c.since !== null) expect(isIsoDate(c.since)).toBe(true);
    }
  });

  it("les quatre États associés non-UE sont présents", () => {
    for (const code of ["IS", "LI", "NO", "CH"]) {
      expect(countsEver(code)).toBe(true);
    }
  });

  it("Chypre et l'Irlande ne comptent jamais", () => {
    expect(countsEver("CY")).toBe(false);
    expect(countsEver("IE")).toBe(false);
    expect(isSchengenOn("CY", "2030-01-01")).toBe(false);
    expect(isSchengenOn("IE", "2030-01-01")).toBe(false);
  });

  it("les bascules datées sont exactes", () => {
    expect(isSchengenOn("HR", "2022-12-31")).toBe(false);
    expect(isSchengenOn("HR", "2023-01-01")).toBe(true);
    expect(isSchengenOn("RO", "2024-03-30")).toBe(false);
    expect(isSchengenOn("RO", "2024-03-31")).toBe(true);
    expect(isSchengenOn("BG", "2024-03-30")).toBe(false);
    expect(isSchengenOn("BG", "2024-03-31")).toBe(true);
    expect(isSchengenOn("DE", "2005-06-01")).toBe(true);
  });

  it("un code inconnu ne compte pas et n'est pas trouvé", () => {
    expect(getCountry("ZZ")).toBeUndefined();
    expect(isSchengenOn("ZZ", "2026-01-01")).toBe(false);
    expect(countsEver("ZZ")).toBe(false);
  });

  it("getCountry est insensible à la casse", () => {
    expect(getCountry("de")?.code).toBe("DE");
  });

  it("le sélecteur place les pays qui comptent en tête", () => {
    const list = countriesForPicker();
    expect(list).toHaveLength(COUNTRIES.length);
    const firstNonMember = list.findIndex((c) => c.since === null);
    expect(firstNonMember).toBe(SCHENGEN_STATE_COUNT);
    expect(list.slice(0, SCHENGEN_STATE_COUNT).every((c) => c.since !== null)).toBe(true);
  });
});
