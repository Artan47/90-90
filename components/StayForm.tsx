"use client";

import { useState } from "react";
import type { Stay } from "@/lib/types";
import { Button, DateInput, Field, Select, TextInput, Toggle } from "@/components/ui";
import { countriesForPicker } from "@/lib/schengen-membership";
import { isIsoDate, isBefore } from "@/lib/date";
import { t } from "@/lib/i18n";

export type StayDraft = Omit<Stay, "id">;

/**
 * Formulaire de saisie d'un séjour. La règle D est appliquée ici : une sortie
 * antérieure à l'entrée est refusée à l'enregistrement, pas seulement
 * signalée après coup.
 */
export function StayForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Stay;
  onSave: (draft: StayDraft) => void;
  onCancel: () => void;
}) {
  const [entry, setEntry] = useState(initial?.entry ?? "");
  const [exit, setExit] = useState(initial?.exit ?? "");
  const [country, setCountry] = useState(initial?.country ?? "DE");
  const [note, setNote] = useState(initial?.note ?? "");
  const [exempt, setExempt] = useState(Boolean(initial?.exempt));
  const [error, setError] = useState<string | null>(null);

  const countries = countriesForPicker();

  function submit() {
    if (!isIsoDate(entry)) {
      setError(t.stays.entry + " ⚠️");
      return;
    }
    if (exit !== "" && !isIsoDate(exit)) {
      setError(t.stays.exit + " ⚠️");
      return;
    }
    if (exit !== "" && isBefore(exit, entry)) {
      // TEST D : enregistrement refusé.
      setError(t.issues.EXIT_BEFORE_ENTRY);
      return;
    }
    const draft: StayDraft = {
      entry,
      exit: exit === "" ? null : exit,
      country,
    };
    if (note.trim()) draft.note = note.trim();
    if (exempt) draft.exempt = true;
    if (initial?.planned) draft.planned = true;
    onSave(draft);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.stays.entry} htmlFor="entry">
          <DateInput id="entry" value={entry} onChange={setEntry} />
        </Field>
        <Field label={t.stays.exit} hint={t.stays.stillInside} htmlFor="exit">
          <DateInput id="exit" value={exit} onChange={setExit} min={entry || undefined} />
        </Field>
      </div>

      <Field label={t.stays.country} htmlFor="country">
        <Select id="country" value={country} onChange={setCountry}>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
              {c.since === null ? " — " + t.stays.badgeNotSchengen : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label={t.stays.note} htmlFor="note">
        <TextInput
          id="note"
          value={note}
          onChange={setNote}
          placeholder={t.stays.notePlaceholder}
        />
      </Field>

      <Toggle checked={exempt} onChange={setExempt} label={t.stays.exemptLabel} />
      <p className="text-xs muted">{t.stays.exemptHelp}</p>

      {error ? (
        <p className="rounded-xl bg-[var(--color-bad-soft)] px-3 py-2 text-sm font-medium text-[#7f1d1d]">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3">
        <Button onClick={submit} className="flex-1">
          {t.stays.save}
        </Button>
        <Button onClick={onCancel} variant="ghost" className="flex-1">
          {t.stays.cancel}
        </Button>
      </div>
    </div>
  );
}
