"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function EmailConfirmationPanel() {
  const [state, setState] = useState<"checking" | "confirmed" | "error">("checking");

  useEffect(() => {
    let alive = true;

    async function processConfirmation() {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error") === "confirmation") {
        if (alive) setState("error");
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await createClient().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) {
          if (alive) setState("error");
          return;
        }
        window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
      }

      if (alive) setState("confirmed");
    }

    processConfirmation();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "checking") {
    return <section className="card"><h1 style={{ margin: 0 }}>Checking email confirmation</h1><p style={{ marginTop: 12 }}>Please wait while we confirm your RealSign account.</p></section>;
  }

  if (state === "error") {
    return (
      <section className="card">
        <h1 style={{ margin: 0 }}>Email confirmation</h1>
        <div className="auth-error" role="alert">
          <strong>We could not confirm this email link.</strong>
          <span>The link may have expired or already been used. You can try signing in.</span>
        </div>
        <Link className="btn" href="/sign-in" style={{ marginTop: 16 }}>Go to sign in</Link>
      </section>
    );
  }

  return (
    <section className="card">
      <h1 style={{ margin: 0 }}>Email confirmed</h1>
      <div className="auth-success" role="status">
        <strong>Your email was confirmed successfully.</strong>
        <span>Your RealSign account is ready. Continue to RealSign to use your account.</span>
      </div>
      <Link className="btn" href="/profile" style={{ marginTop: 16 }}>Continue to RealSign</Link>
    </section>
  );
}
