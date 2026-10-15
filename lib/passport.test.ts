import { describe, it, expect } from "vitest";
import { passportStatus, WARN_MONTHS_BEFORE_EXPIRY, MAX_PASSPORT_YEARS } from "./passport";
import type { Profile } from "./types";

const P = (p: Partial<Profile>): Profile => ({ locale: "sq", ...p });
const TODAY = "2026-08-27";

describe("passeport — expiration", () => {
  it("sans date renseignée, rien n'est signalé", () => {
    const s = passportStatus(P({}), TODAY);
    expect(s.hasExpiry).toBe(false);
    expect(s.anyWarning).toBe(false);
    expect(s.daysUntilExpiry).toBeNull();
    expect(s.insufficientForExit).toBeNull();
  });

  it("détecte un passeport expiré", () => {
    const s = passportStatus(P({ passportExpiry: "2026-08-26" }), TODAY);
    expect(s.expired).toBe(true);
    expect(s.expiringSoon).toBe(false); // déjà expiré, pas « bientôt »
    expect(s.daysUntilExpiry).toBe(-1);
    expect(s.anyWarning).toBe(true);
  });

  it("le jour même de l'expiration, il est encore valable", () => {
    const s = passportStatus(P({ passportExpiry: TODAY }), TODAY);
    expect(s.expired).toBe(false);
    expect(s.daysUntilExpiry).toBe(0);
  });

  it("alerte à exactement 6 mois, pas avant", () => {
    // Expire le 27.02.2027 → l'alerte s'ouvre le 27.08.2026.
    const profile = P({ passportExpiry: "2027-02-27" });
    expect(passportStatus(profile, "2026-08-27").expiringSoon).toBe(true);
    expect(passportStatus(profile, "2026-08-26").expiringSoon).toBe(false);
    expect(passportStatus(profile, "2026-08-27").warnFrom).toBe("2026-08-27");
    expect(WARN_MONTHS_BEFORE_EXPIRY).toBe(6);
  });

  it("compte les mois en calendaire, pas en tranches de 30 jours", () => {
    // 6 mois avant le 31.08.2026 = 28.02.2026 (février borné), et non le 03.03.
    const s = passportStatus(P({ passportExpiry: "2026-08-31" }), "2026-02-28");
    expect(s.warnFrom).toBe("2026-02-28");
    expect(s.expiringSoon).toBe(true);
    expect(passportStatus(P({ passportExpiry: "2026-08-31" }), "2026-02-27").expiringSoon).toBe(false);
  });
});

describe("passeport — ancienneté", () => {
  it("signale un passeport délivré il y a plus de 10 ans", () => {
    expect(passportStatus(P({ passportIssued: "2016-08-26" }), TODAY).tooOld).toBe(true);
    expect(passportStatus(P({ passportIssued: "2016-08-27" }), TODAY).tooOld).toBe(false);
    expect(passportStatus(P({ passportIssued: "2016-08-27" }), TODAY).tenYearLimit).toBe("2026-08-27");
    expect(MAX_PASSPORT_YEARS).toBe(10);
  });

  it("gère un passeport délivré un 29 février", () => {
    const s = passportStatus(P({ passportIssued: "2016-02-29" }), "2026-03-01");
    expect(s.tenYearLimit).toBe("2026-02-28");
    expect(s.tooOld).toBe(true);
  });
});

describe("passeport — couverture de la sortie prévue", () => {
  it("exige 3 mois de validité après la sortie", () => {
    const profile = P({ passportExpiry: "2027-01-31" });
    // Sortie le 31.10.2026 → expiration minimale 31.01.2027 : tout juste bon.
    expect(passportStatus(profile, TODAY, "2026-10-31").insufficientForExit).toBe(false);
    expect(passportStatus(profile, TODAY, "2026-10-31").requiredExpiry).toBe("2027-01-31");
    // Un jour de sortie plus tard et ça ne passe plus.
    expect(passportStatus(profile, TODAY, "2026-11-01").insufficientForExit).toBe(true);
  });

  it("reste indéterminé si aucune sortie n'est connue", () => {
    expect(passportStatus(P({ passportExpiry: "2027-01-31" }), TODAY).insufficientForExit).toBeNull();
  });

  it("ignore les dates invalides plutôt que de planter", () => {
    const s = passportStatus(P({ passportExpiry: "31-01-2027" }), TODAY, "bruit");
    expect(s.hasExpiry).toBe(false);
    expect(s.anyWarning).toBe(false);
  });
});

describe("passeport — synthèse", () => {
  it("anyWarning agrège tous les motifs", () => {
    expect(passportStatus(P({ passportExpiry: "2030-01-01", passportIssued: "2025-01-01" }), TODAY).anyWarning)
      .toBe(false);
    expect(passportStatus(P({ passportExpiry: "2026-10-01" }), TODAY).anyWarning).toBe(true);
    expect(passportStatus(P({ passportIssued: "2010-01-01" }), TODAY).anyWarning).toBe(true);
  });
});
