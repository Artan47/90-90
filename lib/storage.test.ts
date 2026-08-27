import { describe, it, expect } from "vitest";
import { parseData, fromImportString, toExportString, newId } from "./storage";
import { emptyData } from "./types";

describe("persistance — validation des données lues", () => {
  it("accepte une structure saine", () => {
    const data = parseData({
      version: 1,
      stays: [{ id: "a", entry: "2026-01-05", exit: "2026-01-19", country: "de", exempt: true }],
      profile: { passportExpiry: "2030-01-01", locale: "sq" },
    });
    expect(data.stays).toHaveLength(1);
    expect(data.stays[0]!.country).toBe("DE");
    expect(data.stays[0]!.exempt).toBe(true);
    expect(data.profile.passportExpiry).toBe("2030-01-01");
  });

  it("écarte les séjours illisibles sans planter", () => {
    const data = parseData({
      stays: [
        { id: "ok", entry: "2026-01-05", exit: null, country: "FR" },
        { id: "ko", entry: "pas-une-date", exit: "2026-01-19", country: "FR" },
        null,
        42,
        { id: "exit-bruit", entry: "2026-02-01", exit: "bruit", country: "FR" },
      ],
    });
    expect(data.stays.map((s) => s.id)).toEqual(["ok", "exit-bruit"]);
    expect(data.stays[1]!.exit).toBeNull();
  });

  it("renvoie une base vide sur une entrée absurde", () => {
    expect(parseData(null)).toEqual(emptyData());
    expect(parseData("bruit")).toEqual(emptyData());
    expect(parseData({ stays: "pas-un-tableau" }).stays).toEqual([]);
  });

  it("ignore une date de passeport invalide", () => {
    expect(parseData({ profile: { passportExpiry: "31-12-2030" } }).profile.passportExpiry)
      .toBeUndefined();
  });

  it("attribue un identifiant aux séjours qui n'en ont pas", () => {
    const data = parseData({ stays: [{ entry: "2026-01-05", exit: null, country: "FR" }] });
    expect(data.stays[0]!.id.length).toBeGreaterThan(0);
  });

  it("l'export se relit à l'identique", () => {
    const original = parseData({
      stays: [{ id: "a", entry: "2026-01-05", exit: "2026-01-19", country: "DE", note: "punë" }],
      profile: { passportIssued: "2020-05-05" },
    });
    const round = fromImportString(toExportString(original));
    expect(round.stays).toEqual(original.stays);
    expect(round.profile).toEqual(original.profile);
  });

  it("newId produit des identifiants distincts", () => {
    expect(newId()).not.toBe(newId());
  });
});
