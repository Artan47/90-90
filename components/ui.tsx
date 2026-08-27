"use client";

import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface rounded-2xl p-4 ${className}`}>{children}</section>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-2xl font-bold tracking-tight">{children}</h1>;
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs muted">{hint}</span> : null}
    </label>
  );
}

const INPUT =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 outline-none focus:border-[var(--text-muted)]";

export function DateInput({
  value,
  onChange,
  id,
  max,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  max?: string;
  min?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      value={value}
      max={max}
      min={min}
      onChange={(e) => onChange(e.target.value)}
      className={`${INPUT} tnum`}
    />
  );
}

export function TextInput({
  value,
  onChange,
  id,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
    />
  );
}

export function Select({
  value,
  onChange,
  id,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  children: ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={INPUT}
    >
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-left"
    >
      <span className="text-sm font-medium">{label}</span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[var(--color-ok)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const styles = {
    primary: "bg-[var(--text)] text-[var(--bg)]",
    ghost: "surface",
    danger: "bg-[var(--color-bad)] text-white",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-4 py-3 font-semibold transition-opacity active:opacity-70 disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-[var(--border)] muted",
    ok: "border-transparent bg-[var(--color-ok-soft)] text-[#14532d]",
    warn: "border-transparent bg-[var(--color-warn-soft)] text-[#7c2d12]",
    bad: "border-transparent bg-[var(--color-bad-soft)] text-[#7f1d1d]",
  }[tone];

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones}`}>
      {children}
    </span>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="pop fixed bottom-24 left-1/2 z-30 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl bg-[var(--text)] px-4 py-3 text-center text-sm font-medium text-[var(--bg)] shadow-lg"
    >
      {message}
    </div>
  );
}
