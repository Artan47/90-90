import { describe, it, expect } from "vitest";
import {
  fill, getMessages, t, DEFAULT_LOCALE, LOCALES, LOCALE_LABELS,
  LOCALE_ORDER, isLocale, localeFromUrl, type Locale,
} from "./index";

/** Chemins de toutes les feuilles d'un objet de messages. */
function leaves(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, `${prefix}[${i}]`));
  return Object.entries(obj).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n — jetons", () => {
  it("remplit les jetons", () => {
    expect(fill("{used} nga 90", { used: 50 })).toBe("50 nga 90");
    expect(fill("Fenêtre : {from} – {to}", { from: "01.03.2026", to: "27.08.2026" }))
      .toBe("Fenêtre : 01.03.2026 – 27.08.2026");
  });

  it("laisse intacts les jetons inconnus", () => {
    expect(fill("{a} et {b}", { a: "x" })).toBe("x et {b}");
  });
});

describe("i18n — parité des langues", () => {
  const locales = Object.keys(LOCALES) as Locale[];

  it("expose l'albanais et le français", () => {
    expect(locales.sort()).toEqual(["fr", "sq"]);
    expect(DEFAULT_LOCALE).toBe("sq");
    expect(getMessages()).toBe(t);
  });

  it("chaque langue a exactement les mêmes clés", () => {
    const reference = leaves(LOCALES.sq).sort();
    for (const code of locales) {
      expect({ code, keys: leaves(LOCALES[code]).sort() })
        .toEqual({ code, keys: reference });
    }
  });

  it("aucune valeur n'est vide", () => {
    for (const code of locales) {
      const empty = Object.entries(flatten(LOCALES[code]))
        .filter(([, v]) => typeof v === "string" && v.trim() === "")
        .map(([k]) => `${code}.${k}`);
      expect(empty).toEqual([]);
    }
  });

  it("les jetons {x} sont les mêmes d'une langue à l'autre", () => {
    const tokens = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    const ref = flatten(LOCALES.sq);
    for (const code of locales) {
      const other = flatten(LOCALES[code]);
      for (const key of Object.keys(ref)) {
        const a = ref[key];
        const b = other[key];
        if (typeof a === "string" && typeof b === "string") {
          expect({ key, code, tokens: tokens(b) })
            .toEqual({ key, code, tokens: tokens(a) });
        }
      }
    }
  });

  it("chaque langue a un libellé écrit dans sa propre langue", () => {
    for (const code of locales) {
      expect(LOCALE_LABELS[code].length).toBeGreaterThan(0);
      expect(LOCALE_ORDER).toContain(code);
    }
    expect(LOCALE_ORDER).toHaveLength(locales.length);
    expect(LOCALE_LABELS.fr).toBe("Français");
    expect(LOCALE_LABELS.sq).toBe("Shqip");
  });

  it("le français est bien du français, pas une copie de l'albanais", () => {
    expect(LOCALES.fr.home.title).not.toBe(LOCALES.sq.home.title);
    expect(LOCALES.fr.nav.home).toBe("Accueil");
    expect(LOCALES.sq.nav.home).toBe("Ballina");
  });
});

describe("i18n — langue imposée par l'adresse", () => {
  it("reconnaît ?lang=sq et ?lang=fr", () => {
    expect(localeFromUrl("?lang=sq")).toBe("sq");
    expect(localeFromUrl("?lang=fr")).toBe("fr");
    expect(localeFromUrl("lang=fr")).toBe("fr");
    expect(localeFromUrl("?autre=1&lang=sq&x=2")).toBe("sq");
  });

  it("ignore une langue inconnue ou absente", () => {
    expect(localeFromUrl("?lang=de")).toBeNull();
    expect(localeFromUrl("?lang=")).toBeNull();
    expect(localeFromUrl("?autre=1")).toBeNull();
    expect(localeFromUrl("")).toBeNull();
  });

  it("ne plante pas sur une adresse absurde", () => {
    expect(localeFromUrl("?%%%")).toBeNull();
  });
});

describe("i18n — détection et validation", () => {
  it("reconnaît les codes valides", () => {
    expect(isLocale("sq")).toBe(true);
    expect(isLocale("fr")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(null)).toBe(false);
    expect(isLocale(42)).toBe(false);
  });

  it("s'ouvre en albanais pour tout le monde", () => {
    // Plus de détection par navigateur : un téléphone en français ou en
    // allemand doit quand même arriver sur l'interface albanaise.
    expect(DEFAULT_LOCALE).toBe("sq");
    expect(getMessages().home.title).toBe("Sa ditë më kanë mbetur?");
  });
});

function flatten(obj: unknown, prefix = "", out: Record<string, unknown> = {}) {
  if (typeof obj !== "object" || obj === null) {
    out[prefix] = obj;
    return out;
  }
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    flatten(v, prefix ? `${prefix}.${k}` : k, out);
  }
  return out;
}
