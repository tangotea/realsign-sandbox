import { bookingRoleText, related } from "./bookingRole";
import { formatBookingTime, validTimeZone } from "./bookingTime";

export async function bookingNotificationRole(client: any, bookingId: string | null, userId: string) {
  if (!bookingId) return "";
  const { data, error } = await client.from("bookings").select("learner_user_id,provider_id,start_at,provider_services(provider_role),provider_profiles(user_id)").eq("id", bookingId).maybeSingle();
  if (error) throw error;
  if (!data) return "";
  const customer = data.learner_user_id === userId;
  const provider = related<any>(data.provider_profiles)?.user_id === userId;
  if (!customer && !provider) return "";
  const { data: settings } = await client.from("provider_booking_settings").select("timezone").eq("provider_id", data.provider_id).maybeSingle();
  const { data: recipient } = await client.auth.admin.getUserById(userId);
  const providerZone = validTimeZone(settings?.timezone);
  const savedZone = recipient?.user?.user_metadata?.booking_timezone;
  const local = savedZone ? ` Your time: ${formatBookingTime(data.start_at, savedZone)} (${validTimeZone(savedZone)}).` : "";
  return `${bookingRoleText(related<any>(data.provider_services)?.provider_role, provider && !customer)}${local} Provider's time: ${formatBookingTime(data.start_at, providerZone)} (${providerZone}).`;
}
