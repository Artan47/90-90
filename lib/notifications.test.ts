import { describe, it, expect } from "vitest";
import { dueReminders } from "./notifications";

describe("rappels locaux — quels seuils déclenchent", () => {
  const base = { today: "2026-08-27", mustLeaveBy: null };

  it("rien au-dessus de 15 jours restants", () => {
    expect(dueReminders({ ...base, remaining: 40 })).toHaveLength(0);
    expect(dueReminders({ ...base, remaining: 15 })).toHaveLength(0);
  });

  it("alerte sous 15 jours", () => {
    const r = dueReminders({ ...base, remaining: 14 });
    expect(r).toHaveLength(1);
    expect(r[0]!.key).toContain("lt15");
  });

  it("alerte renforcée sous 7 jours", () => {
    const r = dueReminders({ ...base, remaining: 6 });
    expect(r).toHaveLength(1);
    expect(r[0]!.key).toContain("lt7");
  });

  it("alerte 3 jours avant la date limite de sortie", () => {
    expect(
      dueReminders({ today: "2026-08-27", remaining: 40, mustLeaveBy: "2026-08-30" }),
    ).toHaveLength(1);
    expect(
      dueReminders({ today: "2026-08-27", remaining: 40, mustLeaveBy: "2026-08-31" }),
    ).toHaveLength(0);
    // Le jour même compte encore.
    expect(
      dueReminders({ today: "2026-08-27", remaining: 40, mustLeaveBy: "2026-08-27" }),
    ).toHaveLength(1);
    // Une limite déjà dépassée ne redéclenche pas ce rappel.
    expect(
      dueReminders({ today: "2026-08-27", remaining: 40, mustLeaveBy: "2026-08-26" }),
    ).toHaveLength(0);
  });

  it("les clés changent chaque jour pour ne pas spammer", () => {
    const a = dueReminders({ ...base, remaining: 5 })[0]!;
    const b = dueReminders({ ...base, today: "2026-08-28", remaining: 5 })[0]!;
    expect(a.key).not.toBe(b.key);
  });
});
