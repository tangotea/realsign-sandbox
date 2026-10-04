import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import BookingRole from "@/components/booking/BookingRole";
import BookingList from "@/components/booking/BookingList";
import { related } from "@/lib/bookingRole";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money, serviceLabel } from "@/lib/marketplace";

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className="shell">
        <header className="topbar"><BrandLockup /></header>
        <main className="main">
          <section className="card">
            <h1>Bookings</h1>
            <p>Sign in to see your bookings.</p>
            <Link className="btn" href="/sign-in">Sign in</Link>
          </section>
        </main>
        <AppNav />
      </div>
    );
  }

  const [{ data: bookings, error: bookingsError }, { data: requests }, { data: holds }, { data: provider }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id,reference,state,start_at,end_at,price_cents,provider_id,provider_services(title,provider_role),provider_profiles(public_display_name)")
      .eq("learner_user_id", auth.user.id)
      .order("start_at", { ascending: false }),
    supabase
      .from("interpreter_requests")
      .select("id,state,mode,requested_start_at,expires_at,replacement_reservation_id,provider_profiles(public_display_name),provider_services(title,provider_role)")
      .eq("learner_user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("booking_reservations")
      .select("id,state,start_at,expires_at,price_cents_snapshot,provider_services(title,provider_role),provider_profiles(public_display_name)")
      .eq("learner_user_id", auth.user.id)
      .eq("state", "hold")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
    supabase.from("provider_profiles").select("id").eq("user_id", auth.user.id).maybeSingle(),
  ]);

  const { data: providerBookings, error: providerBookingsError } = provider
    ? await supabase.from("bookings").select("id,reference,state,start_at,end_at,price_cents,provider_id,learner_first_name,provider_services(title,provider_role),provider_profiles(public_display_name)").eq("provider_id", provider.id)
    : { data: [], error: null };
  const combined = new Map((bookings || []).map(b => [b.id, { ...b, providing: false }]));
  for (const b of providerBookings || []) if (!combined.has(b.id)) combined.set(b.id, { ...b, providing: true });
  const providerIds = Array.from(new Set(Array.from(combined.values()).map(b => b.provider_id)));
  const { data: timezones } = providerIds.length ? await supabase.from("provider_booking_settings").select("provider_id,timezone").in("provider_id", providerIds) : { data: [] };
  const zones = new Map((timezones || []).map(z => [z.provider_id, z.timezone]));
  const allBookings = Array.from(combined.values()).map(b => ({...b, providerZone: zones.get(b.provider_id)}));
  const activeRequests = (requests || []).filter((request: any) => !["confirmed", "expired", "declined", "cancelled"].includes(request.state));
  const recentTutor = (bookings || []).find((booking: any) => booking.provider_services?.provider_role !== "interpreter");
  const recentInterpreter = (bookings || []).find((booking: any) => booking.provider_services?.provider_role === "interpreter");

  return (
    <div className="shell">
      <header className="topbar">
        <BrandLockup />
        <strong>Bookings</strong>
      </header>
      <main className="main">
        <h1>Bookings</h1>


        <section className="card booking-shortcuts">
          <h2>Book again</h2>
          <p>Start with a recent provider, or choose a service.</p>
          <div className="booking-choices">
            <Link className="btn secondary" href={recentTutor ? `/providers/${recentTutor.provider_id}` : "/learn"}>
              {recentTutor ? `Book ${recentTutor.provider_profiles?.[0]?.public_display_name || "your recent tutor"} again` : "Book a Deaf Tutor"}
            </Link>
            <Link className="btn secondary" href={recentInterpreter ? `/providers/${recentInterpreter.provider_id}` : "/interpreter"}>
              {recentInterpreter ? `Book ${recentInterpreter.provider_profiles?.[0]?.public_display_name || "your recent interpreter"} again` : "Book an Interpreter"}
            </Link>
          </div>
        </section>

        {activeRequests.map((request: any) => (
          <section className="card" key={request.id}>
            <BookingRole serviceRole="interpreter" />
            <span className="status">Interpreter request · {request.state.replaceAll("_", " ")}</span>
            <h2>{request.provider_profiles?.public_display_name}</h2>
            <p>{serviceLabel(request.provider_services)}<br />{new Date(request.requested_start_at).toLocaleString()} · {request.mode.replace("_", " ")}</p>
            {request.state === "awaiting_payment" && request.replacement_reservation_id ? <Link className="btn secondary" href={`/checkout/${request.replacement_reservation_id}`}>Confirm &amp; pay</Link> : <p className="muted">You will be notified when the interpreter responds.</p>}
          </section>
        ))}

        {(holds || []).map((hold: any) => (
          <section className="card" key={hold.id}>
            <BookingRole serviceRole={related<any>(hold.provider_services)?.provider_role} />
            <span className="status">Checkout hold</span>
            <h2>{hold.provider_profiles?.public_display_name}</h2>
            <p>{serviceLabel(hold.provider_services)}<br />{new Date(hold.start_at).toLocaleString()} · {money(hold.price_cents_snapshot)}</p>
            <Link className="btn secondary" href={`/checkout/${hold.id}`}>Continue checkout</Link>
          </section>
        ))}

        {bookingsError || providerBookingsError ? <p role="alert">Some bookings could not load. Please refresh to try again.</p> : null}
        <BookingList bookings={allBookings} now={Date.now()} />

      </main>
      <AppNav />
    </div>
  );
}
