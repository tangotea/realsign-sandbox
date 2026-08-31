import Link from "next/link";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import { serviceLabel } from "@/lib/marketplace";

function ProviderShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/">←</Link>
        <strong>Provider</strong>
        <button className="help-btn">?</button>
      </header>
      <main className="main">{children}</main>
      <AppNav />
    </div>
  );
}

function ApplicationCard() {
  return (
    <Link href="/provider/application" className="card choice">
      <div className="icon">🤟</div>
      <div>
        <h2>Application & profile</h2>
        <p>Roles, verification, introduction, lessons, interpreting and rates.</p>
      </div>
    </Link>
  );
}

export default async function ProviderPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <ProviderShell>
        <section className="hero">
          <h1>Offer a service</h1>
          <p>Create an account first. You can complete the provider setup after signing in.</p>
        </section>
        <div className="stack">
          <Link href="/sign-in" className="card choice">
            <div className="icon">🤟</div>
            <div>
              <h2>Start provider registration</h2>
              <p>Teach SASL, interpret SASL, or apply for both.</p>
            </div>
          </Link>
        </div>
      </ProviderShell>
    );
  }

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("id,status,public_display_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (provider?.status !== "approved") {
    return (
      <ProviderShell>
        <section className="hero">
          <h1>Teach or interpret</h1>
          <p>Complete your provider application first. More tools appear after approval.</p>
        </section>
        <div className="stack">
          <ApplicationCard />
        </div>
      </ProviderShell>
    );
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id,reference,state,start_at,end_at,learner_first_name,provider_services(title,provider_role)")
    .eq("provider_id", provider.id)
    .in("state", ["confirmed", "in_session"])
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(8);

  return (
    <ProviderShell>
      <section className="hero">
        <h1>Hello {provider.public_display_name || "there"} 👋</h1>
        <p>Your next RealSign bookings are shown first.</p>
      </section>

      {bookings?.length ? (
        <div className="stack">
          {bookings.map((booking: any, index: number) => (
            <section className="card" key={booking.id}>
              <span className="status">{index === 0 ? "Next booking" : booking.state.replaceAll("_", " ")}</span>
              <h2>{new Date(booking.start_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</h2>
              <p>{booking.learner_first_name || "Verified learner"} · {serviceLabel(booking.provider_services as any)}</p>
              <Link className="btn" style={{ marginTop: 12 }} href={`/bookings/${booking.id}`}>View Booking</Link>
            </section>
          ))}
        </div>
      ) : (
        <section className="card">
          <h2>No upcoming bookings</h2>
          <p>Your published availability remains bookable until your chosen booking-notice cut-off.</p>
        </section>
      )}

      <section className="card">
        <h2>Provider settings</h2>
        <p>Manage your provider profile, availability, lesson guides, payouts and earnings from Profile.</p>
        <Link className="btn secondary" href="/profile" style={{ marginTop: 12 }}>Open Profile</Link>
      </section>
    </ProviderShell>
  );
}
