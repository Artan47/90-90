"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { Button, Card, DateInput, Field, PageTitle, Select, Toast } from "@/components/ui";
import { maxStayFrom, simulate, remainingOn, earliestReentry } from "@/lib/schengen";
import { countriesForPicker } from "@/lib/schengen-membership";
import { formatDate, isIsoDate, isBefore, inclusiveDays, addDays } from "@/lib/date";
import { t, fill } from "@/lib/i18n";

type Mode = "enter" | "range";

export default function PlanPage() {
  const { stays, today, addStay, ready } = useStore();
  const [mode, setMode] = useState<Mode>("enter");
  const [entry, setEntry] = useState(today);
  const [exit, setExit] = useState("");
  const [country, setCountry] = useState("DE");
  const [toast, setToast] = useState<string | null>(null);

  const maxStay = useMemo(
    () => (isIsoDate(entry) ? maxStayFrom(stays, entry) : null),
    [stays, entry],
  );

  const verdict = useMemo(() => {
    if (mode !== "range") return null;
    if (!isIsoDate(entry) || !isIsoDate(exit)) return null;
    if (isBefore(exit, entry)) return null;
    return {
      result: simulate(stays, { entry, exit }),
      days: inclusiveDays(entry, exit),
    };
  }, [mode, stays, entry, exit]);

  function savePlanned() {
    if (!isIsoDate(entry) || !isIsoDate(exit)) return;
    addStay({ entry, exit, country, planned: true });
    setToast(t.plan.plannedSaved);
    window.setTimeout(() => setToast(null), 2600);
  }

  if (!ready) return null;

  return (
    <div className="space-y-4">
      <PageTitle>{t.plan.title}</PageTitle>

      <div className="grid grid-cols-2 gap-2">
        {(["enter", "range"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-[var(--text)] text-[var(--bg)]"
                : "surface"
            }`}
          >
            {m === "enter" ? t.plan.modeEnter : t.plan.modeRange}
          </button>
        ))}
      </div>

      <Card className="space-y-3">
        <Field label={t.plan.entryDate} htmlFor="p-entry">
          <DateInput id="p-entry" value={entry} onChange={setEntry} />
        </Field>
        {mode === "range" ? (
          <Field label={t.plan.exitDate} htmlFor="p-exit">
            <DateInput
              id="p-exit"
              value={exit}
              onChange={setExit}
              min={entry || undefined}
            />
          </Field>
        ) : null}
      </Card>

      {mode === "enter" && maxStay ? (
        maxStay.days > 0 ? (
          <Card className="border-[var(--color-ok)]">
            <p className="text-sm font-medium muted">{t.plan.resultMaxTitle}</p>
            <p className="tnum mt-1 text-3xl font-black">
              {formatDate(maxStay.lastPossibleExit)}
            </p>
            <p className="tnum mt-1 font-semibold">
              {fill(t.plan.resultMaxDays, {
                n: maxStay.days,
                nights: maxStay.nights,
              })}
            </p>
            <p className="mt-3 text-xs muted">
              {fill(t.plan.remainingAfter, {
                date: formatDate(maxStay.lastPossibleExit),
                n: remainingOn(stays, maxStay.lastPossibleExit),
              })}
            </p>
            {maxStay.days > remainingOn(stays, entry) ? (
              <p className="mt-2 rounded-xl bg-[var(--color-ok-soft)] px-3 py-2 text-xs text-[#14532d]">
                💡 {t.plan.whyMore}
              </p>
            ) : null}
          </Card>
        ) : (
          <Card className="border-[var(--color-bad)]">
            <p className="font-bold text-[var(--color-bad)]">
              {t.plan.resultImpossible}
            </p>
            <p className="mt-1 text-sm muted">
              {fill(t.plan.resultTryAfter, {
                date: formatDate(earliestReentry(stays, entry)),
              })}
            </p>
          </Card>
        )
      ) : null}

      {mode === "range" && verdict ? (
        verdict.result.ok ? (
          <Card className="border-[var(--color-ok)] bg-[var(--color-ok-soft)] text-[#14532d]">
            <p className="text-lg font-black">✅ {t.plan.verdictOk}</p>
            <p className="tnum mt-1 font-medium">
              {fill(t.plan.verdictOkDetail, { n: verdict.days })}
            </p>
          </Card>
        ) : (
          <Card className="border-[var(--color-bad)] bg-[var(--color-bad-soft)] text-[#7f1d1d]">
            <p className="text-lg font-black">⛔ {t.plan.verdictBad}</p>
            <p className="tnum mt-1 font-medium">
              {fill(t.plan.verdictBadDetail, {
                date: formatDate(verdict.result.firstOverflowDate ?? ""),
                n: verdict.result.daysOver ?? 0,
              })}
            </p>
            <p className="tnum mt-2 text-sm">
              {fill(t.plan.verdictShorten, { n: verdict.result.daysOver ?? 0 })}
            </p>
            <p className="tnum mt-1 text-sm">
              {fill(t.plan.resultTryAfter, {
                date: formatDate(
                  addDays(verdict.result.firstOverflowDate ?? entry, -1),
                ),
              })}
            </p>
          </Card>
        )
      ) : null}

      {mode === "range" && isIsoDate(entry) && isIsoDate(exit) && !isBefore(exit, entry) ? (
        <Card className="space-y-3">
          <Field label={t.stays.country} htmlFor="p-country">
            <Select id="p-country" value={country} onChange={setCountry}>
              {countriesForPicker().map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={savePlanned} variant="ghost" className="w-full">
            ✎ {t.plan.savePlanned}
          </Button>
        </Card>
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
