import { bookingRoleText, related } from "./bookingRole";

export async function bookingNotificationRole(client: any, bookingId: string | null, userId: string) {
  if (!bookingId) return "";
  const { data, error } = await client.from("bookings").select("learner_user_id,provider_services(provider_role),provider_profiles(user_id)").eq("id", bookingId).maybeSingle();
  if (error) throw error;
  if (!data) return "";
  const customer = data.learner_user_id === userId;
  const provider = related<any>(data.provider_profiles)?.user_id === userId;
  if (!customer && !provider) return "";
  return bookingRoleText(related<any>(data.provider_services)?.provider_role, provider && !customer);
}
