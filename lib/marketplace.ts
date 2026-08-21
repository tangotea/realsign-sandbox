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

export const PHASES = [
  { slug: "grade-10", label: "Grade 10", db: "FET", grade: 10 },
  { slug: "grade-11", label: "Grade 11", db: "FET", grade: 11 },
  { slug: "grade-12", label: "Grade 12", db: "FET", grade: 12 },
] as const;

export function money(cents: number) {
  return `R${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

export function roleLabel(role: string) {
  if (role === "deaf tutor" || role === "deaf_tutor") return "🤟 SASL Tutor";
  if (role === "qualified deaf teacher" || role === "qualified_deaf_teacher") return "🎓 School Teacher";
  if (role === "interpreter") return "👐 SASL Interpreter";
  return role.replaceAll("_", " ");
}

export function languageLabel(name: string) {
  if (name.toLowerCase() === "sasl") return "SASL";
  if (name.toLowerCase().startsWith("sasl")) return name;
  return `SASL with written ${name}`;
}
