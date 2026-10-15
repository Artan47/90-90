"use client";

import { useState } from "react";
import { useStore, type AuthResult } from "@/components/Store";
import { Button, Card, Field, TextInput } from "@/components/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/crypto";
import { isProtected } from "@/lib/accounts";

/**
 * Écran de connexion.
 *
 * Les comptes sont LOCAUX : il n'y a ni serveur, ni code de vérification,
 * ni récupération de mot de passe. L'interface le dit explicitement plutôt
 * que de laisser croire à un service distant.
 */
export function Auth() {
  const { accounts, t, fmt, signIn, register, openAccount, createOpenAccount } = useStore();

  const hasProtected = accounts.some(isProtected);
  const openOnes = accounts.filter((a) => !isProtected(a));

  const [mode, setMode] = useState<"signin" | "register">(
    hasProtected ? "signin" : "register",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function explain(result: AuthResult): string | null {
    switch (result) {
      case "ok": return null;
      case "unknown-email": return t.auth.errUnknownEmail;
      case "wrong-password": return t.auth.errWrongPassword;
      case "email-taken": return t.auth.errEmailTaken;
      case "invalid": return fmt(t.auth.errInvalid, { n: MIN_PASSWORD_LENGTH });
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result =
      mode === "signin"
        ? await signIn(email, password)
        : await register(name, email, password);
    setBusy(false);
    const message = explain(result);
    if (message) setError(message);
    else {
      setPassword("");
      setError(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <h1 className="text-xl font-bold">
          {mode === "signin" ? t.auth.signInTitle : t.auth.registerTitle}
        </h1>

        {mode === "register" ? (
          <Field label={t.auth.name} htmlFor="a-name">
            <TextInput
              id="a-name"
              value={name}
              onChange={setName}
              placeholder={t.people.namePlaceholder}
            />
          </Field>
        ) : null}

        <Field label={t.auth.email} htmlFor="a-email">
          <input
            id="a-email"
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--text-muted)]"
          />
        </Field>

        <Field label={t.auth.password} htmlFor="a-password">
          <input
            id="a-password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--text-muted)]"
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-[var(--color-bad-soft)] px-3 py-2 text-sm font-medium text-[#7f1d1d]"
          >
            {error}
          </p>
        ) : null}

        <Button onClick={() => void submit()} disabled={busy} className="w-full">
          {mode === "signin" ? t.auth.signIn : t.auth.register}
        </Button>

        <button
          type="button"
          className="w-full text-sm underline underline-offset-4 muted"
          onClick={() => {
            setMode(mode === "signin" ? "register" : "signin");
            setError(null);
          }}
        >
          {mode === "signin" ? t.auth.toRegister : t.auth.toSignIn}
        </button>
      </Card>

      {openOnes.length > 0 ? (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold">{t.auth.openAccounts}</h2>
          <p className="text-xs muted">{t.auth.openAccountHint}</p>
          <ul className="space-y-2 pt-1">
            {openOnes.map((a) => (
              <li key={a.id}>
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => openAccount(a.id)}
                >
                  {fmt(t.auth.continueAs, { name: a.name })}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {accounts.length === 0 ? (
        <Card>
          <Button
            variant="ghost"
            className="w-full text-sm"
            onClick={() => createOpenAccount(t.people.defaultName)}
          >
            {t.people.addFirst}
          </Button>
        </Card>
      ) : null}

      <Card className="space-y-2">
        <p className="text-xs muted">🔒 {t.auth.localOnly}</p>
        <p className="text-xs muted">⚠️ {t.auth.noRecovery}</p>
      </Card>
    </div>
  );
}
