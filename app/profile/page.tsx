import Link from "next/link";
import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import AccountProfile from "@/components/profile/AccountProfile";
import LearnerLanguagePreferences from "@/components/profile/LearnerLanguagePreferences";
import { createClient } from "@/lib/supabase/server";

function ProviderLink({ href, icon, title, description, status }: { href: string; icon: string; title: string; description: string; status?: string }) {
  return <Link href={href} className="card choice"><div className="icon">{icon}</div><div>{status ? <div className="row wrap"><h2>{title}</h2><span className={`status ${status === "approved" ? "approved" : ""}`}>{status === "approved" ? "Approved" : "Draft"}</span></div> : <h2>{title}</h2>}<p>{description}</p></div></Link>;
}

function ProviderTools({ status }: { status: string }) {
  return (
    <section>
      <h2>Provider tools</h2>
      <div className="stack" style={{ marginTop: 12 }}>
        <ProviderLink href="/provider/application" icon="🤟" title="Provider profile & services" description="Manage your provider details, services, rates and booking preferences." status={status} />
        {status === "approved" ? <>
          <ProviderLink href="/provider/guides" icon="📚" title="Lesson guides" description="Browse the lesson topics learners can choose." />
          <ProviderLink href="/provider/availability" icon="📅" title="Availability" description="Set the times learners may book you." />
          <ProviderLink href="/provider/payout" icon="🏦" title="Payout setup" description="Manage the bank account used for provider payouts." />
          <ProviderLink href="/provider/earnings" icon="💰" title="My earnings" description="See pending, available and paid provider earnings." />
        </> : null}
      </div>
    </section>
  );
}

function identityStatusLabel(state: string) {
  switch (state) {
    case "pending": return "Pending review";
    case "approved": return "Approved";
    case "needs_information": return "Needs information";
    case "rejected": return "Not approved";
    default: return "Not submitted";
  }
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    return (
      <div className="shell">
        <main className="main">
          <section className="card">
            <h1>Profile</h1>
            <p>Sign in to manage your RealSign profile.</p>
            <Link className="btn" href="/sign-in" style={{ marginTop: 16 }}>Sign in</Link>
          </section>
        </main>
        <AppNav />
      </div>
    );
  }

  const [{ data: profile }, { data: provider }, { data: identity }] = await Promise.all([
    supabase.from("profiles").select("display_name,first_name,last_name").eq("id", auth.user.id).maybeSingle(),
    supabase.from("provider_profiles").select("id,status").eq("user_id", auth.user.id).maybeSingle(),
    supabase.from("user_identity_verifications").select("state").eq("user_id", auth.user.id).maybeSingle(),
  ]);
  const email = auth.user.email || "";
  const metadata = auth.user.user_metadata || {};
  const displayName = profile?.display_name || metadata.display_name || metadata.first_name || email.split("@")[0] || "";

  return (
    <div className="shell">
      <header className="topbar"><BrandLockup /><strong>Profile</strong></header>
      <main className="main">
        <section className="hero">
          <h1>Your profile</h1>
          <p>Account, lessons, language preferences and help.</p>
        </section>

        <div className="stack">
          <AccountProfile email={email} initialDisplayName={displayName} />
          <LearnerLanguagePreferences initialSpokenLanguage={String(metadata.learner_spoken_language || "en")} initialUsesSasl={Boolean(metadata.learner_uses_sasl ?? true)} />
          {!provider || provider.status !== "approved" ? <Link href="/profile/identity" className="card choice"><div className="icon">ID</div><div><div className="row"><h2>Identity verification</h2><span className="status">{identityStatusLabel(identity?.state || "not_started")}</span></div><p>Verify your identity before booking a lesson or interpreter.</p></div></Link> : null}
          {provider ? <ProviderTools status={provider.status} /> : null}
          <Link href="/bookings" className="card choice"><div className="icon">▣</div><div><h2>Past and future lessons</h2><p>View upcoming and completed bookings.</p></div></Link>
          <Link href="/profile/notifications" className="card choice"><div className="icon">🔔</div><div><h2>Notifications</h2><p>Booking reminders and visual push alerts.</p></div></Link>
          <Link href="/help" className="card choice"><div className="icon">[?]</div><div><h2>Help in SASL</h2><p>Watch help videos and read matching text explanations.</p></div></Link>
        </div>
      </main>
      <AppNav />
    </div>
  );
}
