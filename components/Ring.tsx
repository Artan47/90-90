"use client";

/** Anneau de progression X / 90, avec le très grand chiffre au centre. */
export function Ring({
  used,
  max,
  color,
  children,
}: {
  used: number;
  max: number;
  color: string;
  children: React.ReactNode;
}) {
  const R = 88;
  const C = 2 * Math.PI * R;
  const ratio = Math.min(1, Math.max(0, used / max));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle
          cx="100" cy="100" r={R}
          fill="none" strokeWidth="14" className="ring-track"
        />
        <circle
          cx="100" cy="100" r={R}
          fill="none" strokeWidth="14" strokeLinecap="round"
          stroke={color}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - ratio)}
          style={{ transition: "stroke-dashoffset 400ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}
