/** Code couleur du compteur : vert ≥ 30, orange 10–29, rouge < 10, dépassement. */
export type Tone = "ok" | "warn" | "bad" | "over";

export function toneFor(remaining: number, compliant: boolean): Tone {
  if (!compliant) return "over";
  if (remaining >= 30) return "ok";
  if (remaining >= 10) return "warn";
  return "bad";
}

export const TONE_HEX: Record<Tone, string> = {
  ok: "#16a34a",
  warn: "#ea580c",
  bad: "#dc2626",
  over: "#7f1d1d",
};

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-[#16a34a]",
  warn: "text-[#ea580c]",
  bad: "text-[#dc2626]",
  over: "text-[#7f1d1d]",
};
