export type LanguageModality = "signed" | "spoken_written";

export const OFFICIAL_LANGUAGES = [
  { code: "sasl", label: "SASL", modality: "signed" as LanguageModality },
  { code: "en", label: "English", modality: "spoken_written" as LanguageModality },
  { code: "af", label: "Afrikaans", modality: "spoken_written" as LanguageModality },
  { code: "nr", label: "isiNdebele", modality: "spoken_written" as LanguageModality },
  { code: "xh", label: "isiXhosa", modality: "spoken_written" as LanguageModality },
  { code: "zu", label: "isiZulu", modality: "spoken_written" as LanguageModality },
  { code: "nso", label: "Sepedi", modality: "spoken_written" as LanguageModality },
  { code: "st", label: "Sesotho", modality: "spoken_written" as LanguageModality },
  { code: "tn", label: "Setswana", modality: "spoken_written" as LanguageModality },
  { code: "ss", label: "siSwati", modality: "spoken_written" as LanguageModality },
  { code: "ve", label: "Tshivenda", modality: "spoken_written" as LanguageModality },
  { code: "ts", label: "Xitsonga", modality: "spoken_written" as LanguageModality }
] as const;
