export type LanguageModality = "signed" | "spoken_written";
export type LanguageDisplayMode = "tutor" | "interpreter";

export const OFFICIAL_LANGUAGES = [
  { code: "sasl", label: "South African Sign Language (SASL)", modality: "signed" as LanguageModality },
  { code: "en", label: "SASL (Tutor can type in English)", modality: "spoken_written" as LanguageModality },
  { code: "af", label: "SASL (Tutor kan in Afrikaans tik)", modality: "spoken_written" as LanguageModality },
  { code: "nr", label: "SASL (Umfundisi angathayipha ngesiNdebele)", modality: "spoken_written" as LanguageModality },
  { code: "xh", label: "SASL (Umhlohli angachwetheza ngesiXhosa)", modality: "spoken_written" as LanguageModality },
  { code: "zu", label: "SASL (Umfundisi angathayipha ngesiZulu)", modality: "spoken_written" as LanguageModality },
  { code: "nso", label: "SASL (Morutisi a ka thaepa ka Sepedi)", modality: "spoken_written" as LanguageModality },
  { code: "st", label: "SASL (Morupeli a ka thaepa ka Sesotho)", modality: "spoken_written" as LanguageModality },
  { code: "tn", label: "SASL (Morutabana a ka tlanya ka Setswana)", modality: "spoken_written" as LanguageModality },
  { code: "ss", label: "SASL (Thishela angathayipha ngeSiSwati)", modality: "spoken_written" as LanguageModality },
  { code: "ve", label: "SASL (Mudededzi a nga thaipha nga Tshivenda)", modality: "spoken_written" as LanguageModality },
  { code: "ts", label: "SASL (Mudyondzisi a nga thayipa hi Xitsonga)", modality: "spoken_written" as LanguageModality }
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
  sasl: "SASL",
  en: "SASL & English",
  af: "SASL & Afrikaans",
  nr: "SASL & isiNdebele",
  xh: "SASL & isiXhosa",
  zu: "SASL & isiZulu",
  nso: "SASL & Sepedi",
  st: "SASL & Sesotho",
  tn: "SASL & Setswana",
  ss: "SASL & siSwati",
  ve: "SASL & Tshivenda",
  ts: "SASL & Xitsonga"
};

export function officialLanguageLabel(code: string, mode: LanguageDisplayMode) {
  const language = OFFICIAL_LANGUAGES.find(item => item.code === code);
  if (mode === "interpreter") return INTERPRETER_LABELS[code] || language?.label || code;
  return language?.label || code;
}
