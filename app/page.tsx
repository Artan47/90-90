"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { Ring } from "@/components/Ring";
import { Button, Card, Toast } from "@/components/ui";
import { toneFor, TONE_HEX, TONE_TEXT } from "@/components/status-color";
import { statusOn, MAX_DAYS, currentStay } from "@/lib/schengen";
import { formatDate, diffDays, todayIso } from "@/lib/date";
import { runReminders } from "@/lib/notifications";
import { InstallPrompt } from "@/components/InstallPrompt";

export default function HomePage() {
  const { stays, today, ready, addStay, updateStay, t, fmt, locale } = useStore();
  const [toast, setToast] = useState<string | null>(null);

  const status = useMemo(() => statusOn(stays, today), [stays, today]);
  const open = useMemo(() => currentStay(stays, today), [stays, today]);

  // Rappels locaux : évalués à l'ouverture, envoyés au plus une fois par
  // jour et par seuil. Rien ne sort de l'appareil.
  useEffect(() => {
    if (!ready) return;
    runReminders({
      today,
      remaining: status.remaining,
      mustLeaveBy: status.mustLeaveBy,
      locale,
    });
  }, [ready, today, status.remaining, status.mustLeaveBy, locale]);

  const overstay = status.issues.find((i) => i.code === "OVER_90");
  const tone = toneFor(status.remaining, status.compliant);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }

  function enterToday() {
    if (open) {
      flash(t.home.alreadyInside);
      return;
    }
    // Le pays est modifiable ensuite : à l'aéroport, on veut un seul geste.
    addStay({ entry: todayIso(), exit: null, country: "DE" });
    flash(t.home.entryRecorded);
  }

  function exitToday() {
    if (!open) {
      flash(t.home.noOpenStay);
      return;
    }
    updateStay(open.id, { exit: todayIso() });
    flash(t.home.exitRecorded);
  }

  if (!ready) {
    return <div className="h-64 animate-pulse rounded-2xl bg-[var(--surface)]" />;
  }

  const daysInsideLeft = status.mustLeaveBy ? diffDays(today, status.mustLeaveBy) : 0;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold tracking-tight">{t.home.title}</h1>
      </header>

      <Card className="pt-5">
        <Ring used={Math.min(status.used, MAX_DAYS)} max={MAX_DAYS} color={TONE_HEX[tone]}>
          <span className={`tnum text-[4rem] font-black leading-none ${TONE_TEXT[tone]}`}>
            {status.remaining}
          </span>
          <span className="mt-0.5 text-xs font-medium muted">
            {fmt(t.home.daysLeft, { n: status.remaining })}
          </span>
        </Ring>

        <div className="mt-3 space-y-0.5 text-center">
          <p className="tnum text-sm font-medium">
            {fmt(t.home.usedOf, { used: status.used })}
          </p>
          <p className="tnum text-xs muted">
            {fmt(t.home.window, {
              from: formatDate(status.windowFrom),
              to: formatDate(status.windowTo),
            })}
          </p>
        </div>
      </Card>

      {overstay ? (
        <Card className="border-[var(--color-bad)] bg-[var(--color-bad-soft)] text-[#7f1d1d]">
          <p className="font-bold">
            ⚠️ {fmt(t.home.overstay, { n: overstay.daysOver ?? 0 })}
          </p>
          <p className="mt-1 text-sm">
            {fmt(t.home.overstayFrom, {
              date: formatDate(overstay.firstOverflowDate ?? ""),
            })}
          </p>
        </Card>
      ) : null}

      {status.inside && status.mustLeaveBy ? (
        <Card className="border-[var(--color-warn)]">
          <p className="text-base font-bold">
            🛫 {fmt(t.home.insideBanner, { date: formatDate(status.mustLeaveBy) })}
          </p>
          <p className="mt-1 text-sm muted">
            {daysInsideLeft <= 0
              ? t.home.insideToday
              : fmt(t.home.insideCountdown, { n: daysInsideLeft })}
          </p>
        </Card>
      ) : (
        <Card>
          {status.maxStay.days > 0 ? (
            <p className="text-sm font-semibold">
              ✅{" "}
              {fmt(t.home.outsideCanEnter, {
                date: formatDate(status.maxStay.lastPossibleExit),
                n: status.maxStay.days,
              })}
            </p>
          ) : (
            <p className="text-sm font-semibold text-[var(--color-bad)]">
              ⛔{" "}
              {fmt(t.home.outsideBlocked, {
                date: formatDate(status.earliestReentry),
              })}
            </p>
          )}
          <p className="mt-1 text-xs muted">
            {fmt(t.home.fullReset, { date: formatDate(status.fullReset) })}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={enterToday} className="py-4 text-sm">
          ⬇︎ {t.home.enteredToday}
        </Button>
        <Button onClick={exitToday} variant="ghost" className="py-4 text-sm">
          ⬆︎ {t.home.exitedToday}
        </Button>
      </div>

      {/* Résumé de l'historique réel */}
      <Card>
        <h2 className="text-sm font-semibold muted">{t.home.summaryTitle}</h2>
        {status.summary.stayCount === 0 ? (
          <>
            <p className="mt-1 text-sm muted">{t.home.emptyState}</p>
            <Link
              href="/stays"
              className="mt-3 inline-block font-semibold underline underline-offset-4"
            >
              {t.home.addFirst} →
            </Link>
          </>
        ) : (
          <>
            <p className="tnum mt-1 font-semibold">
              {fmt(t.home.summaryStays, {
                n: status.summary.stayCount,
                days: status.summary.totalDays,
              })}
            </p>
            <Link
              href="/stays"
              className="mt-2 inline-block text-sm underline underline-offset-4"
            >
              {t.nav.stays} →
            </Link>
          </>
        )}
      </Card>

      {/* Projection : historique réel + TOUS les voyages planifiés */}
      {status.planned.trips.length > 0 ? (
        <Card
          className={
            status.planned.anyOverflow ? "border-[var(--color-bad)]" : "border-[var(--color-ok)]"
          }
        >
          <h2 className="text-sm font-semibold muted">{t.home.plannedTitle}</h2>

          <ul className="tnum mt-2 space-y-1 text-sm">
            {status.planned.trips.map((trip) => (
              <li key={trip.stay.id} className="flex items-start gap-2">
                <span aria-hidden>{trip.ok ? "✅" : "⛔"}</span>
                <span className={trip.ok ? "" : "font-semibold text-[var(--color-bad)]"}>
                  {fmt(t.home.plannedTrip, {
                    from: formatDate(trip.entry),
                    to: formatDate(trip.exit),
                    n: trip.days,
                  })}
                </span>
              </li>
            ))}
          </ul>

          {status.planned.anyOverflow ? (
            <p className="tnum mt-3 rounded-xl bg-[var(--color-bad-soft)] px-3 py-2 text-sm font-semibold text-[#7f1d1d]">
              {fmt(t.home.plannedBad, {
                date: formatDate(status.planned.firstOverflowDate ?? ""),
                n: status.planned.daysOver,
              })}
            </p>
          ) : (
            <p className="mt-3 text-sm font-medium text-[var(--color-ok)]">
              ✓ {t.home.plannedOk}
            </p>
          )}

          {status.planned.lastExit ? (
            <p className="tnum mt-2 text-sm muted">
              {fmt(t.home.plannedAfter, {
                date: formatDate(status.planned.lastExit),
                n: status.planned.remainingAfter,
              })}
            </p>
          ) : null}
        </Card>
      ) : (
        <Link
          href="/plan"
          className="surface block rounded-2xl p-4 text-center font-semibold underline underline-offset-4"
        >
          ✈ {t.home.goPlan} →
        </Link>
      )}

      <InstallPrompt />

      <Toast message={toast} />
    </div>
  );
}
