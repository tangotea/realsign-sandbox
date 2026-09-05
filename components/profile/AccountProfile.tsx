"use client";

import { useEffect, useState } from "react";
import { createClient, createRecoveryClient } from "@/lib/supabase/client";
import HelpButton from "@/components/help/HelpButton";

type AccountProfileProps = {
  email: string;
  initialDisplayName: string;
};

function retrySecondsFrom(message: string) {
  const match = message.match(/(?:after|in)\s+(\d+)\s+seconds?/i);
  return match ? Number(match[1]) : 0;
}

function isResetRateLimit(message: string) {
  return /rate limit|too many|security purposes|request this after/i.test(message);
}

export default function AccountProfile({ email, initialDisplayName }: AccountProfileProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter(current => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

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
    const recoveryClient = createRecoveryClient();
    const { error } = await recoveryClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      const seconds = retrySecondsFrom(error.message);
      setMessageKind("error");
      setMessage(isResetRateLimit(error.message) ? "Please wait a moment before requesting another reset email." : error.message);
      if (isResetRateLimit(error.message)) setRetryAfter(seconds || 20);
    } else {
      setMessageKind("success");
      setMessage("Password reset email sent. Open the newest email on this device to choose a new password.");
      setRetryAfter(20);
    }
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
        <button className="btn ghost" onClick={sendPasswordReset} disabled={busy || retryAfter > 0}>Reset password</button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
      </div>
      {message ? <p className={`inline-feedback ${messageKind}`} aria-live="polite">{message}</p> : null}
      {retryAfter > 0 ? <p className="muted" aria-live="polite">You can request another reset email in {retryAfter} seconds.</p> : null}
    </section>
  );
}
