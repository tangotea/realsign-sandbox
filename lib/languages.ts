export type LanguageModality = "signed" | "spoken_written";

export const OFFICIAL_LANGUAGES = [
  { code: "sasl", label: "SASL", modality: "signed" as LanguageModality },
  { code: "en", label: "SASL with written English", modality: "spoken_written" as LanguageModality },
  { code: "af", label: "SASL with written Afrikaans", modality: "spoken_written" as LanguageModality },
  { code: "nr", label: "SASL with written isiNdebele", modality: "spoken_written" as LanguageModality },
  { code: "xh", label: "SASL with written isiXhosa", modality: "spoken_written" as LanguageModality },
  { code: "zu", label: "SASL with written isiZulu", modality: "spoken_written" as LanguageModality },
  { code: "nso", label: "SASL with written Sepedi", modality: "spoken_written" as LanguageModality },
  { code: "st", label: "SASL with written Sesotho", modality: "spoken_written" as LanguageModality },
  { code: "tn", label: "SASL with written Setswana", modality: "spoken_written" as LanguageModality },
  { code: "ss", label: "SASL with written siSwati", modality: "spoken_written" as LanguageModality },
  { code: "ve", label: "SASL with written Tshivenda", modality: "spoken_written" as LanguageModality },
  { code: "ts", label: "SASL with written Xitsonga", modality: "spoken_written" as LanguageModality }
] as const;
