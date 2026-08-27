import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money, serviceLabel } from "@/lib/marketplace";

export default async function Page() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className="shell">
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

  const [{ data: bookings }, { data: requests }, { data: holds }] = await Promise.all([
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
  ]);

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
            <span className="status">Interpreter request · {request.state.replaceAll("_", " ")}</span>
            <h2>{request.provider_profiles?.public_display_name}</h2>
            <p>{serviceLabel(request.provider_services)}<br />{new Date(request.requested_start_at).toLocaleString()} · {request.mode.replace("_", " ")}</p>
            {request.state === "awaiting_payment" && request.replacement_reservation_id ? <Link className="btn secondary" href={`/checkout/${request.replacement_reservation_id}`}>Confirm &amp; pay</Link> : <p className="muted">You will be notified when the interpreter responds.</p>}
          </section>
        ))}

        {(holds || []).map((hold: any) => (
          <section className="card" key={hold.id}>
            <span className="status">Checkout hold</span>
            <h2>{hold.provider_profiles?.public_display_name}</h2>
            <p>{serviceLabel(hold.provider_services)}<br />{new Date(hold.start_at).toLocaleString()} · {money(hold.price_cents_snapshot)}</p>
            <Link className="btn secondary" href={`/checkout/${hold.id}`}>Continue checkout</Link>
          </section>
        ))}

        {(bookings || []).map((booking: any) => (
          <section className="card" key={booking.id}>
            <span className="status">{booking.state.replaceAll("_", " ")}</span>
            <h2>{booking.provider_profiles?.public_display_name}</h2>
            <p>{serviceLabel(booking.provider_services)}<br />{new Date(booking.start_at).toLocaleString()} · {money(booking.price_cents)}</p>
            <small>{booking.reference}</small>
            <div style={{ marginTop: 12 }}><Link className="mini-btn" href={`/bookings/${booking.id}`}>Manage booking</Link></div>
          </section>
        ))}

        {!activeRequests.length && !holds?.length && !bookings?.length ? <section className="card"><p>No bookings yet. Choose a service above to get started.</p></section> : null}
      </main>
      <AppNav />
    </div>
  );
}
