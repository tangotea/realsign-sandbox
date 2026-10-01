"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createClient, createRecoveryClient } from "@/lib/supabase/client";
import HelpButton from "@/components/help/HelpButton";
import PasswordInput from "@/components/PasswordInput";

export default function ResetPasswordPanel() {
  const supabase = useMemo(() => createRecoveryClient(), []);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success" | "">("");
  const recoveryAttempt = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let alive = true;

    async function establishRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const recoveryError = params.has("error") || hashParams.has("error");
      if (recoveryError) {
        throw new Error("The email service could not verify this link. It may have already been used or expired. Request a new reset email.");
      }

      const code = params.get("code");
      if (code) {
        const { data, error } = await createClient().auth.exchangeCodeForSession(code);
        if (error || !data.session) throw new Error("This older reset link requires the browser where you requested it. Request a new reset email after the update.");
        const result = await supabase.auth.setSession(data.session);
        if (result.error) throw result.error;
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) throw error;
      }

      const tokenHash = params.get("token_hash");
      if (tokenHash && params.get("type") === "recovery") {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        if (error) throw error;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) throw new Error("This link does not contain password reset details. Request a new reset email. If it happens again, the reset email template needs checking.");
      if (data.session?.user) window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Reuse the one-time verification when React re-runs the effect.
    recoveryAttempt.current ??= establishRecoverySession();
    recoveryAttempt.current.then(() => {
      if (alive) setSessionReady(true);
    }).catch((error) => {
      if (alive) setMessage(error instanceof Error ? error.message : "Unable to verify the reset link. Please try again.");
    }).finally(() => {
      if (alive) setCheckingSession(false);
    });
    return () => {
      alive = false;
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
      setMessage("Password updated. Please sign in with your new password.");
      setSessionReady(false);
    } catch (error) {
      setMessageKind("error");
      setMessage(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  const hasRecoveryError = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "recovery";

  if (messageKind === "success") {
    return <section className="card"><h1>Password updated</h1><p>{message}</p><Link className="btn" href="/sign-in" style={{ marginTop: 16 }}>Sign in</Link></section>;
  }

  if (checkingSession) {
    return <section className="card"><h1 style={{ margin: 0 }}>Checking password reset link</h1><p style={{ marginTop: 12 }}>Please wait while we securely open your password reset.</p></section>;
  }

  if (hasRecoveryError || !sessionReady) {
    return (
      <section className="card">
        <div className="row"><h1 style={{ margin: 0 }}>Choose a new password</h1><HelpButton slug="password-reset" label="Password reset help" fallbackText="Use the newest password reset email. The link must open a secure recovery session before a new password can be saved." /></div>
        <div className="auth-error" role="alert">
          <strong>Unable to open password reset.</strong>
          <span>{message || "Please request a new password reset email and open the newest link."}</span>
        </div>
        <Link className="btn" href="/sign-in" style={{ marginTop: 16 }}>Request a new reset email</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="row">
        <h1 style={{ margin: 0 }}>Choose a new password</h1>
        <HelpButton slug="password-reset" label="Password reset help" fallbackText="Use the newest password reset email. The link must open a secure recovery session before a new password can be saved." />
      </div>
      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <label>New password<PasswordInput name="password" minLength={8} required /></label>
        <label>Confirm new password<PasswordInput name="confirmPassword" minLength={8} required /></label>
        <button className="btn" disabled={busy || !sessionReady}>{busy ? "Please wait..." : "Update password"}</button>
      </form>
      {message ? <p aria-live="polite" className={messageKind === "error" ? "auth-error" : "muted"}>{message}</p> : null}
    </section>
  );
}
