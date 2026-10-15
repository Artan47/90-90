import { describe, it, expect } from "vitest";
import type { Stay } from "./types";
import {
  WINDOW, MAX_DAYS,
  windowStart, windowEnd, countedDays, usedOn, remainingOn, isCompliantOn,
  maxStayFrom, earliestReentry, fullResetDate, simulate, timeline, validate,
  stayDays, currentStay, mustLeaveBy, statusOn, materializePlanned,
  MAX_ITERATIONS, plannedOutlook, summarize,
} from "./schengen";
import { inclusiveDays, addDays } from "./date";

/** Fabrique un séjour ; l'id est dérivé des dates pour la lisibilité. */
function stay(entry: string, exit: string | null, extra: Partial<Stay> = {}): Stay {
  return { id: `${entry}_${exit ?? "open"}`, entry, exit, country: "DE", ...extra };
}

// ════════════════════════════════════════════════════════════════════
// TEST 0 — comptage élémentaire
// ════════════════════════════════════════════════════════════════════
describe("TEST 0 — comptage élémentaire (entrée et sortie comptent)", () => {
  const cases: Array<[string, string, number]> = [
    ["2026-03-10", "2026-03-10", 1],   // entrée et sortie le même jour
    ["2026-03-10", "2026-03-11", 2],
    ["2026-01-10", "2026-04-09", 90],
    ["2024-02-01", "2024-03-01", 30],  // 2024 bissextile
    ["2026-02-01", "2026-03-01", 29],  // 2026 non bissextile
  ];

  it.each(cases)("%s → %s = %i jour(s)", (entry, exit, expected) => {
    expect(stayDays(stay(entry, exit))).toBe(expected);
    expect(countedDays([stay(entry, exit)], entry, exit).size).toBe(expected);
    expect(inclusiveDays(entry, exit)).toBe(expected);
  });
});

// ════════════════════════════════════════════════════════════════════
// TEST 1 — largeur de la fenêtre
// ════════════════════════════════════════════════════════════════════
describe("TEST 1 — la fenêtre est [D − 179 ; D], soit 180 jours", () => {
  it("windowStart('2026-04-09') === '2025-10-12'", () => {
    expect(windowStart("2026-04-09")).toBe("2025-10-12");
  });

  it("l'intervalle contient exactement 180 jours", () => {
    expect(inclusiveDays("2025-10-12", "2026-04-09")).toBe(WINDOW);
    expect(WINDOW).toBe(180);
    expect(MAX_DAYS).toBe(90);
  });

  it("windowEnd est le jour évalué lui-même", () => {
    expect(windowEnd("2026-04-09")).toBe("2026-04-09");
  });

  it("un séjour de 180 jours pile remplit la fenêtre, sans décalage", () => {
    // Contrôle anti « fenêtre qui part de la veille / du lendemain ».
    expect(windowStart("2026-01-01")).toBe("2025-07-06");
    expect(inclusiveDays(windowStart("2026-01-01"), "2026-01-01")).toBe(180);
  });
});

// ════════════════════════════════════════════════════════════════════
// TEST A — séjour continu de 90 jours
// ════════════════════════════════════════════════════════════════════
describe("TEST A — 90 jours d'affilée (mythe « 90 dehors = 90 rendus »)", () => {
  const history = [stay("2026-01-10", "2026-04-09")];

  it("le séjour fait bien 90 jours", () => {
    expect(stayDays(history[0]!)).toBe(90);
  });

  it("usedOn(2026-04-09) === 90 et remainingOn === 0", () => {
    expect(usedOn(history, "2026-04-09")).toBe(90);
    expect(remainingOn(history, "2026-04-09")).toBe(0);
    expect(isCompliantOn(history, "2026-04-09")).toBe(true);
  });

  it("le 1er jour avec au moins 1 jour disponible est le 2026-07-09", () => {
    expect(earliestReentry(history, "2026-04-10")).toBe("2026-07-09");
    expect(remainingOn(history, "2026-07-09")).toBe(1);
    // 90 jours d'absence (10.04 → 08.07) ne rendent RIEN : la veille est
    // encore à zéro. Le crédit revient jour par jour, pas par blocs.
    expect(remainingOn(history, "2026-07-08")).toBe(0);
  });

  it("le 1er jour avec les 90 jours disponibles est le 2026-10-06", () => {
    expect(fullResetDate(history, "2026-04-10")).toBe("2026-10-06");
    expect(remainingOn(history, "2026-10-06")).toBe(90);
    expect(remainingOn(history, "2026-10-05")).toBe(89);
  });

  it("le crédit revient exactement d'un jour par jour", () => {
    expect(remainingOn(history, "2026-07-09")).toBe(1);
    expect(remainingOn(history, "2026-07-10")).toBe(2);
    expect(remainingOn(history, "2026-07-11")).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// TEST B — voyageur fréquent
// ════════════════════════════════════════════════════════════════════
describe("TEST B — voyageur fréquent (mythe « restants = durée max »)", () => {
  const history = [
    stay("2026-01-05", "2026-01-19"), // 15
    stay("2026-02-10", "2026-02-24"), // 15
    stay("2026-04-01", "2026-04-30"), // 30
    stay("2026-06-01", "2026-06-20"), // 20
  ];
  const TODAY = "2026-08-27";

  it("le total saisi est de 80 jours", () => {
    expect(history.reduce((n, s) => n + stayDays(s), 0)).toBe(80);
  });

  it("la fenêtre glissante au 2026-08-27 va du 2026-03-01 au 2026-08-27", () => {
    expect(windowStart(TODAY)).toBe("2026-03-01");
    expect(windowEnd(TODAY)).toBe("2026-08-27");
  });

  it("usedOn === 50 (et non 80 : janvier et février sont sortis)", () => {
    expect(usedOn(history, TODAY)).toBe(50);
  });

  it("remainingOn === 40", () => {
    expect(remainingOn(history, TODAY)).toBe(40);
  });

  it("maxStayFrom(2026-08-27) → dernier jour 2026-11-04, soit 70 jours", () => {
    const max = maxStayFrom(history, TODAY);
    expect(max.lastPossibleExit).toBe("2026-11-04");
    expect(max.days).toBe(70);
    expect(max.nights).toBe(69);
    // Le cœur du sujet : 40 jours restants aujourd'hui, mais 70 jours de
    // séjour possible, parce que le crédit se libère PENDANT le séjour.
    expect(max.days).toBeGreaterThan(remainingOn(history, TODAY));
  });

  it("le séjour de 70 jours est légal, celui de 71 ne l'est pas", () => {
    expect(simulate(history, { entry: TODAY, exit: "2026-11-04" }).ok).toBe(true);
    const over = simulate(history, { entry: TODAY, exit: "2026-11-05" });
    expect(over.ok).toBe(false);
    expect(over.firstOverflowDate).toBe("2026-11-05");
    expect(over.daysOver).toBe(1);
  });

  it("le 1er jour avec les 90 jours disponibles est le 2026-12-17", () => {
    expect(fullResetDate(history, TODAY)).toBe("2026-12-17");
    expect(remainingOn(history, "2026-12-17")).toBe(90);
    expect(remainingOn(history, "2026-12-16")).toBe(89);
  });

  it("earliestReentry est aujourd'hui même, puisqu'il reste du crédit", () => {
    expect(earliestReentry(history, TODAY)).toBe(TODAY);
  });
});

// ════════════════════════════════════════════════════════════════════
// TEST C — exclusions
// ════════════════════════════════════════════════════════════════════
describe("TEST C — exclusions (exempt, pays hors quota, table datée)", () => {
  it("un séjour exempt: true n'ajoute rien au compteur", () => {
    const s = [stay("2026-06-01", "2026-06-30", { exempt: true })];
    expect(usedOn(s, "2026-06-30")).toBe(0);
    expect(remainingOn(s, "2026-06-30")).toBe(90);
  });

  it("l'Irlande n'ajoute rien, quelle que soit la date", () => {
    expect(usedOn([stay("2026-06-01", "2026-06-30", { country: "IE" })], "2026-06-30")).toBe(0);
    expect(usedOn([stay("2019-06-01", "2019-06-30", { country: "IE" })], "2019-06-30")).toBe(0);
  });

  it("Chypre n'ajoute rien, quelle que soit la date", () => {
    expect(usedOn([stay("2026-06-01", "2026-06-30", { country: "CY" })], "2026-06-30")).toBe(0);
    expect(usedOn([stay("2030-06-01", "2030-06-30", { country: "CY" })], "2030-06-30")).toBe(0);
  });

  it("Roumanie 2023-05-01 → 2023-05-20 ajoute 0 jour", () => {
    const s = [stay("2023-05-01", "2023-05-20", { country: "RO" })];
    expect(usedOn(s, "2023-05-20")).toBe(0);
  });

  it("Roumanie 2026-05-01 → 2026-05-20 ajoute 20 jours", () => {
    const s = [stay("2026-05-01", "2026-05-20", { country: "RO" })];
    expect(usedOn(s, "2026-05-20")).toBe(20);
  });

  it("Bulgarie à cheval sur le 2024-03-31 : seule la part à partir du 31 compte", () => {
    // 25.03 → 05.04 = 12 jours saisis, mais seuls 31.03 → 05.04 = 6 comptent.
    const s = [stay("2024-03-25", "2024-04-05", { country: "BG" })];
    expect(stayDays(s[0]!)).toBe(12);
    expect(usedOn(s, "2024-04-05")).toBe(6);
    const counted = countedDays(s, "2024-03-25", "2024-04-05");
    expect(counted.has("2024-03-30")).toBe(false);
    expect(counted.has("2024-03-31")).toBe(true);
  });

  it("la Croatie bascule au 2023-01-01", () => {
    expect(usedOn([stay("2022-12-20", "2022-12-31", { country: "HR" })], "2022-12-31")).toBe(0);
    expect(usedOn([stay("2023-01-01", "2023-01-10", { country: "HR" })], "2023-01-10")).toBe(10);
  });

  it("un code pays inconnu est traité comme un pays tiers", () => {
    expect(usedOn([stay("2026-06-01", "2026-06-30", { country: "ZZ" })], "2026-06-30")).toBe(0);
  });

  it("les séjours planned: true sont hors de l'historique réel", () => {
    const s = [stay("2026-06-01", "2026-06-30", { planned: true })];
    expect(usedOn(s, "2026-06-30")).toBe(0);
    // …mais ils comptent une fois matérialisés dans une projection.
    expect(usedOn(materializePlanned(s), "2026-06-30")).toBe(30);
  });
});

// ════════════════════════════════════════════════════════════════════
// TEST D — saisie incohérente
// ════════════════════════════════════════════════════════════════════
describe("TEST D — saisie incohérente", () => {
  it("sortie antérieure à l'entrée → EXIT_BEFORE_ENTRY", () => {
    const issues = validate([stay("2026-06-10", "2026-06-01")]);
    expect(issues.map((i) => i.code)).toContain("EXIT_BEFORE_ENTRY");
    expect(issues[0]!.stayId).toBe("2026-06-10_2026-06-01");
    expect(issues[0]!.message.length).toBeGreaterThan(0);
  });

  it("deux séjours qui se chevauchent → OVERLAP", () => {
    const s = [stay("2026-06-01", "2026-06-10"), stay("2026-06-05", "2026-06-15")];
    const issues = validate(s);
    expect(issues.map((i) => i.code)).toContain("OVERLAP");
  });

  it("les jours communs ne sont comptés qu'une seule fois", () => {
    const s = [stay("2026-06-01", "2026-06-10"), stay("2026-06-05", "2026-06-15")];
    // 01 → 15 = 15 jours distincts, et non 10 + 11 = 21.
    expect(usedOn(s, "2026-06-15")).toBe(15);
    expect(countedDays(s, "2026-06-01", "2026-06-15").size).toBe(15);
  });

  it("trois séjours emboîtés ne comptent chaque jour qu'une fois", () => {
    const s = [
      stay("2026-06-01", "2026-06-20"),
      stay("2026-06-05", "2026-06-10"),
      stay("2026-06-08", "2026-06-25"),
    ];
    expect(usedOn(s, "2026-06-25")).toBe(25);
  });

  it("entrée future saisie comme historique → FUTURE_ENTRY_IN_HISTORY", () => {
    const issues = validate([stay("2027-01-01", "2027-01-10")], "2026-08-27");
    expect(issues.map((i) => i.code)).toContain("FUTURE_ENTRY_IN_HISTORY");
    // Un voyage explicitement planifié ne déclenche pas l'alerte.
    const planned = validate([stay("2027-01-01", "2027-01-10", { planned: true })], "2026-08-27");
    expect(planned.map((i) => i.code)).not.toContain("FUTURE_ENTRY_IN_HISTORY");
  });

  it("historique dépassant 90 jours → OVER_90 avec date et ampleur", () => {
    // 100 jours d'affilée : le 91ᵉ jour est le premier en infraction.
    const s = [stay("2026-01-10", "2026-04-19")];
    const issues = validate(s);
    const over = issues.find((i) => i.code === "OVER_90");
    expect(over).toBeDefined();
    expect(over!.firstOverflowDate).toBe("2026-04-10");
    expect(over!.daysOver).toBe(10);
    expect(isCompliantOn(s, "2026-04-19")).toBe(false);
    expect(usedOn(s, "2026-04-19")).toBe(100);
    expect(remainingOn(s, "2026-04-19")).toBe(0); // borné à 0, jamais négatif
  });

  it("un historique sain ne produit aucune anomalie", () => {
    const s = [stay("2026-01-05", "2026-01-19"), stay("2026-02-10", "2026-02-24")];
    expect(validate(s, "2026-08-27")).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// Séjour en cours, statut, chronologie, simulation
// ════════════════════════════════════════════════════════════════════
describe("séjour en cours (exit === null)", () => {
  const history = [stay("2026-08-01", null)];

  it("est compté comme se terminant le jour évalué", () => {
    expect(usedOn(history, "2026-08-10")).toBe(10);
    expect(usedOn(history, "2026-08-27")).toBe(27);
  });

  it("est retrouvé par currentStay", () => {
    expect(currentStay(history, "2026-08-27")?.id).toBe(history[0]!.id);
    expect(currentStay([stay("2026-01-01", "2026-01-05")], "2026-08-27")).toBeNull();
    // Un séjour ouvert dont l'entrée est future n'a pas encore commencé.
    expect(currentStay([stay("2026-09-01", null)], "2026-08-27")).toBeNull();
  });

  it("donne la date limite de sortie", () => {
    // Entré le 01.08 sans autre historique : 90 jours → dernier jour 29.10.
    expect(mustLeaveBy(history, "2026-08-27")).toBe("2026-10-29");
    expect(inclusiveDays("2026-08-01", "2026-10-29")).toBe(90);
    expect(mustLeaveBy([stay("2026-01-01", "2026-01-05")], "2026-08-27")).toBeNull();
  });
});

describe("statusOn — vue d'ensemble pour l'écran d'accueil", () => {
  const history = [
    stay("2026-01-05", "2026-01-19"),
    stay("2026-02-10", "2026-02-24"),
    stay("2026-04-01", "2026-04-30"),
    stay("2026-06-01", "2026-06-20"),
  ];

  it("agrège les chiffres du TEST B", () => {
    const st = statusOn(history, "2026-08-27");
    expect(st.used).toBe(50);
    expect(st.remaining).toBe(40);
    expect(st.windowFrom).toBe("2026-03-01");
    expect(st.windowTo).toBe("2026-08-27");
    expect(st.inside).toBe(false);
    expect(st.compliant).toBe(true);
    expect(st.maxStay.days).toBe(70);
    expect(st.maxStay.lastPossibleExit).toBe("2026-11-04");
    expect(st.fullReset).toBe("2026-12-17");
    expect(st.mustLeaveBy).toBeNull();
  });

  it("signale un séjour en cours", () => {
    const st = statusOn([stay("2026-08-01", null)], "2026-08-27");
    expect(st.inside).toBe(true);
    expect(st.mustLeaveBy).toBe("2026-10-29");
    expect(st.used).toBe(27);
  });

  it("signale un compteur épuisé et la date de retour", () => {
    const st = statusOn([stay("2026-01-10", "2026-04-09")], "2026-04-09");
    expect(st.remaining).toBe(0);
    expect(st.earliestReentry).toBe("2026-07-09");
  });
});

describe("maxStayFrom — bornes", () => {
  it("sans historique, on peut rester 90 jours", () => {
    const max = maxStayFrom([], "2026-01-01");
    expect(max.days).toBe(90);
    expect(max.lastPossibleExit).toBe("2026-03-31");
    expect(max.nights).toBe(89);
  });

  it("quota épuisé → 0 jour possible", () => {
    const history = [stay("2026-01-10", "2026-04-09")];
    const max = maxStayFrom(history, "2026-04-10");
    expect(max.days).toBe(0);
    expect(max.nights).toBe(0);
  });

  it("ne dépasse jamais 90 jours consécutifs", () => {
    expect(maxStayFrom([], "2026-06-15").days).toBeLessThanOrEqual(90);
  });
});

describe("simulate", () => {
  const history = [stay("2026-01-10", "2026-04-09")];

  it("accepte un voyage qui tient dans le quota", () => {
    const r = simulate(history, { entry: "2026-10-06", exit: "2026-10-20" });
    expect(r.ok).toBe(true);
    expect(r.firstOverflowDate).toBeUndefined();
    expect(r.daysOver).toBeUndefined();
  });

  it("refuse un voyage trop long et donne la date exacte d'infraction", () => {
    const r = simulate(history, { entry: "2026-05-01", exit: "2026-05-10" });
    expect(r.ok).toBe(false);
    expect(r.firstOverflowDate).toBe("2026-05-01");
    expect(r.daysOver).toBeGreaterThan(0);
  });

  it("refuse un voyage dont la sortie précède l'entrée", () => {
    const r = simulate([], { entry: "2026-05-10", exit: "2026-05-01" });
    expect(r.ok).toBe(false);
  });

  it("ignore les voyages déjà enregistrés comme planifiés", () => {
    const withPlan = [...history, stay("2026-10-06", "2026-10-20", { planned: true })];
    // Le plan ne doit pas se compter lui-même deux fois dans sa propre simulation.
    const r = simulate(withPlan, { entry: "2026-10-06", exit: "2026-10-20" });
    expect(r.ok).toBe(true);
  });
});

describe("timeline", () => {
  const history = [stay("2026-01-10", "2026-04-09")];

  it("produit un point par jour, bornes incluses", () => {
    const t = timeline(history, "2026-04-01", "2026-04-10");
    expect(t).toHaveLength(10);
    expect(t[0]!.date).toBe("2026-04-01");
    expect(t[9]!.date).toBe("2026-04-10");
  });

  it("used + remaining reste cohérent", () => {
    for (const p of timeline(history, "2026-03-01", "2026-11-01")) {
      expect(p.remaining).toBe(Math.max(0, 90 - p.used));
      expect(p.used).toBeGreaterThanOrEqual(0);
    }
  });

  it("montre le crédit qui revient jour par jour", () => {
    const t = timeline(history, "2026-07-08", "2026-07-11");
    expect(t.map((p) => p.remaining)).toEqual([0, 1, 2, 3]);
  });

  it("renvoie un tableau vide si l'intervalle est inversé", () => {
    expect(timeline(history, "2026-04-10", "2026-04-01")).toEqual([]);
  });
});

describe("countedDays — robustesse", () => {
  it("ignore les séjours dont la sortie précède l'entrée", () => {
    expect(usedOn([stay("2026-06-10", "2026-06-01")], "2026-06-15")).toBe(0);
  });

  it("tronque aux bornes demandées", () => {
    const s = [stay("2026-06-01", "2026-06-30")];
    expect(countedDays(s, "2026-06-10", "2026-06-14").size).toBe(5);
  });

  it("renvoie un ensemble vide sur un intervalle inversé", () => {
    expect(countedDays([stay("2026-06-01", "2026-06-30")], "2026-06-30", "2026-06-01").size).toBe(0);
  });

  it("ignore les entrées malformées plutôt que de planter", () => {
    const bad = [
      { id: "x", entry: "pas-une-date", exit: "2026-06-10", country: "DE" },
      { id: "y", entry: "2026-06-01", exit: "bruit", country: "DE" },
    ] as Stay[];
    expect(() => usedOn(bad, "2026-06-15")).not.toThrow();
    expect(usedOn(bad, "2026-06-15")).toBe(0);
  });
});


describe("bornes des boucles jour par jour (jamais d'infini)", () => {
  it("earliestReentry rend la main même si aucun jour ne se libère", () => {
    // Séjour ouvert : il consomme chaque jour examiné, le quota ne se
    // libère donc jamais. La boucle doit s'arrêter à MAX_ITERATIONS.
    const open = [stay("2026-01-01", null)];
    const r = earliestReentry(open, "2026-06-01");
    expect(r).toBe(addDays("2026-06-01", MAX_ITERATIONS));
  });

  it("fullResetDate rend la main même si le quota ne se vide jamais", () => {
    const open = [stay("2026-01-01", null)];
    const r = fullResetDate(open, "2026-06-01");
    expect(r).toBe(addDays("2026-06-01", MAX_ITERATIONS));
  });

  it("maxStayFrom ne dépasse jamais MAX_ITERATIONS", () => {
    expect(maxStayFrom([], "2026-01-01").days).toBeLessThan(MAX_ITERATIONS);
  });
});

describe("validate — entrées malformées et cas limites", () => {
  it("signale une date d'entrée invalide", () => {
    const bad = [{ id: "b", entry: "bruit", exit: "2026-01-10", country: "DE" }] as Stay[];
    const issues = validate(bad);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.code).toBe("EXIT_BEFORE_ENTRY");
  });

  it("ne signale pas de chevauchement entre un séjour réel et un séjour planifié", () => {
    const s = [
      stay("2026-06-01", "2026-06-10"),
      stay("2026-06-05", "2026-06-15", { planned: true }),
    ];
    expect(validate(s).map((i) => i.code)).not.toContain("OVERLAP");
  });

  it("détecte le chevauchement avec un séjour encore ouvert", () => {
    const s = [stay("2026-06-01", null), stay("2026-06-05", "2026-06-15")];
    expect(validate(s).map((i) => i.code)).toContain("OVERLAP");
  });

  it("ignore les paires dont une saisie est incohérente", () => {
    const s = [stay("2026-06-10", "2026-06-01"), stay("2026-06-05", "2026-06-15")];
    expect(validate(s).map((i) => i.code)).not.toContain("OVERLAP");
  });

  it("un séjour ouvert qui dépasse 90 jours est signalé", () => {
    const s = [stay("2026-01-01", null)];
    const over = validate(s).find((i) => i.code === "OVER_90");
    expect(over).toBeDefined();
    expect(over!.firstOverflowDate).toBe("2026-04-01"); // 91ᵉ jour
    expect(over!.stayId).toBe(s[0]!.id);
  });

  it("un historique uniquement exempt ne déclenche pas OVER_90", () => {
    const s = [stay("2026-01-01", "2026-12-31", { exempt: true })];
    expect(validate(s).map((i) => i.code)).not.toContain("OVER_90");
  });

  it("une liste vide ne produit rien", () => {
    expect(validate([])).toEqual([]);
    expect(validate([], "2026-08-27")).toEqual([]);
  });
});

describe("stayDays", () => {
  it("mesure un séjour ouvert jusqu'à une date donnée", () => {
    expect(stayDays(stay("2026-08-01", null), "2026-08-10")).toBe(10);
    expect(stayDays(stay("2026-08-01", null))).toBe(0);
  });

  it("renvoie 0 sur une saisie incohérente ou invalide", () => {
    expect(stayDays(stay("2026-08-10", "2026-08-01"))).toBe(0);
    expect(stayDays({ id: "z", entry: "bruit", exit: "2026-08-01", country: "DE" })).toBe(0);
    expect(stayDays({ id: "z", entry: "2026-08-01", exit: "bruit", country: "DE" })).toBe(0);
  });
});

describe("mustLeaveBy — avec historique antérieur", () => {
  it("raccourcit la limite de sortie en fonction du passé", () => {
    const s = [stay("2026-06-01", "2026-06-20"), stay("2026-08-01", null)];
    const limit = mustLeaveBy(s, "2026-08-27");
    expect(limit).not.toBeNull();
    expect(usedOn(s, limit!)).toBeLessThanOrEqual(90);
    expect(usedOn(s, addDays(limit!, 1))).toBeGreaterThan(90);
  });
});

describe("plannedOutlook — les voyages planifiés jugés EN BLOC", () => {
  it("sans voyage planifié, rien à signaler", () => {
    const o = plannedOutlook([stay("2026-01-05", "2026-01-19")], "2026-08-27");
    expect(o.trips).toEqual([]);
    expect(o.anyOverflow).toBe(false);
    expect(o.lastExit).toBeNull();
    expect(o.remainingAfter).toBe(90);
  });

  it("un voyage planifié qui tient est accepté", () => {
    const s = [stay("2026-09-01", "2026-09-10", { planned: true })];
    const o = plannedOutlook(s, "2026-08-27");
    expect(o.trips).toHaveLength(1);
    expect(o.trips[0]!.days).toBe(10);
    expect(o.trips[0]!.ok).toBe(true);
    expect(o.anyOverflow).toBe(false);
    expect(o.lastExit).toBe("2026-09-10");
    expect(o.remainingAfter).toBe(80);
  });

  it("tient compte de l'historique réel", () => {
    // 85 jours déjà consommés : le 5 septembre atteint pile 90, le
    // dépassement commence donc le 6, et le voyage finit 5 jours au-dessus.
    const s = [
      stay("2026-06-01", "2026-08-24"), // 85 j
      stay("2026-09-01", "2026-09-10", { planned: true }), // 10 j
    ];
    expect(stayDays(s[0]!)).toBe(85);
    const o = plannedOutlook(s, "2026-08-27");
    expect(o.anyOverflow).toBe(true);
    expect(o.firstOverflowDate).toBe("2026-09-06");
    expect(o.daysOver).toBe(5);
    expect(o.trips[0]!.daysOver).toBe(5);
  });

  it("DEUX voyages qui passent séparément mais pas ensemble", () => {
    // C'est tout l'intérêt du calcul en bloc : isolément chacun est légal.
    const a = stay("2026-01-10", "2026-03-10", { planned: true }); // 60 j
    const b = stay("2026-03-20", "2026-05-08", { planned: true }); // 50 j

    expect(simulate([], { entry: a.entry, exit: a.exit! }).ok).toBe(true);
    expect(simulate([], { entry: b.entry, exit: b.exit! }).ok).toBe(true);

    const o = plannedOutlook([a, b], "2026-01-01");
    expect(o.trips).toHaveLength(2);
    expect(o.trips[0]!.ok).toBe(true);   // le premier passe
    expect(o.trips[1]!.ok).toBe(false);  // le second déborde
    expect(o.anyOverflow).toBe(true);
    expect(o.daysOver).toBe(20);
  });

  it("les voyages sont rendus dans l'ordre chronologique", () => {
    const s = [
      stay("2026-11-01", "2026-11-05", { planned: true }),
      stay("2026-09-01", "2026-09-05", { planned: true }),
    ];
    const o = plannedOutlook(s, "2026-08-27");
    expect(o.trips.map((t) => t.entry)).toEqual(["2026-09-01", "2026-11-01"]);
    expect(o.lastExit).toBe("2026-11-05");
  });

  it("ignore un voyage planifié sans date de sortie", () => {
    expect(plannedOutlook([stay("2026-09-01", null, { planned: true })], "2026-08-27").trips)
      .toEqual([]);
  });
});

describe("summarize — résumé de l'historique", () => {
  it("compte les séjours réels et leurs jours", () => {
    const s = [
      stay("2026-01-05", "2026-01-19"), // 15
      stay("2026-02-10", "2026-02-24"), // 15
      stay("2026-09-01", "2026-09-10", { planned: true }), // exclu
    ];
    expect(summarize(s, "2026-08-27")).toEqual({ stayCount: 2, totalDays: 30 });
  });

  it("compte un séjour en cours jusqu'à aujourd'hui", () => {
    expect(summarize([stay("2026-08-01", null)], "2026-08-27"))
      .toEqual({ stayCount: 1, totalDays: 27 });
  });

  it("une liste vide donne zéro", () => {
    expect(summarize([], "2026-08-27")).toEqual({ stayCount: 0, totalDays: 0 });
  });
});

describe("statusOn — intègre le résumé et la projection", () => {
  it("expose les deux en un seul passage", () => {
    const s = [
      stay("2026-01-05", "2026-01-19"),
      stay("2026-09-01", "2026-09-10", { planned: true }),
    ];
    const st = statusOn(s, "2026-08-27");
    expect(st.summary.stayCount).toBe(1);
    expect(st.summary.totalDays).toBe(15);
    expect(st.planned.trips).toHaveLength(1);
    expect(st.planned.anyOverflow).toBe(false);
    // Le compteur du jour ignore toujours les voyages planifiés.
    expect(st.used).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// TEST E — fuseaux horaires
// ════════════════════════════════════════════════════════════════════
describe("TEST E — les résultats ne dépendent pas du fuseau", () => {
  it("les chiffres du TEST B sont identiques sous tout TZ", () => {
    // Rejoué tel quel par `npm run test:tz` sous UTC, Pacific/Kiritimati
    // (UTC+14) et Pacific/Niue (UTC−11).
    const history = [
      stay("2026-01-05", "2026-01-19"),
      stay("2026-02-10", "2026-02-24"),
      stay("2026-04-01", "2026-04-30"),
      stay("2026-06-01", "2026-06-20"),
    ];
    expect(windowStart("2026-08-27")).toBe("2026-03-01");
    expect(usedOn(history, "2026-08-27")).toBe(50);
    expect(remainingOn(history, "2026-08-27")).toBe(40);
    expect(maxStayFrom(history, "2026-08-27").lastPossibleExit).toBe("2026-11-04");
    expect(maxStayFrom(history, "2026-08-27").days).toBe(70);
    expect(fullResetDate(history, "2026-08-27")).toBe("2026-12-17");
  });

  it("les chiffres du TEST A sont identiques sous tout TZ", () => {
    const history = [stay("2026-01-10", "2026-04-09")];
    expect(usedOn(history, "2026-04-09")).toBe(90);
    expect(earliestReentry(history, "2026-04-10")).toBe("2026-07-09");
    expect(fullResetDate(history, "2026-04-10")).toBe("2026-10-06");
  });
});
