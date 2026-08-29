"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient, createEmailConfirmationClient } from "@/lib/supabase/client";

function retrySecondsFrom(message: string) {
  const match = message.match(/(?:after|in)\s+(\d+)\s+seconds?/i);
  return match ? Number(match[1]) : null;
}

function isResetRateLimit(message: string) {
  return /rate limit|too many|security purposes|request this after/i.test(message);
}

export default function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "reset">("sign-in");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success" | "">("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  function changeMode(nextMode: "sign-in" | "sign-up" | "reset") {
    setMessage("");
    setMessageKind("");
    setRetryAfter(0);
    setMode(nextMode);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setMessageKind("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();

    try {
      const supabase = mode === "sign-up" ? createEmailConfirmationClient() : createClient();
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/profile";
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (error) throw error;
        setMessage("Password reset email sent. Open the link in your email to choose a new password.");
        setMessageKind("success");
      } else {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirmed`,
            data: {
              first_name: firstName,
              last_name: lastName,
              display_name: firstName || email.split("@")[0],
            },
          },
        });
        if (error) throw error;
        setMessage(result.session ? "Account created. You are signed in." : "Account created. Check your email to confirm your address.");
        setMessageKind("success");
        if (result.session) window.location.href = "/profile";
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : "Something went wrong.";
      const seconds = mode === "reset" ? retrySecondsFrom(errorText) : null;
      if (mode === "reset" && isResetRateLimit(errorText)) {
        setMessage(seconds ? "Please wait a moment before requesting another reset email." : "Email delivery is temporarily limited. Please try again later.");
        setRetryAfter(seconds || 0);
      } else {
        setMessage(errorText);
      }
      setMessageKind("error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row">
        <h1 style={{margin: 0}}>{mode === "sign-in" ? "Welcome back" : mode === "reset" ? "Reset password" : "Create account"}</h1>
        <button className="help-btn" type="button" aria-label="Account help">?</button>
      </div>
      <form onSubmit={submit} style={{marginTop: 18}}>
        {mode === "sign-up" && (
          <div className="grid2">
            <label>First name<input className="field" name="firstName" required /></label>
            <label>Last name<input className="field" name="lastName" required /></label>
          </div>
        )}
        <label>Email<input className="field" name="email" type="email" required /></label>
        {mode !== "reset" ? <label>Password<input className="field" name="password" type="password" minLength={8} required /></label> : null}
        <button className="btn" disabled={busy || (mode === "reset" && retryAfter > 0)}>{retryAfter > 0 ? "Please wait..." : busy ? "Please wait..." : mode === "sign-in" ? "Sign in" : mode === "reset" ? "Send reset email" : "Create account"}</button>
      </form>
      {message ? <p aria-live="polite" className={messageKind === "error" ? "auth-error" : messageKind === "success" ? "auth-success" : "muted"}>{message}</p> : null}
      {mode === "reset" && retryAfter > 0 ? <p className="muted">You can request another email in {retryAfter} seconds.</p> : null}
      <div className="row wrap" style={{marginTop: 12}}>
        <button className="btn secondary" onClick={() => changeMode(mode === "sign-up" ? "sign-in" : "sign-up")}>
          {mode === "sign-up" ? "I already have an account" : "Create an account"}
        </button>
        {mode !== "reset" ? <button className="btn ghost" onClick={() => changeMode("reset")}>Forgot password?</button> : <button className="btn ghost" onClick={() => changeMode("sign-in")}>Back to sign in</button>}
      </div>
    </section>
  );
}
