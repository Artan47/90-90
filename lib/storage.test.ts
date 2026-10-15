import { describe, it, expect } from "vitest";
import { parseData, fromImportString, toExportString, newId } from "./storage";
import { emptyData, activePerson } from "./types";

describe("persistance — lecture d'une sauvegarde v2", () => {
  it("accepte plusieurs personnes", () => {
    const data = parseData({
      version: 2,
      locale: "fr",
      activeId: "b",
      people: [
        { id: "a", name: "Leugzim", stays: [{ id: "s1", entry: "2026-01-05", exit: "2026-01-19", country: "CH" }], profile: {} },
        { id: "b", name: "Arta", stays: [], profile: { passportExpiry: "2030-01-01" } },
      ],
    });
    expect(data.people).toHaveLength(2);
    expect(data.activeId).toBe("b");
    expect(data.locale).toBe("fr");
    expect(activePerson(data)!.name).toBe("Arta");
    expect(data.people[0]!.stays).toHaveLength(1);
    expect(data.people[1]!.profile.passportExpiry).toBe("2030-01-01");
  });

  it("retombe sur la première personne si l'active est inconnue", () => {
    const data = parseData({
      version: 2,
      activeId: "fantôme",
      people: [{ id: "a", name: "Leugzim", stays: [], profile: {} }],
    });
    expect(data.activeId).toBe("a");
  });

  it("donne un nom par défaut à une personne anonyme", () => {
    const data = parseData({ version: 2, people: [{ id: "a", stays: [], profile: {} }] }, "Moi");
    expect(data.people[0]!.name).toBe("Moi");
  });

  it("écarte les personnes illisibles", () => {
    const data = parseData({ version: 2, people: [null, 42, { id: "a", name: "A", stays: [], profile: {} }] });
    expect(data.people).toHaveLength(1);
  });

  it("tronque un nom trop long", () => {
    const data = parseData({ version: 2, people: [{ id: "a", name: "x".repeat(200), stays: [], profile: {} }] });
    expect(data.people[0]!.name.length).toBe(40);
  });
});

describe("persistance — MIGRATION depuis la version 1", () => {
  // Sauvegarde telle qu'elle existait avant le multi-personnes.
  const v1 = {
    version: 1,
    stays: [
      { id: "1", entry: "2026-02-01", exit: "2026-02-08", country: "CH" },
      { id: "2", entry: "2026-05-13", exit: "2026-06-06", country: "CH" },
      { id: "3", entry: "2026-07-01", exit: "2026-07-08", country: "CH" },
      { id: "4", entry: "2026-07-16", exit: "2026-08-28", country: "CH" },
    ],
    profile: { passportExpiry: "2028-03-10", passportIssued: "2023-04-04", locale: "fr" },
  };

  it("ne perd AUCUN séjour", () => {
    const data = parseData(v1);
    expect(data.people).toHaveLength(1);
    expect(data.people[0]!.stays).toHaveLength(4);
    expect(data.people[0]!.stays.map((s) => s.entry)).toEqual([
      "2026-02-01", "2026-05-13", "2026-07-01", "2026-07-16",
    ]);
  });

  it("conserve le passeport", () => {
    const p = parseData(v1).people[0]!;
    expect(p.profile.passportExpiry).toBe("2028-03-10");
    expect(p.profile.passportIssued).toBe("2023-04-04");
  });

  it("remonte la langue du profil vers l'application", () => {
    const data = parseData(v1);
    expect(data.locale).toBe("fr");
    expect(data.people[0]!.profile.locale).toBeUndefined();
  });

  it("rend la personne migrée active", () => {
    const data = parseData(v1);
    expect(data.activeId).toBe(data.people[0]!.id);
    expect(activePerson(data)).toBe(data.people[0]);
  });

  it("utilise le nom par défaut fourni", () => {
    expect(parseData(v1, "Moi").people[0]!.name).toBe("Moi");
    expect(parseData(v1).people[0]!.name).toBe("Unë");
  });

  it("migre aussi une v1 sans profil", () => {
    const data = parseData({ stays: [{ id: "1", entry: "2026-01-01", exit: null, country: "DE" }] });
    expect(data.people).toHaveLength(1);
    expect(data.people[0]!.stays).toHaveLength(1);
    expect(data.locale).toBeNull();
  });

  it("migre une v1 vide sans créer de personne fantôme", () => {
    const data = parseData({ version: 1, stays: [], profile: { locale: "sq" } });
    expect(data.people).toHaveLength(1);
    expect(data.people[0]!.stays).toEqual([]);
    expect(data.locale).toBe("sq");
  });

  it("une migration est idempotente : relire le résultat ne change rien", () => {
    const once = parseData(v1);
    const twice = parseData(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

describe("persistance — séjours", () => {
  const wrap = (stays: unknown[]) => parseData({ version: 2, people: [{ id: "a", name: "A", stays, profile: {} }] });

  it("accepte un séjour sain et normalise le pays", () => {
    const s = wrap([{ id: "a", entry: "2026-01-05", exit: "2026-01-19", country: "de", exempt: true }]).people[0]!.stays;
    expect(s[0]!.country).toBe("DE");
    expect(s[0]!.exempt).toBe(true);
  });

  it("écarte les séjours illisibles sans planter", () => {
    const s = wrap([
      { id: "ok", entry: "2026-01-05", exit: null, country: "FR" },
      { id: "ko", entry: "pas-une-date", exit: "2026-01-19", country: "FR" },
      null, 42,
      { id: "exit-bruit", entry: "2026-02-01", exit: "bruit", country: "FR" },
    ]).people[0]!.stays;
    expect(s.map((x) => x.id)).toEqual(["ok", "exit-bruit"]);
    expect(s[1]!.exit).toBeNull();
  });

  it("attribue un identifiant aux séjours qui n'en ont pas", () => {
    const s = wrap([{ entry: "2026-01-05", exit: null, country: "FR" }]).people[0]!.stays;
    expect(s[0]!.id.length).toBeGreaterThan(0);
  });
});

describe("persistance — robustesse et export", () => {
  it("renvoie une base vide sur une entrée absurde", () => {
    expect(parseData(null)).toEqual(emptyData());
    expect(parseData("bruit")).toEqual(emptyData());
    expect(parseData(42)).toEqual(emptyData());
    expect(parseData({})).toEqual(emptyData());
  });

  it("ignore une date de passeport invalide", () => {
    const data = parseData({ version: 2, people: [{ id: "a", name: "A", stays: [], profile: { passportExpiry: "31-12-2030" } }] });
    expect(data.people[0]!.profile.passportExpiry).toBeUndefined();
  });

  it("ignore une langue invalide", () => {
    expect(parseData({ version: 2, people: [], locale: "de" }).locale).toBeNull();
  });

  it("l'export se relit à l'identique, toutes personnes comprises", () => {
    const original = parseData({
      version: 2,
      locale: "sq",
      activeId: "b",
      people: [
        { id: "a", name: "Leugzim", stays: [{ id: "s", entry: "2026-01-05", exit: "2026-01-19", country: "CH" }], profile: { passportExpiry: "2030-01-01" } },
        { id: "b", name: "Arta", stays: [], profile: {} },
      ],
    });
    expect(fromImportString(toExportString(original))).toEqual(original);
  });

  it("un export v1 reste importable", () => {
    const v1Export = JSON.stringify({ app: "sa-dite", version: 1, stays: [{ id: "1", entry: "2026-01-05", exit: "2026-01-19", country: "CH" }], profile: {} });
    const data = fromImportString(v1Export);
    expect(data.people[0]!.stays).toHaveLength(1);
  });

  it("newId produit des identifiants distincts", () => {
    expect(newId()).not.toBe(newId());
  });
});
