export type LanguageModality = "signed" | "spoken_written";

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
