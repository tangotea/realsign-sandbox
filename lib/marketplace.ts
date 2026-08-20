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
  { slug: "r-3", label: "Grade R–3", db: "Foundation" },
  { slug: "4-6", label: "Grade 4–6", db: "Intermediate" },
  { slug: "7-9", label: "Grade 7–9", db: "Senior" },
  { slug: "10-12", label: "Grade 10–12", db: "FET" },
  { slug: "adult", label: "Adult / Other", db: "Adult / Other" },
] as const;

export function money(cents: number) {
  return `R${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

export function roleLabel(role: string) {
  if (role === "deaf tutor" || role === "deaf_tutor") return "🤟 Deaf Tutor";
  if (role === "qualified deaf teacher" || role === "qualified_deaf_teacher") return "🎓 Qualified Deaf Teacher";
  if (role === "interpreter") return "👐 Interpreter";
  return role.replaceAll("_", " ");
}
