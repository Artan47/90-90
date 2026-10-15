"use client";

import { useMemo } from "react";
import { useStore } from "@/components/Store";
import { Card, PageTitle } from "@/components/ui";
import { timeline, MAX_DAYS, materializePlanned, countedDays } from "@/lib/schengen";
import { addDays, diffDays, formatDate, formatMonthYear, startOfMonth } from "@/lib/date";

/**
 * Graphique sur 12 mois : 6 mois de passé, 6 mois de projection.
 * Les séjours planifiés sont matérialisés pour que la courbe montre l'effet
 * du voyage prévu ; les bandes du bas rappellent les périodes de présence.
 */
const MONTHS_BACK = 6;
const MONTHS_FORWARD = 6;

export default function TimelinePage() {
  const { stays, today, ready, t, fmt } = useStore();

  const view = useMemo(() => {
    const from = startOfMonth(addDays(today, -MONTHS_BACK * 30));
    const to = addDays(today, MONTHS_FORWARD * 30);
    const projected = materializePlanned(stays);
    const points = timeline(projected, from, to);
    const presence = countedDays(projected, from, to);
    const peak = points.reduce((m, p) => Math.max(m, p.used), 0);
    return { from, to, points, presence, peak };
  }, [stays, today]);

  if (!ready) return null;

  const { from, to, points, presence, peak } = view;
  const W = 720;
  const H = 220;
  const total = points.length;
  const x = (i: number) => (i / Math.max(1, total - 1)) * W;
  // Échelle bornée au-dessus de 90 pour que le dépassement reste visible.
  const scaleMax = Math.max(100, peak + 5);
  const y = (used: number) => H - (used / scaleMax) * H;

  const area =
    `M ${x(0)} ${H} ` +
    points.map((p, i) => `L ${x(i)} ${y(p.used)}`).join(" ") +
    ` L ${x(total - 1)} ${H} Z`;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.used)}`).join(" ");

  const todayIndex = Math.max(0, diffDays(from, today));
  // Un repère par mois, sauf ceux trop proches des bords : ils seraient
  // rognés par le viewBox.
  const monthTicks = points
    .map((p, i) => ({ p, i }))
    .filter(({ p, i }) => p.date.endsWith("-01") && x(i) > 16 && x(i) < W - 16);

  return (
    <div className="space-y-4">
      <PageTitle>{t.timeline.title}</PageTitle>
      <p className="-mt-2 text-sm muted">{t.timeline.subtitle}</p>

      {stays.length === 0 ? (
        <Card>
          <p className="text-sm muted">{t.timeline.noData}</p>
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${W} ${H + 34}`}
              className="h-auto w-full min-w-[320px]"
              role="img"
              aria-label={t.timeline.subtitle}
            >
              {/* Zone de dépassement, au-dessus de la ligne des 90 jours. */}
              <rect
                x="0" y="0" width={W} height={y(MAX_DAYS)}
                fill="#dc2626" opacity="0.05"
              />
              <path d={area} fill="#2563eb" opacity="0.16" />
              <path d={line} fill="none" stroke="#2563eb" strokeWidth="2.5" />

              {/* Limite des 90 jours. */}
              <line
                x1="0" y1={y(MAX_DAYS)} x2={W} y2={y(MAX_DAYS)}
                stroke="#dc2626" strokeWidth="1.5" strokeDasharray="6 4"
              />
              <text x="4" y={y(MAX_DAYS) - 5} fontSize="12" fill="#dc2626">
                {t.timeline.legendLimit}
              </text>

              {/* Aujourd'hui. */}
              <line
                x1={x(todayIndex)} y1="0" x2={x(todayIndex)} y2={H}
                stroke="currentColor" strokeWidth="1.5" opacity="0.55"
              />
              <text
                x={x(todayIndex)} y="12" fontSize="12"
                textAnchor="middle" fill="currentColor"
              >
                {t.timeline.legendToday}
              </text>

              {/* Bandes de présence, sous le graphique. */}
              {points.map((p, i) =>
                presence.has(p.date) ? (
                  <rect
                    key={p.date}
                    x={x(i)}
                    y={H + 4}
                    width={Math.max(1, W / total)}
                    height="10"
                    fill="#2563eb"
                    opacity="0.75"
                  />
                ) : null,
              )}

              {/* Repères mensuels. */}
              {monthTicks.map(({ p, i }) => (
                <g key={p.date}>
                  <line
                    x1={x(i)} y1={H} x2={x(i)} y2={H + 2}
                    stroke="currentColor" opacity="0.3"
                  />
                  <text
                    x={x(i)} y={H + 30} fontSize="11"
                    textAnchor="middle" fill="currentColor" opacity="0.6"
                  >
                    {formatMonthYear(p.date).slice(0, 3)}
                  </text>
                </g>
              ))}
            </svg>

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs muted">
              <span>
                <span className="mr-1 inline-block h-2 w-3 rounded-sm bg-[#2563eb]" />
                {t.timeline.legendUsed}
              </span>
              <span>
                <span className="mr-1 inline-block h-0.5 w-3 bg-[#dc2626] align-middle" />
                {t.timeline.legendLimit}
              </span>
              <span className="tnum">
                {formatDate(from)} – {formatDate(to)}
              </span>
            </div>
          </Card>

          <Card>
            <p className="tnum text-sm font-medium">
              {fmt(t.timeline.peak, { n: peak })}
            </p>
            <p className="mt-1 text-xs muted">{t.plan.whyMore}</p>
          </Card>
        </>
      )}
    </div>
  );
}
