"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/components/Store";
import { Button, Card, DateInput, Field, PageTitle, Select, Toast } from "@/components/ui";
import {
  maxStayFrom, simulate, remainingOn, earliestReentry, suggestEntryFor,
  currentStay,
} from "@/lib/schengen";
import { countriesForPicker } from "@/lib/schengen-membership";
import { formatDate, isIsoDate, isBefore, inclusiveDays } from "@/lib/date";

type Mode = "enter" | "range" | "want";

export default function PlanPage() {
  const { stays, today, addStay, ready, t, fmt } = useStore();
  const [mode, setMode] = useState<Mode>("enter");
  const [entry, setEntry] = useState(today);
  const [exit, setExit] = useState("");
  const [wanted, setWanted] = useState(30);
  const [country, setCountry] = useState("DE");
  const [toast, setToast] = useState<string | null>(null);

  // Si un séjour est en cours, toutes les projections supposent qu'on sort
  // à la date de référence. L'hypothèse doit être visible, pas implicite.
  const open = useMemo(() => currentStay(stays, today), [stays, today]);

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

  // « Je veux rester N jours » : première date d'entrée qui le permet.
  const suggestion = useMemo(
    () => (mode === "want" && isIsoDate(entry) ? suggestEntryFor(stays, entry, wanted) : null),
    [mode, stays, entry, wanted],
  );

  // Si le séjour demandé déborde, on propose la première date qui tiendrait
  // la MÊME durée — c'est la question que se pose vraiment le voyageur.
  const rescue = useMemo(() => {
    if (mode !== "range" || !verdict || verdict.result.ok) return null;
    return suggestEntryFor(stays, entry, verdict.days);
  }, [mode, verdict, stays, entry]);

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

      <div className="grid grid-cols-3 gap-2">
        {(["enter", "range", "want"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`rounded-xl px-2 py-3 text-xs font-semibold transition-colors ${
              mode === m
                ? "bg-[var(--text)] text-[var(--bg)]"
                : "surface"
            }`}
          >
            {m === "enter" ? t.plan.modeEnter : m === "range" ? t.plan.modeRange : t.plan.modeWant}
          </button>
        ))}
      </div>

      {open ? (
        <Card className="border-[var(--color-warn)] bg-[var(--color-warn-soft)] text-[#7c2d12]">
          <p className="text-sm font-medium">
            ⚠️ {fmt(t.plan.openStayNote, { date: formatDate(today) })}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <Field label={t.plan.entryDate} htmlFor="p-entry">
          <DateInput id="p-entry" value={entry} onChange={setEntry} />
        </Field>
        {mode === "want" ? (
          <Field label={t.plan.wantedDays} htmlFor="p-wanted">
            <div className="flex items-center gap-3">
              <input
                id="p-wanted"
                type="range"
                min={1}
                max={90}
                value={wanted}
                onChange={(e) => setWanted(Number(e.target.value))}
                className="h-2 flex-1 accent-[var(--text)]"
              />
              <span className="tnum w-14 text-right text-xl font-black">{wanted}</span>
            </div>
          </Field>
        ) : null}
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
              {fmt(t.plan.resultMaxDays, {
                n: maxStay.days,
                nights: maxStay.nights,
              })}
            </p>
            <p className="mt-3 text-xs muted">
              {fmt(t.plan.remainingAfter, {
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
              {fmt(t.plan.resultTryAfter, {
                date: formatDate(earliestReentry(stays, entry)),
              })}
            </p>
          </Card>
        )
      ) : null}

      {mode === "want" && suggestion ? (
        suggestion.entry ? (
          <Card className="border-[var(--color-ok)]">
            <p className="text-sm font-medium muted">
              {fmt(t.plan.wantTitle, { n: suggestion.wanted })}
            </p>
            <p className="tnum mt-1 text-3xl font-black">
              {formatDate(suggestion.entry)}
            </p>
            <p className="tnum mt-1 font-semibold">
              → {formatDate(suggestion.exit!)}
            </p>
            <p className="tnum mt-3 text-sm">
              {suggestion.immediate
                ? fmt(t.plan.wantImmediate, { n: suggestion.wanted })
                : fmt(t.plan.wantWait, {
                    wait: suggestion.waitDays,
                    date: formatDate(suggestion.entry),
                    exit: formatDate(suggestion.exit!),
                  })}
            </p>
            {!suggestion.immediate ? (
              <p className="tnum mt-2 text-xs muted">
                {fmt(t.plan.wantMaxNow, {
                  date: formatDate(entry),
                  n: suggestion.maxFromNow,
                })}
              </p>
            ) : null}
            <Button
              variant="ghost"
              className="mt-3 w-full"
              onClick={() => {
                setEntry(suggestion.entry!);
                setExit(suggestion.exit!);
                setMode("range");
              }}
            >
              {t.plan.useSuggestion}
            </Button>
          </Card>
        ) : (
          <Card className="border-[var(--color-bad)]">
            <p className="font-bold text-[var(--color-bad)]">
              {fmt(t.plan.wantNone, { n: suggestion.wanted })}
            </p>
          </Card>
        )
      ) : null}

      {mode === "range" && verdict ? (
        verdict.result.ok ? (
          <Card className="border-[var(--color-ok)] bg-[var(--color-ok-soft)] text-[#14532d]">
            <p className="text-lg font-black">✅ {t.plan.verdictOk}</p>
            <p className="tnum mt-1 font-medium">
              {fmt(t.plan.verdictOkDetail, { n: verdict.days })}
            </p>
          </Card>
        ) : (
          <Card className="border-[var(--color-bad)] bg-[var(--color-bad-soft)] text-[#7f1d1d]">
            <p className="text-lg font-black">⛔ {t.plan.verdictBad}</p>
            <p className="tnum mt-1 font-medium">
              {fmt(t.plan.verdictBadDetail, {
                date: formatDate(verdict.result.firstOverflowDate ?? ""),
                n: verdict.result.daysOver ?? 0,
              })}
            </p>
            <p className="tnum mt-2 text-sm">
              {fmt(t.plan.verdictShorten, { n: verdict.result.daysOver ?? 0 })}
            </p>
          </Card>
        )
      ) : null}

      {rescue && rescue.entry ? (
        <Card className="border-[var(--color-ok)]">
          <p className="text-sm font-semibold">💡 {t.plan.suggestTitle}</p>
          <p className="tnum mt-1 text-sm">
            {fmt(t.plan.suggestBody, {
              wanted: formatDate(entry),
              date: formatDate(rescue.entry),
              n: rescue.wanted,
            })}
          </p>
          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              setEntry(rescue.entry!);
              setExit(rescue.exit!);
            }}
          >
            {t.plan.useSuggestion}
          </Button>
        </Card>
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
