import { describe, it, expect } from "vitest";
import { parseData, fromImportString, toExportString, newId } from "./storage";
import { emptyData } from "./types";
import { isProtected, openContent, findByEmail, emailTaken } from "./accounts";
import { sealWithPassword, unsealWithPassword } from "./crypto";

/** Les 4 séjours réels, pour vérifier qu'aucun ne se perd en route. */
const REAL_STAYS = [
  { id: "1", entry: "2026-02-01", exit: "2026-02-08", country: "CH" },
  { id: "2", entry: "2026-05-13", exit: "2026-06-06", country: "CH" },
  { id: "3", entry: "2026-07-01", exit: "2026-07-08", country: "CH" },
  { id: "4", entry: "2026-07-16", exit: "2026-08-28", country: "CH" },
];

describe("MIGRATION v1 (une personne implicite) → comptes", () => {
  const v1 = {
    version: 1,
    stays: REAL_STAYS,
    profile: { passportExpiry: "2028-03-10", passportIssued: "2023-04-04", locale: "fr" },
  };

  it("ne perd AUCUN séjour", () => {
    const data = parseData(v1);
    expect(data.accounts).toHaveLength(1);
    expect(openContent(data.accounts[0]!)!.stays).toHaveLength(4);
    expect(openContent(data.accounts[0]!)!.stays.map((s) => s.entry)).toEqual([
      "2026-02-01", "2026-05-13", "2026-07-01", "2026-07-16",
    ]);
  });

  it("conserve le passeport", () => {
    const c = openContent(parseData(v1).accounts[0]!)!;
    expect(c.profile.passportExpiry).toBe("2028-03-10");
    expect(c.profile.passportIssued).toBe("2023-04-04");
  });

  it("remonte la langue au niveau de l'application", () => {
    expect(parseData(v1).locale).toBe("fr");
  });

  it("crée un compte OUVERT, pas un compte verrouillé inaccessible", () => {
    const account = parseData(v1).accounts[0]!;
    expect(isProtected(account)).toBe(false);
    expect(account.email).toBeNull();
    expect(openContent(account)).not.toBeNull();
  });

  it("ne connecte personne d'office", () => {
    expect(parseData(v1).activeId).toBeNull();
  });
});

describe("MIGRATION v2 (plusieurs personnes) → comptes", () => {
  const v2 = {
    version: 2,
    locale: "sq",
    activeId: "a",
    people: [
      { id: "a", name: "Leugzim", stays: REAL_STAYS, profile: { passportExpiry: "2028-03-10" } },
      { id: "b", name: "Arta", stays: [{ id: "s", entry: "2026-09-01", exit: "2026-09-20", country: "CH" }], profile: {} },
      { id: "c", name: "Besnik", stays: [], profile: {} },
    ],
  };

  it("fait un compte par personne, sans rien perdre", () => {
    const data = parseData(v2);
    expect(data.accounts.map((a) => a.name)).toEqual(["Leugzim", "Arta", "Besnik"]);
    expect(openContent(data.accounts[0]!)!.stays).toHaveLength(4);
    expect(openContent(data.accounts[1]!)!.stays).toHaveLength(1);
    expect(openContent(data.accounts[2]!)!.stays).toHaveLength(0);
    expect(openContent(data.accounts[0]!)!.profile.passportExpiry).toBe("2028-03-10");
  });

  it("tous les comptes migrés sont ouverts", () => {
    for (const a of parseData(v2).accounts) expect(isProtected(a)).toBe(false);
  });

  it("conserve la langue et n'ouvre aucune session", () => {
    const data = parseData(v2);
    expect(data.locale).toBe("sq");
    expect(data.activeId).toBeNull();
  });
});

describe("comptes v3", () => {
  it("relit un compte protégé sans toucher au chiffré", async () => {
    const sealed = await sealWithPassword("fjalëkalimi", { stays: REAL_STAYS, profile: {} });
    const data = parseData({
      version: 3,
      accounts: [{ id: "a", name: "Leugzim", email: "Leugzim@Example.CH", sealed }],
      activeId: "a",
    });
    const account = data.accounts[0]!;
    expect(isProtected(account)).toBe(true);
    expect(account.email).toBe("leugzim@example.ch"); // normalisé
    expect(openContent(account)).toBeNull();          // rien en clair
    expect(await unsealWithPassword("fjalëkalimi", account.sealed!)).toEqual({
      stays: REAL_STAYS, profile: {},
    });
  });

  it("un compte protégé ne garde aucune donnée en clair", async () => {
    const sealed = await sealWithPassword("secret", { stays: REAL_STAYS, profile: {} });
    const data = parseData({
      version: 3,
      accounts: [{ id: "a", name: "L", email: "a@b.ch", sealed, content: { stays: REAL_STAYS, profile: {} } }],
    });
    // Même si une sauvegarde bricolée contenait les deux, on ignore le clair.
    expect(data.accounts[0]!.content).toBeUndefined();
    expect(JSON.stringify(data.accounts[0]!)).not.toContain("2026-05-13");
  });

  it("un compte sans chiffré valide retombe en compte ouvert", () => {
    const data = parseData({
      version: 3,
      accounts: [{ id: "a", name: "L", email: "a@b.ch", sealed: { salt: 1, iv: 2 } }],
    });
    expect(isProtected(data.accounts[0]!)).toBe(false);
  });

  it("ne connecte pas un compte actif inconnu", () => {
    const data = parseData({ version: 3, activeId: "fantôme", accounts: [{ id: "a", name: "A" }] });
    expect(data.activeId).toBeNull();
  });

  it("écarte les comptes illisibles", () => {
    const data = parseData({ version: 3, accounts: [null, 42, { id: "a", name: "A" }] });
    expect(data.accounts).toHaveLength(1);
  });

  it("tronque un nom trop long", () => {
    const data = parseData({ version: 3, accounts: [{ id: "a", name: "x".repeat(200) }] });
    expect(data.accounts[0]!.name.length).toBe(40);
  });
});

describe("recherche par email", () => {
  const accounts = parseData({
    version: 3,
    accounts: [
      { id: "a", name: "L", email: "leugzim@example.ch", sealed: { salt: "x", iv: "y", data: "z" } },
      { id: "b", name: "Ouvert", email: null },
    ],
  }).accounts;

  it("trouve, insensible à la casse et aux espaces", () => {
    expect(findByEmail(accounts, "  LEUGZIM@EXAMPLE.CH ")?.id).toBe("a");
    expect(findByEmail(accounts, "inconnu@example.ch")).toBeUndefined();
  });

  it("détecte un email déjà pris, sauf pour le compte lui-même", () => {
    expect(emailTaken(accounts, "leugzim@example.ch")).toBe(true);
    expect(emailTaken(accounts, "leugzim@example.ch", "a")).toBe(false);
    expect(emailTaken(accounts, "libre@example.ch")).toBe(false);
  });
});

describe("séjours, robustesse et export", () => {
  const wrap = (stays: unknown[]) =>
    parseData({ version: 3, accounts: [{ id: "a", name: "A", content: { stays, profile: {} } }] });

  it("normalise le pays et garde les drapeaux", () => {
    const s = openContent(wrap([{ id: "a", entry: "2026-01-05", exit: "2026-01-19", country: "ch", exempt: true }]).accounts[0]!)!.stays;
    expect(s[0]!.country).toBe("CH");
    expect(s[0]!.exempt).toBe(true);
  });

  it("écarte les séjours illisibles sans planter", () => {
    const s = openContent(wrap([
      { id: "ok", entry: "2026-01-05", exit: null, country: "CH" },
      { id: "ko", entry: "pas-une-date", exit: "2026-01-19", country: "CH" },
      null, 42,
      { id: "exit-bruit", entry: "2026-02-01", exit: "bruit", country: "CH" },
    ]).accounts[0]!)!.stays;
    expect(s.map((x) => x.id)).toEqual(["ok", "exit-bruit"]);
    expect(s[1]!.exit).toBeNull();
  });

  it("renvoie une base vide sur une entrée absurde", () => {
    expect(parseData(null)).toEqual(emptyData());
    expect(parseData("bruit")).toEqual(emptyData());
    expect(parseData({})).toEqual(emptyData());
  });

  it("l'export se relit à l'identique", () => {
    const original = parseData({
      version: 3, locale: "sq",
      accounts: [
        { id: "a", name: "Leugzim", email: "a@b.ch", sealed: { salt: "s", iv: "i", data: "d" } },
        { id: "b", name: "Arta", content: { stays: REAL_STAYS, profile: {} } },
      ],
    });
    expect(fromImportString(toExportString(original))).toEqual(original);
  });

  it("une migration est idempotente", () => {
    const once = parseData({ version: 1, stays: REAL_STAYS, profile: {} });
    expect(parseData(JSON.parse(JSON.stringify(once)))).toEqual(once);
  });

  it("newId produit des identifiants distincts", () => {
    expect(newId()).not.toBe(newId());
  });
});
