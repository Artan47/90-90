"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useStore } from "@/components/Store";
import { Button, Card, DateInput, Field, PageTitle, TextInput, Toast } from "@/components/ui";
import { isProtected } from "@/lib/accounts";
import { MIN_PASSWORD_LENGTH } from "@/lib/crypto";
import { Confirm } from "@/components/Confirm";
import { downloadExport, fromImportString } from "@/lib/storage";
import type { AppData } from "@/lib/types";
import { statusOn } from "@/lib/schengen";
import { passportStatus } from "@/lib/passport";
import { formatDate } from "@/lib/date";
import {
  notificationSupport, requestNotifications, runReminders,
  type NotificationSupport,
} from "@/lib/notifications";
import { LOCALE_LABELS, LOCALE_ORDER } from "@/lib/i18n";

/** Compte connecté : nom, état de protection, et mise sous mot de passe. */
function AccountSection() {
  const { account, t, fmt, protectAccount, renameAccount } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (account) setName(account.name);
  }, [account?.id, account?.name]);

  if (!account) return null;
  const locked = isProtected(account);

  return (
    <Card className="space-y-3">
      <h2 className="font-bold">{t.people.title}</h2>

      <Field label={t.auth.name} htmlFor="acc-name">
        <TextInput id="acc-name" value={name} onChange={setName} />
      </Field>
      <Button
        variant="ghost"
        className="w-full"
        disabled={name.trim() === account.name || name.trim() === ""}
        onClick={() => renameAccount(account.id, name)}
      >
        {t.people.rename}
      </Button>

      {locked ? (
        <p className="text-sm text-[var(--color-ok)]">
          🔒 {t.auth.isProtected} — {account.email}
        </p>
      ) : (
        <div className="space-y-2 border-t border-[var(--border)] pt-3">
          <p className="text-sm font-semibold">{t.auth.protectTitle}</p>
          <p className="text-xs muted">{t.auth.protectHint}</p>
          <Field label={t.auth.email} htmlFor="acc-email">
            <TextInput id="acc-email" value={email} onChange={setEmail} />
          </Field>
          <Field label={t.auth.password} htmlFor="acc-pass">
            <input
              id="acc-pass"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none"
            />
          </Field>
          <Button
            className="w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await protectAccount(email, password);
              setBusy(false);
              setPassword("");
              setNote(
                r === "ok"
                  ? t.auth.protected
                  : r === "email-taken"
                    ? t.auth.errEmailTaken
                    : fmt(t.auth.errInvalid, { n: MIN_PASSWORD_LENGTH }),
              );
            }}
          >
            {t.auth.protect}
          </Button>
          <p className="text-xs muted">⚠️ {t.auth.noRecovery}</p>
          {note ? <p className="text-sm font-medium">{note}</p> : null}
        </div>
      )}
    </Card>
  );
}

export default function SettingsPage() {
  const {
    data, stays, today, ready, storageOk, setProfile, replaceAll, clearAll,
    person, profile, t, fmt, locale, setLocale,
  } = useStore();
  const [toast, setToast] = useState<string | null>(null);
  const [notif, setNotif] = useState<NotificationSupport>("default");
  const [pendingClear, setPendingClear] = useState(false);
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  // Brouillon local : les dates ne rejoignent le profil qu'à l'enregistrement,
  // pour que l'utilisateur voie que c'est bien pris en compte.
  const [issuedDraft, setIssuedDraft] = useState("");
  const [expiryDraft, setExpiryDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setNotif(notificationSupport()), []);

  useEffect(() => {
    if (!ready) return;
    setIssuedDraft(profile.passportIssued ?? "");
    setExpiryDraft(profile.passportExpiry ?? "");
  }, [ready, profile.passportIssued, profile.passportExpiry]);

  const status = useMemo(() => statusOn(stays, today), [stays, today]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }

  // Date de sortie de référence pour la règle « 3 mois après la sortie ».
  const plannedExit = status.inside && status.mustLeaveBy
    ? status.mustLeaveBy
    : status.maxStay.days > 0
      ? status.maxStay.lastPossibleExit
      : null;

  const passport = passportStatus(profile, today, plannedExit);
  const dirty =
    issuedDraft !== (profile.passportIssued ?? "") ||
    expiryDraft !== (profile.passportExpiry ?? "");

  function savePassport() {
    setProfile({
      passportIssued: issuedDraft || undefined,
      passportExpiry: expiryDraft || undefined,
    });
    flash(t.settings.passportSaved);
  }

  async function enableNotifications() {
    const result = await requestNotifications();
    setNotif(result);
    if (result === "granted") {
      runReminders({
        today,
        remaining: status.remaining,
        mustLeaveBy: status.mustLeaveBy,
        profile,
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

      <AccountSection />

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
        <h2 className="font-bold">
          {t.settings.passport}
          {person ? <span className="muted"> — {person.name}</span> : null}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.settings.passportIssued} htmlFor="issued">
            <DateInput id="issued" value={issuedDraft} onChange={setIssuedDraft} />
          </Field>
          <Field label={t.settings.passportExpiry} htmlFor="expiry">
            <DateInput id="expiry" value={expiryDraft} onChange={setExpiryDraft} />
          </Field>
        </div>

        <Button onClick={savePassport} disabled={!dirty} className="w-full">
          {t.settings.passportSave}
        </Button>

        <p className="text-xs muted">{t.settings.passportHelp}</p>

        {!passport.hasExpiry ? (
          <p className="text-xs muted">{t.settings.passportNoDates}</p>
        ) : passport.expired ? (
          <p className="rounded-xl bg-[var(--color-bad-soft)] px-3 py-2 text-sm font-medium text-[#7f1d1d]">
            ⛔ {t.settings.passportExpired}
          </p>
        ) : passport.expiringSoon ? (
          <p className="tnum rounded-xl bg-[var(--color-warn-soft)] px-3 py-2 text-sm font-medium text-[#7c2d12]">
            ⚠️ {fmt(t.settings.passportExpiringMonths, {
              date: formatDate(profile.passportExpiry ?? ""),
              n: passport.daysUntilExpiry ?? 0,
            })}
          </p>
        ) : (
          <p className="tnum text-sm text-[var(--color-ok)]">
            ✓ {fmt(t.settings.passportValidUntil, {
              date: formatDate(profile.passportExpiry ?? ""),
              n: passport.daysUntilExpiry ?? 0,
            })}
          </p>
        )}

        {passport.tooOld ? (
          <p className="rounded-xl bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[#7c2d12]">
            ⚠️ {t.settings.passportTooOld}
          </p>
        ) : null}
        {passport.insufficientForExit && plannedExit ? (
          <p className="rounded-xl bg-[var(--color-warn-soft)] px-3 py-2 text-sm text-[#7c2d12]">
            ⚠️ {fmt(t.settings.passportExpiringSoon, { date: formatDate(plannedExit) })}
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
            flash(fmt(t.settings.imported, {
            n: pendingImport.accounts.length,
          }));
            setPendingImport(null);
          }}
          onCancel={() => setPendingImport(null)}
        />
      ) : null}

      <Toast message={toast} />
    </div>
  );
}
