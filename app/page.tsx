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
import { fill } from "@/lib/i18n";

export default function HomePage() {
  const { stays, today, ready, addStay, updateStay, t, locale } = useStore();
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

      <Card className="pt-6">
        <Ring used={Math.min(status.used, MAX_DAYS)} max={MAX_DAYS} color={TONE_HEX[tone]}>
          <span className={`tnum text-[5.5rem] font-black leading-none ${TONE_TEXT[tone]}`}>
            {status.remaining}
          </span>
          <span className="mt-1 text-sm font-medium muted">
            {status.remaining === 1 ? t.home.dayLeft : t.home.daysLeft}
          </span>
        </Ring>

        <div className="mt-4 space-y-1 text-center">
          <p className="tnum text-sm font-medium">
            {fill(t.home.usedOf, { used: status.used })}
          </p>
          <p className="tnum text-xs muted">
            {fill(t.home.window, {
              from: formatDate(status.windowFrom),
              to: formatDate(status.windowTo),
            })}
          </p>
          <p className="text-xs muted">{t.home.windowExplain}</p>
        </div>
      </Card>

      {overstay ? (
        <Card className="border-[var(--color-bad)] bg-[var(--color-bad-soft)] text-[#7f1d1d]">
          <p className="font-bold">
            ⚠️ {fill(t.home.overstay, { n: overstay.daysOver ?? 0 })}
          </p>
          <p className="mt-1 text-sm">
            {fill(t.home.overstayFrom, {
              date: formatDate(overstay.firstOverflowDate ?? ""),
            })}
          </p>
        </Card>
      ) : null}

      {status.inside && status.mustLeaveBy ? (
        <Card className="border-[var(--color-warn)]">
          <p className="text-base font-bold">
            🛫 {fill(t.home.insideBanner, { date: formatDate(status.mustLeaveBy) })}
          </p>
          <p className="mt-1 text-sm muted">
            {daysInsideLeft <= 0
              ? t.home.insideToday
              : daysInsideLeft === 1
                ? t.home.insideCountdownOne
                : fill(t.home.insideCountdown, { n: daysInsideLeft })}
          </p>
        </Card>
      ) : (
        <Card>
          {status.maxStay.days > 0 ? (
            <p className="text-base font-semibold">
              ✅{" "}
              {fill(t.home.outsideCanEnter, {
                date: formatDate(status.maxStay.lastPossibleExit),
                n: status.maxStay.days,
              })}
            </p>
          ) : (
            <p className="text-base font-semibold text-[var(--color-bad)]">
              ⛔{" "}
              {fill(t.home.outsideBlocked, {
                date: formatDate(status.earliestReentry),
              })}
            </p>
          )}
          <p className="mt-1 text-sm muted">
            {fill(t.home.fullReset, { date: formatDate(status.fullReset) })}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Button onClick={enterToday} className="py-5 text-base">
          ⬇︎ {t.home.enteredToday}
        </Button>
        <Button onClick={exitToday} variant="ghost" className="py-5 text-base">
          ⬆︎ {t.home.exitedToday}
        </Button>
      </div>

      {stays.length === 0 ? (
        <Card>
          <p className="text-sm muted">{t.home.emptyState}</p>
          <Link
            href="/stays"
            className="mt-3 inline-block font-semibold underline underline-offset-4"
          >
            {t.home.addFirst} →
          </Link>
        </Card>
      ) : null}

      <InstallPrompt />

      <Toast message={toast} />
    </div>
  );
}
