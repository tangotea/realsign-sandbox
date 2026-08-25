export const PROVIDER_ROLES = [
  { value: "deaf_tutor", label: "Teach SASL", icon: "🤟", description: "For Deaf SASL tutors." },
  { value: "interpreter", label: "Interpret SASL", icon: "👐", description: "For approved SASL interpreters." },
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
