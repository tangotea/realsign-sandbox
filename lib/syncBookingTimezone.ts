import { createClient } from "@/lib/supabase/client";

let pending: Promise<void> | undefined;
export async function syncBookingTimezone(zone: string) {
  if (pending) return pending;
  pending = saveTimezone(zone);
  try { await pending; } finally { pending = undefined; }
}

async function saveTimezone(zone: string) {
  try {
    const client = createClient();
    const { data } = await client.auth.getUser();
    if (!data.user) return;
    if (data.user.user_metadata?.booking_timezone !== zone) {
      await client.auth.updateUser({ data: { booking_timezone: zone } });
    }
  } catch { /* Time-zone preferences must not prevent viewing a booking. */ }
}
