"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HelpButton from "@/components/help/HelpButton";

type AccountProfileProps = {
  email: string;
  initialDisplayName: string;
};

export default function AccountProfile({ email, initialDisplayName }: AccountProfileProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);

  async function saveProfile() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setMessageKind("error");
      setMessage("Sign in again to update your profile.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("profiles").update({ display_name: displayName.trim() || null }).eq("id", auth.user.id);
    setMessageKind(error ? "error" : "success");
    setMessage(error ? error.message : "Username saved.");
    setBusy(false);
  }

  async function sendPasswordReset() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setMessageKind(error ? "error" : "success");
    setMessage(error ? error.message : "Password reset email sent.");
    setBusy(false);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <section className="card">
      <div className="row"><div><h2>Account</h2><p>{email}</p></div><HelpButton slug="account" label="Account help" fallbackText="Update your username, request a password reset, or sign out of RealSign from this section." /></div>
      <label>Username<input className="field" value={displayName} onChange={event => setDisplayName(event.target.value)} /></label>
      <div className="row wrap">
        <button className="btn secondary" onClick={saveProfile} disabled={busy}>Save username</button>
        <button className="btn ghost" onClick={sendPasswordReset} disabled={busy}>Reset password</button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </div>
      {message ? <p className={`inline-feedback ${messageKind}`} aria-live="polite">{message}</p> : null}
    </section>
  );
}
