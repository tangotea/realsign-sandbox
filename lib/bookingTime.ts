export function validTimeZone(zone?: string | null) {
  try { if (zone) { new Intl.DateTimeFormat("en", { timeZone: zone }).format(); return zone; } } catch {}
  return "Africa/Johannesburg";
}

export function formatBookingTime(instant: string, zone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: validTimeZone(zone), weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(instant));
}
