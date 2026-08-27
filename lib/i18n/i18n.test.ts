import { describe, it, expect } from "vitest";
import { fill, getMessages, t, DEFAULT_LOCALE } from "./index";

describe("i18n", () => {
  it("remplit les jetons", () => {
    expect(fill("{used} nga 90", { used: 50 })).toBe("50 nga 90");
    expect(fill("Dritarja: {from} – {to}", { from: "01.03.2026", to: "27.08.2026" }))
      .toBe("Dritarja: 01.03.2026 – 27.08.2026");
  });

  it("laisse intacts les jetons inconnus", () => {
    expect(fill("{a} et {b}", { a: "x" })).toBe("x et {b}");
  });

  it("expose l'albanais par défaut", () => {
    expect(DEFAULT_LOCALE).toBe("sq");
    expect(getMessages()).toBe(t);
    expect(t.home.title).toBe("Sa ditë më kanë mbetur?");
  });
});
