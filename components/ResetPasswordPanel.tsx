"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import HelpButton from "@/components/help/HelpButton";

export default function ResetPasswordPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success" | "">("");

  useEffect(() => {
    let alive = true;

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const recoveryError = params.get("error") === "recovery";
      if (recoveryError) {
        if (alive) setCheckingSession(false);
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          if (alive) setCheckingSession(false);
          return;
        }
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      }

      const { data } = await supabase.auth.getSession();
      if (alive) {
        setSessionReady(Boolean(data.session?.user));
        setCheckingSession(false);
      }
    }

    establishRecoverySession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (alive && session?.user) setSessionReady(true);
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionReady) return;
    setBusy(true);
    setMessage("");
    setMessageKind("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setBusy(false);
      setMessageKind("error");
      setMessage("The two passwords do not match.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessageKind("success");
      setMessage("Password updated. Opening your profile...");
      window.location.href = "/profile";
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  const hasRecoveryError = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "recovery";

  if (checkingSession) {
    return <section className="card"><h1 style={{ margin: 0 }}>Checking password reset link</h1><p style={{ marginTop: 12 }}>Please wait while we securely open your password reset.</p></section>;
  }

  if (hasRecoveryError || !sessionReady) {
    return (
      <section className="card">
        <div className="row"><h1 style={{ margin: 0 }}>Choose a new password</h1><HelpButton slug="password-reset" label="Password reset help" fallbackText="Use the newest password reset email on this device. The link must open a secure recovery session before a new password can be saved." /></div>
        <div className="auth-error" role="alert">
          <strong>Password reset link is invalid or has expired.</strong>
          <span>Please request a new password reset email and open the newest link on this device.</span>
        </div>
        <Link className="btn" href="/sign-in" style={{ marginTop: 16 }}>Request a new reset email</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="row">
        <h1 style={{ margin: 0 }}>Choose a new password</h1>
        <HelpButton slug="password-reset" label="Password reset help" fallbackText="Use the newest password reset email on this device. The link must open a secure recovery session before a new password can be saved." />
      </div>
      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <label>New password<input className="field" name="password" type="password" minLength={8} required /></label>
        <label>Confirm new password<input className="field" name="confirmPassword" type="password" minLength={8} required /></label>
        <button className="btn" disabled={busy || !sessionReady}>{busy ? "Please wait..." : "Update password"}</button>
      </form>
      {message ? <p aria-live="polite" className={messageKind === "error" ? "auth-error" : "muted"}>{message}</p> : null}
    </section>
  );
}
