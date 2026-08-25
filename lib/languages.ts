export type LanguageModality = "signed" | "spoken_written";
export type LanguageDisplayMode = "tutor" | "interpreter";

export const OFFICIAL_LANGUAGES = [
  { code: "sasl", label: "South African Sign Language (SASL)", modality: "signed" as LanguageModality },
  { code: "en", label: "I can type in English", modality: "spoken_written" as LanguageModality },
  { code: "af", label: "I can type in Afrikaans", modality: "spoken_written" as LanguageModality },
  { code: "nr", label: "I can type in isiNdebele", modality: "spoken_written" as LanguageModality },
  { code: "xh", label: "I can type in isiXhosa", modality: "spoken_written" as LanguageModality },
  { code: "zu", label: "I can type in isiZulu", modality: "spoken_written" as LanguageModality },
  { code: "nso", label: "I can type in Sepedi", modality: "spoken_written" as LanguageModality },
  { code: "st", label: "I can type in Sesotho", modality: "spoken_written" as LanguageModality },
  { code: "tn", label: "I can type in Setswana", modality: "spoken_written" as LanguageModality },
  { code: "ss", label: "I can type in siSwati", modality: "spoken_written" as LanguageModality },
  { code: "ve", label: "I can type in Tshivenda", modality: "spoken_written" as LanguageModality },
  { code: "ts", label: "I can type in Xitsonga", modality: "spoken_written" as LanguageModality }
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
  return language?.label || code;
}

export function officialLanguageOptions(mode: LanguageDisplayMode) {
  return OFFICIAL_LANGUAGES.filter(language => mode === "tutor" || language.modality === "spoken_written");
}
