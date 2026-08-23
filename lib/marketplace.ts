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
  if (role === "deaf tutor" || role === "deaf_tutor") return "SA Sign Language Tutor";
  if (role === "qualified deaf teacher" || role === "qualified_deaf_teacher") return "🎓 SASL Provider";
  if (role === "interpreter") return "SA Sign Language Interpreter";
  return role.replaceAll("_", " ");
}

type ServiceLike = { title?: string | null; provider_role?: string | null } | string | null | undefined;

function serviceRole(service: ServiceLike) {
  if (typeof service === "string") return service;
  return service?.provider_role || "";
}

function legacySchoolTitle(title?: string | null) {
  if (!title) return true;
  return /\bgrade\s*\d+\b/i.test(title) || /\b(mathematics|school|subject|homework)\b/i.test(title);
}

export function serviceLabel(service: ServiceLike) {
  const role = serviceRole(service);
  if (role === "deaf tutor" || role === "deaf_tutor") return "Sign Language Lesson";
  if (role === "interpreter") return "Video Call SASL Interpreting";
  if (typeof service !== "string" && service?.title) return service.title;
  return role ? role.replaceAll("_", " ") : "RealSign Service";
}

export function serviceDetailLabel(service: ServiceLike) {
  if (typeof service === "string" || !service?.title || legacySchoolTitle(service.title)) return "";
  if (service.title === serviceLabel(service)) return "";
  return service.title;
}

export function languageLabel(name: string, role?: string | null) {
  const normal = name.toLowerCase().replace("south african sign language", "sasl");
  if (role === "interpreter") {
    if (normal === "sasl") return "SASL";
    if (normal.includes("english")) return "SASL & English";
    if (normal.includes("afrikaans")) return "SASL & Afrikaans";
    if (normal.includes("isindebele")) return "SASL & isiNdebele";
    if (normal.includes("isixhosa")) return "SASL & isiXhosa";
    if (normal.includes("isizulu")) return "SASL & isiZulu";
    if (normal.includes("sepedi")) return "SASL & Sepedi";
    if (normal.includes("sesotho")) return "SASL & Sesotho";
    if (normal.includes("setswana")) return "SASL & Setswana";
    if (normal.includes("siswati")) return "SASL & siSwati";
    if (normal.includes("tshivenda")) return "SASL & Tshivenda";
    if (normal.includes("xitsonga") || normal.includes("itsonga")) return "SASL & Xitsonga";
    if (normal.startsWith("sasl")) return name;
    return `SASL & ${name}`;
  }
  if (normal === "sasl") return "South African Sign Language (SASL)";
  if (normal.includes("english")) return "SASL (Tutor can type in English)";
  if (normal.includes("afrikaans")) return "SASL (Tutor kan in Afrikaans tik)";
  if (normal.includes("isindebele")) return "SASL (Umfundisi angathayipha ngesiNdebele)";
  if (normal.includes("isixhosa")) return "SASL (Umhlohli angachwetheza ngesiXhosa)";
  if (normal.includes("isizulu")) return "SASL (Umfundisi angathayipha ngesiZulu)";
  if (normal.includes("sepedi")) return "SASL (Morutisi a ka thaepa ka Sepedi)";
  if (normal.includes("sesotho")) return "SASL (Morupeli a ka thaepa ka Sesotho)";
  if (normal.includes("setswana")) return "SASL (Morutabana a ka tlanya ka Setswana)";
  if (normal.includes("siswati")) return "SASL (Thishela angathayipha ngeSiSwati)";
  if (normal.includes("tshivenda")) return "SASL (Mudededzi a nga thaipha nga Tshivenda)";
  if (normal.includes("xitsonga") || normal.includes("itsonga")) return "SASL (Mudyondzisi a nga thayipa hi Xitsonga)";
  if (normal.startsWith("sasl")) return name;
  return `SASL (Tutor can type in ${name})`;
}
