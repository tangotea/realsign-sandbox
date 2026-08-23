export type MarketplaceProvider = {
  provider_id: string;
  public_display_name: string;
  introduction_text: string | null;
  introduction_video_path: string | null;
  roles: string[];
  languages: string[];
  subject_names: string[];
  min_price_cents: number;
  sample_service_id: string;
  sample_service_title: string;
  sample_duration_min: number;
};

export type PublicProvider = {
  id: string;
  display_name: string;
  introduction_text: string | null;
  introduction_video_path: string | null;
  verification_badges: string[];
  roles: { role: string; approved: boolean }[];
  languages: { code: string; name: string; modality: "signed" | "spoken_written" }[];
  subjects: {
    id: string;
    name: string;
    phase: string;
    min_grade: number | null;
    max_grade: number | null;
    homework_help: boolean;
    general_tutoring: boolean;
    exam_preparation: boolean;
    qualification_verified: boolean;
  }[];
  services: {
    id: string;
    title: string;
    provider_role: string;
    subject_id: string | null;
    duration_min: number;
    price_cents: number;
    remote: boolean;
    in_person: boolean;
  }[];
  booking_settings: { booking_notice_min: number; buffer_min: number; timezone: string } | null;
};

export function money(cents: number) {
  return `R${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

export function roleLabel(role: string) {
  if (role === "deaf tutor" || role === "deaf_tutor") return "🤟 SASL Tutor";
  if (role === "qualified deaf teacher" || role === "qualified_deaf_teacher") return "🎓 SASL Provider";
  if (role === "interpreter") return "👐 SASL Interpreter";
  return role.replaceAll("_", " ");
}

export function languageLabel(name: string) {
  const normal = name.toLowerCase().replace("south african sign language", "sasl");
  if (normal === "sasl") return "South African Sign Language (SASL)";
  if (normal.includes("english")) return "SASL (Tutor can type in English)";
  if (normal.includes("afrikaans")) return "SASL (Tutor kan in Afrikaans tik)";
  if (normal.includes("isindebele")) return "SASL (Tutor can type in isiNdebele)";
  if (normal.includes("isixhosa")) return "SASL (Tutor can type in isiXhosa)";
  if (normal.includes("isizulu")) return "SASL (Tutor can type in isiZulu)";
  if (normal.includes("sepedi")) return "SASL (Tutor can type in Sepedi)";
  if (normal.includes("sesotho")) return "SASL (Tutor can type in Sesotho)";
  if (normal.includes("setswana")) return "SASL (Tutor can type in Setswana)";
  if (normal.includes("siswati")) return "SASL (Tutor can type in siSwati)";
  if (normal.includes("tshivenda")) return "SASL (Tutor can type in Tshivenda)";
  if (normal.includes("xitsonga") || normal.includes("itsonga")) return "SASL (Tutor can type in Xitsonga)";
  if (normal.startsWith("sasl")) return name;
  return `SASL (Tutor can type in ${name})`;
}
