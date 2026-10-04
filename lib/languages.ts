export type LanguageModality = "signed" | "spoken_written";
export type LanguageDisplayMode = "tutor" | "interpreter" | "combined";

export const OFFICIAL_LANGUAGES = [
  { code: "sasl", label: "South African Sign Language (SASL)", modality: "signed" as LanguageModality },
  { code: "en", label: "English (read & write)", modality: "spoken_written" as LanguageModality },
  { code: "af", label: "Afrikaans (lees & skryf)", modality: "spoken_written" as LanguageModality },
  { code: "nr", label: "isiNdebele (ukufunda nokutlola)", modality: "spoken_written" as LanguageModality },
  { code: "xh", label: "isiXhosa (ukufunda nokubhala)", modality: "spoken_written" as LanguageModality },
  { code: "zu", label: "isiZulu (ukufunda nokubhala)", modality: "spoken_written" as LanguageModality },
  { code: "nso", label: "Sepedi (go bala le go ngwala)", modality: "spoken_written" as LanguageModality },
  { code: "st", label: "Sesotho (ho bala le ho ngola)", modality: "spoken_written" as LanguageModality },
  { code: "tn", label: "Setswana (go buisa le go kwala)", modality: "spoken_written" as LanguageModality },
  { code: "ss", label: "siSwati (kufundza nekubhala)", modality: "spoken_written" as LanguageModality },
  { code: "ve", label: "Tshivenda (u vhala na u ṅwala)", modality: "spoken_written" as LanguageModality },
  { code: "ts", label: "Xitsonga (ku hlaya na ku tsala)", modality: "spoken_written" as LanguageModality }
] as const;

export const LEARNER_LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "af", label: "Afrikaans" },
  { code: "nr", label: "isiNdebele" },
  { code: "xh", label: "isiXhosa" },
  { code: "zu", label: "isiZulu" },
  { code: "nso", label: "Sepedi" },
  { code: "st", label: "Sesotho" },
  { code: "tn", label: "Setswana" },
  { code: "ss", label: "siSwati" },
  { code: "ve", label: "Tshivenda" },
  { code: "ts", label: "Xitsonga" }
] as const;

const INTERPRETER_LABELS: Record<string, string> = {
  en: "English",
  af: "Afrikaans",
  nr: "isiNdebele",
  xh: "isiXhosa",
  zu: "isiZulu",
  nso: "Sepedi",
  st: "Sesotho",
  tn: "Setswana",
  ss: "siSwati",
  ve: "Tshivenda",
  ts: "Xitsonga"
};

export function officialLanguageLabel(code: string, mode: LanguageDisplayMode) {
  const language = OFFICIAL_LANGUAGES.find(item => item.code === code);
  if (mode === "interpreter") return INTERPRETER_LABELS[code] || language?.label || code;
  if (mode === "combined" && code !== "sasl") {
    return `${INTERPRETER_LABELS[code] || language?.label || code} (read & write; interpreting)`;
  }
  return language?.label || code;
}

export function officialLanguageOptions(mode: LanguageDisplayMode) {
  return OFFICIAL_LANGUAGES.filter(language => mode !== "interpreter" || language.modality === "spoken_written");
}
