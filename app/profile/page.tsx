import Link from "next/link";
import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import AccountProfile from "@/components/profile/AccountProfile";
import LearnerLanguagePreferences from "@/components/profile/LearnerLanguagePreferences";
import HelpButton from "@/components/help/HelpButton";
import { createClient } from "@/lib/supabase/server";


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
        <header className="topbar"><BrandLockup /></header>
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
          <p>Your account and preferences.</p>
          <Link className="profile-provider-link" href={provider ? "/provider" : "/provider/application"}>
            {provider ? "Provider dashboard" : "Become a provider"}
          </Link>
        </section>

        <div className="stack">
          <AccountProfile email={email} initialDisplayName={displayName} />
          <LearnerLanguagePreferences initialSpokenLanguage={String(metadata.learner_spoken_language || "en")} initialUsesSasl={Boolean(metadata.learner_uses_sasl ?? true)} />
          {!provider || provider.status !== "approved" ? <Link href="/profile/identity" className="card choice"><div className="icon">ID</div><div><div className="row"><h2>Identity verification</h2><span className="status">{identityStatusLabel(identity?.state || "not_started")}</span></div><p>Verify your identity before booking a lesson or interpreter.</p></div></Link> : null}
          <div className="provider-link-wrap"><Link href="/profile/notifications" className="card choice"><div className="icon">🔔</div><div><h2>Notifications</h2><p>Booking reminders and visual push alerts.</p></div></Link><HelpButton slug="push-reminders" label="Push reminders help" fallbackText="Manage booking reminders and visual push alerts so important updates are easier to notice." /></div>
          <div className="provider-link-wrap"><Link href="/help" className="card choice"><div className="icon">[?]</div><div><h2>Help in SASL</h2><p>Watch help videos and read matching text explanations.</p></div></Link><HelpButton slug="realsign-help" label="RealSign help" fallbackText="Open short RealSign help explanations with matching text and SASL videos when they are available." /></div>
        </div>
      </main>
      <AppNav />
    </div>
  );
}
