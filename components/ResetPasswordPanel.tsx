"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPanel() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setBusy(false);
      setMessage("The two passwords do not match.");
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage("Password updated. Opening your profile...");
      window.location.href = "/profile";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="row">
        <h1 style={{ margin: 0 }}>Choose a new password</h1>
        <button className="help-btn" type="button" aria-label="Password reset help">?</button>
      </div>
      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <label>New password<input className="field" name="password" type="password" minLength={8} required /></label>
        <label>Confirm new password<input className="field" name="confirmPassword" type="password" minLength={8} required /></label>
        <button className="btn" disabled={busy}>{busy ? "Please wait..." : "Update password"}</button>
      </form>
      {message ? <p aria-live="polite" className="muted">{message}</p> : null}
    </section>
  );
}
