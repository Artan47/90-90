import { describe, it, expect } from "vitest";
import {
  sealWithPassword, unsealWithPassword, deriveKey, seal, unseal,
  toBase64, fromBase64, randomBytes, normalizeEmail, isEmailLike,
  exportKey, importKey,
  isPasswordAcceptable, MIN_PASSWORD_LENGTH, PBKDF2_ITERATIONS,
} from "./crypto";

const SECRET = {
  stays: [{ id: "1", entry: "2026-05-13", exit: "2026-06-06", country: "CH" }],
  profile: { passportExpiry: "2028-03-10" },
};

describe("chiffrement — aller-retour", () => {
  it("rend exactement la valeur d'origine", async () => {
    const sealed = await sealWithPassword("fjalëkalimi123", SECRET);
    expect(await unsealWithPassword("fjalëkalimi123", sealed)).toEqual(SECRET);
  });

  it("refuse un mauvais mot de passe au lieu de rendre n'importe quoi", async () => {
    const sealed = await sealWithPassword("bon-mot-de-passe", SECRET);
    expect(await unsealWithPassword("mauvais", sealed)).toBeNull();
    expect(await unsealWithPassword("", sealed)).toBeNull();
    // Une seule lettre de différence suffit.
    expect(await unsealWithPassword("bon-mot-de-passF", sealed)).toBeNull();
  });

  it("accepte les mots de passe non latins et les emojis", async () => {
    for (const pw of ["çëçë-shqip", "мойпароль", "🔐🔐🔐🔐", "a".repeat(200)]) {
      const sealed = await sealWithPassword(pw, SECRET);
      expect(await unsealWithPassword(pw, sealed)).toEqual(SECRET);
    }
  });

  it("ne laisse AUCUNE donnée lisible dans le résultat", async () => {
    const sealed = await sealWithPassword("secret", SECRET);
    const blob = JSON.stringify(sealed);
    expect(blob).not.toContain("2026-05-13");
    expect(blob).not.toContain("passportExpiry");
    expect(blob).not.toContain("CH");
    expect(blob).not.toContain("secret");
  });

  it("produit un chiffré différent à chaque écriture", async () => {
    // Même mot de passe, même contenu : sel et IV neufs à chaque fois.
    const a = await sealWithPassword("x".repeat(10), SECRET);
    const b = await sealWithPassword("x".repeat(10), SECRET);
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
    // …et les deux restent déchiffrables.
    expect(await unsealWithPassword("x".repeat(10), a)).toEqual(SECRET);
    expect(await unsealWithPassword("x".repeat(10), b)).toEqual(SECRET);
  });

  it("détecte une altération du chiffré", async () => {
    const sealed = await sealWithPassword("secret", SECRET);
    const bytes = fromBase64(sealed.data);
    bytes[0] = bytes[0]! ^ 0xff;
    const tampered = { ...sealed, data: toBase64(bytes) };
    // AES-GCM est authentifié : une altération fait échouer, elle ne
    // produit pas des données silencieusement corrompues.
    expect(await unsealWithPassword("secret", tampered)).toBeNull();
  });

  it("résiste à un chiffré absurde", async () => {
    expect(await unsealWithPassword("x", { salt: "AAAA", iv: "AAAA", data: "AAAA" })).toBeNull();
    expect(await unsealWithPassword("x", { salt: "!!", iv: "!!", data: "!!" })).toBeNull();
  });

  it("réutilise une clé dérivée", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("mot-de-passe", salt);
    const sealed = await seal(key, salt, SECRET);
    expect(await unseal(key, sealed)).toEqual(SECRET);
  });

  it("une clé exportée puis relue déchiffre toujours", async () => {
    const salt = randomBytes(16);
    const key = await deriveKey("mot-de-passe", salt);
    const sealed = await seal(key, salt, SECRET);
    const restored = await importKey(await exportKey(key));
    expect(restored).not.toBeNull();
    expect(await unseal(restored!, sealed)).toEqual(SECRET);
  });

  it("une clé de session illisible est rejetée", async () => {
    expect(await importKey("!!pas-une-clé!!")).toBeNull();
    expect(await importKey("")).toBeNull();
  });

  it("utilise le nombre d'itérations recommandé", () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(310_000);
  });
});

describe("base64", () => {
  it("fait l'aller-retour sur des octets quelconques", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255, 42]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });

  it("randomBytes produit la bonne longueur et varie", () => {
    expect(randomBytes(16)).toHaveLength(16);
    expect(toBase64(randomBytes(16))).not.toBe(toBase64(randomBytes(16)));
  });
});

describe("email et mot de passe", () => {
  it("normalise l'email", () => {
    expect(normalizeEmail("  Leugzim@Example.CH ")).toBe("leugzim@example.ch");
  });

  it("valide la forme de l'email", () => {
    expect(isEmailLike("a@b.ch")).toBe(true);
    expect(isEmailLike(" Leugzim@Example.CH ")).toBe(true);
    expect(isEmailLike("pas-un-email")).toBe(false);
    expect(isEmailLike("a@b")).toBe(false);
    expect(isEmailLike("a b@c.ch")).toBe(false);
    expect(isEmailLike("")).toBe(false);
  });

  it("impose une longueur minimale au mot de passe", () => {
    expect(isPasswordAcceptable("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isPasswordAcceptable("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(6);
  });
});
