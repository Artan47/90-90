"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { Button, Card, DateInput, Field, PageTitle, Toast } from "@/components/ui";
import { Confirm } from "@/components/Confirm";
import { downloadExport, fromImportString } from "@/lib/storage";
import type { AppData } from "@/lib/types";
import { statusOn } from "@/lib/schengen";
import { addDays, diffDays, formatDate, isIsoDate } from "@/lib/date";
import {
  notificationSupport, requestNotifications, runReminders,
  type NotificationSupport,
} from "@/lib/notifications";
import { LOCALE_LABELS, LOCALE_ORDER } from "@/lib/i18n";

export default function SettingsPage() {
  const {
    data, stays, today, ready, storageOk, setProfile, replaceAll, clearAll,
    t, fmt, locale, setLocale,
  } = useStore();
  const [toast, setToast] = useState<string | null>(null);
  const [notif, setNotif] = useState<NotificationSupport>("default");
  const [pendingClear, setPendingClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setNotif(notificationSupport()), []);

  const status = useMemo(() => statusOn(stays, today), [stays, today]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  // Contrôles du passeport (section 2.5 du cahier des charges).
  const issued = data.profile.passportIssued;
  const expiry = data.profile.passportExpiry;
  const plannedExit = status.inside && status.mustLeaveBy
    ? status.mustLeaveBy
    : status.maxStay.days > 0
      ? status.maxStay.lastPossibleExit
      : null;

  const passportTooOld =
    isIsoDate(issued ?? "") && diffDays(issued!, today) > 3652; // > 10 ans
  const passportExpired = isIsoDate(expiry ?? "") && diffDays(today, expiry!) < 0;
  const passportTooShort =
    !passportExpired &&
    isIsoDate(expiry ?? "") &&
    plannedExit !== null &&
    diffDays(expiry!, addDays(plannedExit, 90)) > 0;

  async function enableNotifications() {
    const result = await requestNotifications();
    setNotif(result);
    if (result === "granted") {
      runReminders({
        today,
        remaining: status.remaining,
        mustLeaveBy: status.mustLeaveBy,
        locale,
      });
    }
  }

  function onImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setPendingImport(fromImportString(String(reader.result)));
      } catch {
        flash(t.settings.importFailed);
      }
    };
    reader.onerror = () => flash(t.settings.importFailed);
    reader.readAsText(file);
  }

  if (!ready) return null;

  return (
    <div className="space-y-4">
      <PageTitle>{t.settings.title}</PageTitle>

      {!storageOk ? (
        <Card className="border-[var(--color-warn)] bg-[var(--color-warn-soft)] text-[#7c2d12]">
          <p className="text-sm font-medium">⚠️ {t.settings.storageWarning}</p>
        </Card>
      ) : null}

      {stays.length >= 3 ? (
        <Card className="border-[var(--color-warn)]">
          <p className="text-sm font-medium">
            💾 {fmt(t.settings.exportReminder, { n: stays.length })}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-2">
        <h2 className="font-bold">{t.common.language}</h2>
        <div className="grid grid-cols-2 gap-2">
          {LOCALE_ORDER.map((code) => (
            <button
              key={code}
              onClick={() => setLocale(code)}
              aria-pressed={locale === code}
              className={`rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                locale === code
                  ? "bg-[var(--text)] text-[var(--bg)]"
                  : "border border-[var(--border)]"
              }`}
            >
              {LOCALE_LABELS[code]}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.passport}</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.settings.passportIssued} htmlFor="issued">
            <DateInput
              id="issued"
              value={issued ?? ""}
              onChange={(v) => setProfile({ passportIssued: v || undefined })}
            />
          </Field>
          <Field label={t.settings.passportExpiry} htmlFor="expiry">
            <DateInput
              id="expiry"
              value={expiry ?? ""}
              onChange={(v) => setProfile({ passportExpiry: v || undefined })}
            />
          </Field>
        </div>
        <p className="text-xs muted">{t.settings.passportHelp}</p>

        {passportTooOld ? (
          <p className="rounded-xl bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[#7c2d12]">
            {t.settings.passportTooOld}
          </p>
        ) : null}
        {passportExpired ? (
          <p className="rounded-xl bg-[var(--color-bad-soft)] px-3 py-2 text-sm text-[#7f1d1d]">
            {t.settings.passportExpired}
          </p>
        ) : null}
        {passportTooShort && plannedExit ? (
          <p className="rounded-xl bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[#7c2d12]">
            {fmt(t.settings.passportExpiringSoon, { date: formatDate(plannedExit) })}
          </p>
        ) : null}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">{t.settings.data}</h2>
        <p className="text-xs muted">{t.settings.exportHint}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => downloadExport(data, `sa-dite-${today}.json`)}
            variant="ghost"
          >
            ⬇︎ {t.settings.export}
          </Button>
          <Button onClick={() => fileRef.current?.click()} variant="ghost">
            ⬆︎ {t.settings.import}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="danger"
          className="w-full"
          onClick={() => setPendingClear(true)}
        >
          {t.settings.clear}
        </Button>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">{t.settings.notifications}</h2>
        <p className="text-xs muted">{t.settings.notificationsHelp}</p>
        {notif === "granted" ? (
          <p className="text-sm font-medium text-[var(--color-ok)]">
            ✓ {t.settings.notificationsOn}
          </p>
        ) : notif === "denied" ? (
          <p className="text-sm muted">{t.settings.notificationsBlocked}</p>
        ) : notif === "unsupported" ? (
          <p className="text-sm muted">{t.settings.notificationsUnsupported}</p>
        ) : (
          <Button onClick={enableNotifications} variant="ghost" className="w-full">
            🔔 {t.settings.notificationsEnable}
          </Button>
        )}
      </Card>

      <Link
        href="/about"
        className="surface block rounded-2xl p-4 font-semibold underline underline-offset-4"
      >
        {t.settings.about} →
      </Link>

      {pendingClear ? (
        <Confirm
          title={t.settings.clear}
          body={t.settings.clearConfirm}
          onConfirm={() => {
            clearAll();
            setPendingClear(false);
            flash(t.settings.cleared);
          }}
          onCancel={() => setPendingClear(false)}
        />
      ) : null}

      {pendingImport ? (
        <Confirm
          title={t.settings.import}
          body={t.settings.importReplace}
          danger={false}
          onConfirm={() => {
            replaceAll(pendingImport);
            flash(fmt(t.settings.imported, { n: pendingImport.stays.length }));
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
