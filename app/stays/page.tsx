"use client";

import { useMemo, useState } from "react";
import { useStore, useT, useFmt } from "@/components/Store";
import { StayForm, type StayDraft } from "@/components/StayForm";
import { Badge, Button, Card, PageTitle } from "@/components/ui";
import { Confirm } from "@/components/Confirm";
import { getCountry, countsEver } from "@/lib/schengen-membership";
import { countedDays, stayDays, validate } from "@/lib/schengen";
import { compareDates, formatDate } from "@/lib/date";
import type { Stay } from "@/lib/types";

export default function StaysPage() {
  const { stays, today, addStay, updateStay, removeStay, ready, t, fmt } = useStore();
  const [editing, setEditing] = useState<Stay | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Stay | null>(null);

  const byDateDesc = (a: Stay, b: Stay) => compareDates(b.entry, a.entry);
  const real = useMemo(
    () => stays.filter((s) => !s.planned).sort(byDateDesc),
    [stays],
  );
  const planned = useMemo(
    () => stays.filter((s) => s.planned).sort(byDateDesc),
    [stays],
  );
  const issues = useMemo(() => validate(stays, today), [stays, today]);
  const totalDays = useMemo(
    () => stays.reduce((n, s) => n + stayDays(s, today), 0),
    [stays, today],
  );

  function save(draft: StayDraft) {
    if (editing) updateStay(editing.id, draft);
    else addStay(draft);
    setEditing(null);
    setAdding(false);
  }

  if (!ready) return null;

  return (
    <div className="space-y-4">
      <PageTitle>{t.stays.title}</PageTitle>

      {adding || editing ? (
        <Card>
          <StayForm
            initial={editing ?? undefined}
            onSave={save}
            onCancel={() => {
              setEditing(null);
              setAdding(false);
            }}
          />
        </Card>
      ) : (
        <Button onClick={() => setAdding(true)} className="w-full">
          + {t.stays.add}
        </Button>
      )}

      {stays.length > 0 ? (
        <p className="tnum text-sm muted">{fmt(t.stays.total, { n: totalDays })}</p>
      ) : null}

      {real.length === 0 && planned.length === 0 ? (
        <Card>
          <p className="text-sm muted">{t.stays.empty}</p>
        </Card>
      ) : null}

      {real.length > 0 ? (
        <>
          <h2 className="pt-1 text-sm font-semibold muted">{t.stays.sectionReal}</h2>
          <ul className="space-y-3">
            {real.map((stay) => (
              <StayRow
                key={stay.id}
                stay={stay}
                today={today}
                issues={issues.filter((i) => i.stayId === stay.id)}
                onEdit={() => setEditing(stay)}
                onDelete={() => setPendingDelete(stay)}
                onMarkExit={() => updateStay(stay.id, { exit: today })}
              />
            ))}
          </ul>
        </>
      ) : null}

      {planned.length > 0 ? (
        <>
          <h2 className="pt-2 text-sm font-semibold muted">{t.stays.sectionPlanned}</h2>
          <ul className="space-y-3">
            {planned.map((stay) => (
              <StayRow
                key={stay.id}
                stay={stay}
                today={today}
                issues={issues.filter((i) => i.stayId === stay.id)}
                onEdit={() => setEditing(stay)}
                onDelete={() => setPendingDelete(stay)}
                onMarkExit={() => updateStay(stay.id, { exit: today })}
              />
            ))}
          </ul>
        </>
      ) : null}

      {pendingDelete ? (
        <Confirm
          title={t.stays.deleteTitle}
          body={fmt(t.stays.deleteBody, {
            from: formatDate(pendingDelete.entry),
            to: pendingDelete.exit ? formatDate(pendingDelete.exit) : "…",
          })}
          onConfirm={() => {
            removeStay(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}

function StayRow({
  stay,
  today,
  issues,
  onEdit,
  onDelete,
  onMarkExit,
}: {
  stay: Stay;
  today: string;
  issues: ReturnType<typeof validate>;
  onEdit: () => void;
  onDelete: () => void;
  onMarkExit: () => void;
}) {
  const t = useT();
  const fmt = useFmt();
  const country = getCountry(stay.country);
  const total = stayDays(stay, today);
  // Jours réellement imputés au quota : diffère du total si le pays n'était
  // pas encore Schengen à ces dates, ou si le séjour est exempt.
  const counted = countedDays([stay], stay.entry, stay.exit ?? today).size;
  const partial = counted > 0 && counted < total;

  return (
    <li className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tnum font-semibold">
            <span aria-hidden className="mr-1.5">{country?.flag ?? "🌍"}</span>
            {formatDate(stay.entry)} →{" "}
            {stay.exit ? formatDate(stay.exit) : t.stays.ongoing}
          </p>
          <p className="mt-0.5 text-sm muted">
            {country?.name ?? stay.country} ·{" "}
            <span className="tnum">
              {fmt(t.stays.days, { n: total })}
            </span>
            {counted !== total ? (
              <span className="tnum"> · {fmt(t.stays.counted, { n: counted })}</span>
            ) : null}
          </p>
          {stay.note ? <p className="mt-1 text-sm muted">“{stay.note}”</p> : null}

          <div className="mt-2 flex flex-wrap gap-1.5">
            {stay.exempt ? <Badge tone="ok">{t.stays.badgeExempt}</Badge> : null}
            {!countsEver(stay.country) ? <Badge>{t.stays.badgeNotSchengen}</Badge> : null}
            {partial ? <Badge tone="warn">{t.stays.badgePartial}</Badge> : null}
            {stay.planned ? <Badge tone="warn">{t.stays.badgePlanned}</Badge> : null}
            {stay.exit === null ? <Badge tone="warn">{t.stays.stillInside}</Badge> : null}
            {issues.map((i) => (
              <Badge key={i.code} tone="bad">
                {t.issues[i.code]}
              </Badge>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 text-sm">
          <button onClick={onEdit} className="underline underline-offset-4">
            {t.stays.edit}
          </button>
          <button
            onClick={onDelete}
            className="text-[var(--color-bad)] underline underline-offset-4"
          >
            {t.stays.delete}
          </button>
        </div>
      </div>

      {stay.exit === null ? (
        <button
          onClick={onMarkExit}
          className="mt-3 w-full rounded-xl border border-[var(--border)] py-2 text-sm font-medium"
        >
          {t.stays.markExit} ({formatDate(today)})
        </button>
      ) : null}
    </li>
  );
}
