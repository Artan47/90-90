"use client";

import { Card, PageTitle } from "@/components/ui";
import { COUNTRIES, LAST_VERIFIED, SCHENGEN_STATE_COUNT } from "@/lib/schengen-membership";
import { formatDate } from "@/lib/date";
import { t, fill } from "@/lib/i18n";

const EES_URL = "https://travel-europe.europa.eu/ees/check-how-long-you-can-stay";
const CALC_URL =
  "https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/border-crossing/schengen-calculator_en";

export default function AboutPage() {
  const members = COUNTRIES.filter((c) => c.since !== null);
  // On ne montre que les cas contre-intuitifs : ceux que l'on croit à tort
  // dans Schengen. Les pays tiers évidents n'ont pas besoin d'explication.
  const excluded = COUNTRIES.filter((c) => ["CY", "IE", "GB"].includes(c.code));

  return (
    <div className="space-y-4">
      <PageTitle>{t.about.title}</PageTitle>

      <Card>
        <p className="text-sm">{t.about.whatItIs}</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">{t.about.ruleTitle}</h2>
        <p className="text-sm muted">{t.about.ruleBody}</p>
        <p className="text-sm muted">{t.about.ruleEntryExit}</p>
        <p className="text-sm muted">{t.about.ruleCommon}</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">⚠️ {t.about.notCoveredTitle}</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-sm muted">
          {t.about.notCovered.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">{t.about.eesTitle}</h2>
        <p className="text-sm muted">{t.about.eesBody}</p>
        <h2 className="pt-2 font-bold">{t.about.etiasTitle}</h2>
        <p className="text-sm muted">{t.about.etiasBody}</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">{t.about.whyTitle}</h2>
        <p className="text-sm muted">{t.about.whyBody}</p>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-bold">{t.about.sourcesTitle}</h2>
        <div>
          <a
            href={EES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4"
          >
            {t.about.sourceEes} ↗
          </a>
          <p className="text-xs muted">{t.about.sourceEesNote}</p>
        </div>
        <div>
          <a
            href={CALC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-4"
          >
            {t.about.sourceCalculator} ↗
          </a>
          <p className="text-xs muted">{t.about.sourceCalculatorNote}</p>
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">🔒 {t.about.privacyTitle}</h2>
        <p className="text-sm muted">{t.about.privacyBody}</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-bold">
          {t.about.membershipTitle} ({SCHENGEN_STATE_COUNT})
        </h2>
        <p className="text-sm muted">
          {fill(t.about.membershipBody, { date: formatDate(LAST_VERIFIED) })}
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          {members.map((c) => (
            <li key={c.code} className="tnum">
              <span aria-hidden>{c.flag}</span> {c.name}
              {c.since !== "1995-03-26" ? (
                <span className="muted"> ({formatDate(c.since!)})</span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="pt-2 text-sm font-medium">{t.stays.badgeNotSchengen}:</p>
        <ul className="space-y-1 text-sm muted">
          {excluded.map((c) => (
            <li key={c.code}>
              <span aria-hidden>{c.flag}</span> {c.name}
              {c.note ? ` — ${c.note}` : ""}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <p className="text-sm font-medium">⚖️ {t.disclaimer}</p>
      </Card>
    </div>
  );
}
