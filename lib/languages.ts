export type LanguageModality = "signed" | "spoken_written";

export const OFFICIAL_LANGUAGES = [
  { code: "sasl", label: "South African Sign Language (SASL)", modality: "signed" as LanguageModality },
  { code: "en", label: "SASL (Tutor can type in English)", modality: "spoken_written" as LanguageModality },
  { code: "af", label: "SASL (Tutor kan in Afrikaans tik)", modality: "spoken_written" as LanguageModality },
  { code: "nr", label: "SASL (Tutor can type in isiNdebele)", modality: "spoken_written" as LanguageModality },
  { code: "xh", label: "SASL (Tutor can type in isiXhosa)", modality: "spoken_written" as LanguageModality },
  { code: "zu", label: "SASL (Tutor can type in isiZulu)", modality: "spoken_written" as LanguageModality },
  { code: "nso", label: "SASL (Tutor can type in Sepedi)", modality: "spoken_written" as LanguageModality },
  { code: "st", label: "SASL (Tutor can type in Sesotho)", modality: "spoken_written" as LanguageModality },
  { code: "tn", label: "SASL (Tutor can type in Setswana)", modality: "spoken_written" as LanguageModality },
  { code: "ss", label: "SASL (Tutor can type in siSwati)", modality: "spoken_written" as LanguageModality },
  { code: "ve", label: "SASL (Tutor can type in Tshivenda)", modality: "spoken_written" as LanguageModality },
  { code: "ts", label: "SASL (Tutor can type in Xitsonga)", modality: "spoken_written" as LanguageModality }
] as const;
