import NavigationCard from "@/components/NavigationCard";
import BookingRole from "@/components/booking/BookingRole";
import { related } from "@/lib/bookingRole";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/server";
import { serviceLabel } from "@/lib/marketplace";
import HelpButton from "@/components/help/HelpButton";
import ModeSwitch from "@/components/ExperienceMode";

function ProviderShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/">←</Link>
        <strong>Provider</strong>
        <span />
      </header>
      <main className="main"><ModeSwitch />{children}</main>
      <AppNav />
    </div>
  );
}

function ApplicationCard() {
  return <NavigationCard href="/provider/application" icon="🤟" title="Application & profile" description="Roles, verification, introduction, lessons, interpreting and rates." />;
}

export default async function ProviderPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <ProviderShell>
        <section className="hero">
          <div className="page-heading">
            <div>
              <h1>Offer a service</h1>
              <p>Create an account first. You can complete the provider setup after signing in.</p>
            </div>
            <HelpButton slug="provider-dashboard" label="Provider dashboard help" size="regular" fallbackText="Use the provider tools to manage your profile, lesson guides, availability, payouts and earnings." />
          </div>
        </section>
        <div className="stack">
          <Link href="/sign-in?next=%2Fprovider%2Fapplication" className="card choice">
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
          <div className="page-heading">
            <div>
              <h1>Teach or interpret</h1>
              <p>Complete your provider application first. More tools appear after approval.</p>
            </div>
            <HelpButton slug="provider-dashboard" label="Provider dashboard help" size="regular" fallbackText="Complete your provider application first. After approval, use the provider tools to manage your profile, lesson guides, availability, payouts and earnings." />
          </div>
        </section>
        <div className="stack">
          <ApplicationCard />
        </div>
      </ProviderShell>
    );
  }

  const [{ data: bookings, error: bookingError }, { count: pendingRequests, error: requestError }] = await Promise.all([supabase
    .from("bookings")
    .select("id,reference,state,start_at,end_at,learner_first_name,provider_services(title,provider_role)")
    .eq("provider_id", provider.id)
    .in("state", ["confirmed", "in_session"])
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(8), supabase.from("interpreter_requests").select("id", { count:"exact", head:true }).eq("provider_id", provider.id).eq("state", "pending")]);

  return (
    <ProviderShell>
      <section className="hero">
        <div className="page-heading">
          <div>
            <h1>Hello {provider.public_display_name || "there"} 👋</h1>
            <p>Your next RealSign bookings are shown first.</p>
          </div>
          <HelpButton slug="provider-dashboard" label="Provider dashboard help" size="regular" fallbackText="Use the provider tools to manage your profile, lesson guides, availability, payouts and earnings." />
        </div>
      </section>

      {requestError ? <p role="alert">Booking requests could not load.</p> : pendingRequests ? <Link className="notice" href="/provider/requests">{pendingRequests} booking request{pendingRequests === 1 ? "" : "s"} awaiting your response</Link> : null}
      {bookingError ? <p role="alert">Upcoming bookings could not load. Please try again.</p> : bookings?.length ? (
        <div className="stack">
          {bookings.map((booking: any, index: number) => (
            <section className="card" key={booking.id}>
              <BookingRole serviceRole={related<any>(booking.provider_services)?.provider_role} providing />
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

      <nav className="workspace-shortcuts" aria-label="Provider tools">
        <Link href="/provider/requests">Booking requests</Link>
        <Link href="/provider/availability">Availability</Link>
        <Link href="/provider/earnings">Earnings</Link>
        <Link href="/provider/application">Profile & services</Link>
        <Link href="/provider/payout">Payout setup</Link>
        <Link href="/provider/guides">Lesson guides</Link>
        <Link href="/dictionary">Dictionary</Link>
        <Link href="/help">Help in SASL</Link>
      </nav>
      <section className="provider-settings">
        <h2>Account settings</h2>
        <Link className="btn secondary" href="/profile" style={{ marginTop: 12 }}>Your profile</Link>
      </section>
    </ProviderShell>
  );
}
