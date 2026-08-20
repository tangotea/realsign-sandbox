export const PROVIDER_ROLES = [
  { value: "deaf_tutor", label: "Deaf Tutor", icon: "🤟", description: "SASL, homework, subjects or informal tutoring." },
  { value: "qualified_deaf_teacher", label: "Qualified Deaf Teacher", icon: "🎓", description: "Teach with a verified teaching qualification." },
  { value: "interpreter", label: "Interpreter", icon: "👐", description: "Remote or in-person SASL interpreting." },
] as const;

export const BOOKING_NOTICE_OPTIONS = [60, 120, 240, 720, 1440] as const;
export const BUFFER_OPTIONS = [15, 20, 30, 45] as const;
export const SESSION_DURATIONS = [30, 45, 60] as const;

export function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes === 60) return "1 hour";
  if (minutes % 60 === 0) return `${minutes / 60} hours`;
  return `${minutes} minutes`;
}
