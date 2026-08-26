"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AuthActionProps = {
  initialSignedIn: boolean;
};

export default function AuthAction({ initialSignedIn }: AuthActionProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.user));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setBusy(false);
      return;
    }
    setSignedIn(false);
    setBusy(false);
    router.refresh();
  }

  return signedIn ? (
    <button className="btn secondary" onClick={signOut} disabled={busy}>
      {busy ? "Signing out…" : "Sign out"}
    </button>
  ) : (
    <Link className="btn secondary" href="/sign-in">Sign in</Link>
  );
}
