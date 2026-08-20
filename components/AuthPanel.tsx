"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const firstName = String(data.get("firstName") || "").trim();
    const lastName = String(data.get("lastName") || "").trim();

    try {
      const supabase = createClient();
      if (mode === "sign-in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = "/profile";
      } else {
        const { data: result, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
            data: {
              first_name: firstName,
              last_name: lastName,
              display_name: firstName || email.split("@")[0],
            },
          },
        });
        if (error) throw error;
        setMessage(result.session ? "Account created. You are signed in." : "Account created. Check your email to confirm your address.");
        if (result.session) window.location.href = "/profile";
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row">
        <h1 style={{margin: 0}}>{mode === "sign-in" ? "Welcome back" : "Create account"}</h1>
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
        <label>Password<input className="field" name="password" type="password" minLength={8} required /></label>
        <button className="btn" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}</button>
      </form>
      {message ? <p aria-live="polite" className="muted">{message}</p> : null}
      <button className="btn secondary" style={{marginTop: 12}} onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
        {mode === "sign-in" ? "Create an account" : "I already have an account"}
      </button>
    </section>
  );
}
