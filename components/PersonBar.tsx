"use client";

import { useState } from "react";
import { useStore } from "@/components/Store";
import { Button, TextInput } from "@/components/ui";
import { Confirm } from "@/components/Confirm";
import { statusOn } from "@/lib/schengen";

/**
 * Sélecteur de personne, présent sur tous les écrans.
 *
 * Il doit rester visible en permanence : c'est le garde-fou contre
 * l'erreur la plus coûteuse de l'application — saisir les séjours d'une
 * personne dans le compteur d'une autre.
 */
export function PersonBar() {
  const {
    people, person, today, t, fmt,
    selectPerson, addPerson, renamePerson, removePerson,
  } = useStore();

  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);

  function submitAdd() {
    const name = draft.trim();
    if (!name) return;
    addPerson(name);
    setDraft("");
    setAdding(false);
    setOpen(false);
  }

  const toRemove = people.find((p) => p.id === pendingRemove) ?? null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="header-band flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left"
        aria-haspopup="dialog"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-4 shrink-0 rounded-sm"
            style={{ background: "var(--brand)" }}
          />
          <span className="truncate font-semibold">
            {person ? person.name : t.people.addFirst}
          </span>
        </span>
        <span className="shrink-0 text-xs opacity-70">
          {people.length > 1 ? `${people.length} · ` : ""}
          {t.people.switch} ▾
        </span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={t.people.title}
          onClick={() => setOpen(false)}
        >
          <div
            className="pop surface max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-t-2xl p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-lg font-bold">{t.people.title}</p>
            <p className="mt-1 text-xs muted">{t.people.separateQuota}</p>

            {people.length === 0 ? (
              <p className="mt-4 text-sm muted">{t.people.empty}</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {people.map((p) => {
                  const remaining = statusOn(p.stays, today).remaining;
                  const active = person?.id === p.id;
                  return (
                    <li
                      key={p.id}
                      className={`rounded-xl border p-3 ${
                        active ? "border-[var(--text)]" : "border-[var(--border)]"
                      }`}
                    >
                      {renaming === p.id ? (
                        <div className="space-y-2">
                          <TextInput value={draft} onChange={setDraft} />
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 py-2 text-sm"
                              onClick={() => {
                                renamePerson(p.id, draft);
                                setRenaming(null);
                              }}
                            >
                              {t.stays.save}
                            </Button>
                            <Button
                              variant="ghost"
                              className="flex-1 py-2 text-sm"
                              onClick={() => setRenaming(null)}
                            >
                              {t.stays.cancel}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            className="flex w-full items-center justify-between gap-2 text-left"
                            onClick={() => {
                              selectPerson(p.id);
                              setOpen(false);
                            }}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">
                                {active ? "✓ " : ""}
                                {p.name}
                              </span>
                              <span className="tnum block text-xs muted">
                                {fmt(t.people.staysCount, { n: p.stays.length })} ·{" "}
                                {fmt(t.people.remainingShort, { n: remaining })}
                              </span>
                            </span>
                          </button>
                          <div className="mt-2 flex gap-3 text-xs">
                            <button
                              className="underline underline-offset-4"
                              onClick={() => {
                                setDraft(p.name);
                                setRenaming(p.id);
                              }}
                            >
                              {t.people.rename}
                            </button>
                            <button
                              className="text-[var(--color-bad)] underline underline-offset-4"
                              onClick={() => setPendingRemove(p.id)}
                            >
                              {t.people.remove}
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {adding ? (
              <div className="mt-4 space-y-2">
                <TextInput
                  value={draft}
                  onChange={setDraft}
                  placeholder={t.people.namePlaceholder}
                />
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={submitAdd}>
                    {t.stays.save}
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setAdding(false);
                      setDraft("");
                    }}
                  >
                    {t.stays.cancel}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => {
                  setDraft("");
                  setAdding(true);
                }}
              >
                + {t.people.add}
              </Button>
            )}

            <Button variant="ghost" className="mt-2 w-full" onClick={() => setOpen(false)}>
              {t.common.close}
            </Button>
          </div>
        </div>
      ) : null}

      {toRemove ? (
        <Confirm
          title={fmt(t.people.removeTitle, { name: toRemove.name })}
          body={fmt(t.people.removeBody, { name: toRemove.name })}
          onConfirm={() => {
            removePerson(toRemove.id);
            setPendingRemove(null);
          }}
          onCancel={() => setPendingRemove(null)}
        />
      ) : null}
    </>
  );
}
