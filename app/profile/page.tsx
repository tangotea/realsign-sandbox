import NavigationCard from "@/components/NavigationCard";
import ProviderTools from "@/components/provider/ProviderTools";
import Link from "next/link";
import AppNav from "@/components/AppNav";
import BrandLockup from "@/components/BrandLockup";
import AccountProfile from "@/components/profile/AccountProfile";
import LearnerLanguagePreferences from "@/components/profile/LearnerLanguagePreferences";
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
        </section>

        <div className="stack">
          <AccountProfile email={email} initialDisplayName={displayName} />
          {provider?.status === "approved" ? <section aria-labelledby="profile-provider-tools">
            <h2 id="profile-provider-tools">Provider tools</h2>
            <ProviderTools />
          </section> : null}
          <LearnerLanguagePreferences initialSpokenLanguage={String(metadata.learner_spoken_language || "en")} initialUsesSasl={Boolean(metadata.learner_uses_sasl ?? true)} />
          {!provider || provider.status !== "approved" ? <NavigationCard href="/profile/identity" icon="ID" title="Identity verification" description="Verify your identity before booking a lesson or interpreter." status={identityStatusLabel(identity?.state || "not_started")} /> : null}
          <NavigationCard href="/profile/notifications" icon="🔔" title="Notifications" description="Booking reminders and visual push alerts." helpSlug="push-reminders" helpText="Manage booking reminders and visual push alerts so important updates are easier to notice." />
          <NavigationCard href="/help" icon="[?]" title="Help in SASL" description="Watch help videos and read matching text explanations." helpSlug="realsign-help" helpText="Open short RealSign help explanations with matching text and SASL videos when they are available." />
        </div>
      </main>
      <AppNav />
    </div>
  );
}
