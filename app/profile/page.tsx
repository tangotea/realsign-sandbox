import Link from "next/link";
import AppNav from "@/components/AppNav";
import AccountProfile from "@/components/profile/AccountProfile";
import LearnerLanguagePreferences from "@/components/profile/LearnerLanguagePreferences";
import { createClient } from "@/lib/supabase/server";

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

  const { data: profile } = await supabase.from("profiles").select("display_name,first_name,last_name").eq("id", auth.user.id).maybeSingle();
  const email = auth.user.email || "";
  const metadata = auth.user.user_metadata || {};
  const displayName = profile?.display_name || metadata.display_name || metadata.first_name || email.split("@")[0] || "";

  return (
    <div className="shell">
      <header className="topbar"><div className="brand">REALSIGN</div><strong>Profile</strong></header>
      <main className="main">
        <section className="hero">
          <h1>Your profile</h1>
          <p>Account, lessons, language preferences and help.</p>
        </section>

        <div className="stack">
          <AccountProfile email={email} initialDisplayName={displayName} />
          <LearnerLanguagePreferences initialSpokenLanguage={String(metadata.learner_spoken_language || "en")} initialUsesSasl={Boolean(metadata.learner_uses_sasl ?? true)} />
          <Link href="/bookings" className="card choice"><div className="icon">▣</div><div><h2>Past lessons</h2><p>View upcoming and completed bookings.</p></div></Link>
          <Link href="/profile/notifications" className="card choice"><div className="icon">🔔</div><div><h2>Notifications</h2><p>Booking reminders and visual push alerts.</p></div></Link>
          <Link href="/help" className="card choice"><div className="icon">[?]</div><div><h2>Help in SASL</h2><p>Watch help videos and read matching text explanations.</p></div></Link>
        </div>
      </main>
      <AppNav />
    </div>
  );
}
