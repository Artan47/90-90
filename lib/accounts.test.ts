import { describe, it, expect } from "vitest";
import {
  isProtected, openContent, findByEmail, emailTaken,
  personToAccount, accountToPerson, emptyContent,
} from "./accounts";
import type { Account } from "./accounts";
import type { Person } from "./types";

const sealed = { salt: "s", iv: "i", data: "d" };
const locked: Account = { id: "a", name: "Leugzim", email: "a@b.ch", sealed };
const open: Account = {
  id: "b", name: "Moi", email: null,
  content: { stays: [{ id: "1", entry: "2026-01-01", exit: null, country: "CH" }], profile: {} },
};

describe("comptes — état de protection", () => {
  it("distingue protégé et ouvert", () => {
    expect(isProtected(locked)).toBe(true);
    expect(isProtected(open)).toBe(false);
    // Un email sans chiffré ne protège rien.
    expect(isProtected({ id: "c", name: "X", email: "a@b.ch" })).toBe(false);
    // Un chiffré sans email non plus.
    expect(isProtected({ id: "c", name: "X", email: null, sealed })).toBe(false);
  });

  it("un compte protégé n'expose AUCUN contenu", () => {
    expect(openContent(locked)).toBeNull();
  });

  it("un compte ouvert expose son contenu", () => {
    expect(openContent(open)!.stays).toHaveLength(1);
  });

  it("un compte ouvert sans contenu renvoie un contenu vide", () => {
    expect(openContent({ id: "c", name: "X", email: null })).toEqual(emptyContent());
  });
});

describe("comptes — conversions", () => {
  const person: Person = {
    id: "p", name: "Arta",
    stays: [{ id: "1", entry: "2026-05-13", exit: "2026-06-06", country: "CH" }],
    profile: { passportExpiry: "2030-01-01" },
  };

  it("une personne devient un compte ouvert, sans rien perdre", () => {
    const account = personToAccount(person);
    expect(account.id).toBe("p");
    expect(account.name).toBe("Arta");
    expect(account.email).toBeNull();
    expect(isProtected(account)).toBe(false);
    expect(account.content!.stays).toEqual(person.stays);
    expect(account.content!.profile).toEqual(person.profile);
  });

  it("l'aller-retour personne → compte → personne est fidèle", () => {
    const account = personToAccount(person);
    expect(accountToPerson(account, account.content!)).toEqual(person);
  });

  it("emptyContent est bien vide", () => {
    expect(emptyContent()).toEqual({ stays: [], profile: {} });
  });
});

describe("comptes — recherche par email", () => {
  const accounts = [locked, open];

  it("trouve, insensible à la casse et aux espaces", () => {
    expect(findByEmail(accounts, " A@B.CH ")?.id).toBe("a");
    expect(findByEmail(accounts, "inconnu@b.ch")).toBeUndefined();
  });

  it("ne confond pas un compte ouvert avec un email vide", () => {
    expect(findByEmail(accounts, "")).toBeUndefined();
  });

  it("détecte un email déjà pris, sauf pour le compte lui-même", () => {
    expect(emailTaken(accounts, "a@b.ch")).toBe(true);
    expect(emailTaken(accounts, "A@B.CH")).toBe(true);
    expect(emailTaken(accounts, "a@b.ch", "a")).toBe(false);
    expect(emailTaken(accounts, "libre@b.ch")).toBe(false);
  });
});
