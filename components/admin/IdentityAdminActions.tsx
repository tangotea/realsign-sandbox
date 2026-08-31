"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type IdentityState = "approved" | "rejected" | "needs_information";

export default function IdentityAdminActions({
  userId,
  state,
}: {
  userId: string;
  state?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error">("success");

  async function setIdentityState(nextState: IdentityState) {
    setBusy(true);
    setMessage("");

    const { error } = await supabase.rpc("admin_set_user_identity_state", {
      p_user_id: userId,
      p_state: nextState,
      p_reason: "Admin review / development checkpoint",
    });

    setBusy(false);

    if (error) {
      setMessageKind("error");
      setMessage(`ID update failed: ${error.message}`);
      return;
    }

    setMessageKind("success");
    setMessage(nextState === "approved" ? "ID approved." : nextState === "rejected" ? "ID rejected." : "More information requested.");
    router.refresh();
  }

  return (
    <div className="stack compact">
      <div className="row wrap">
        {state === "approved" ? (
          <>
            <span className="status">ID approved</span>
            <button className="mini-btn" disabled={busy} onClick={() => setIdentityState("needs_information")}>
              Reopen review
            </button>
          </>
        ) : (
          <button className="mini-btn" disabled={busy} onClick={() => setIdentityState("approved")}>
            Approve ID
          </button>
        )}
        {state !== "approved" ? (
          <>
            <button className="mini-btn" disabled={busy} onClick={() => setIdentityState("needs_information")}>
              Need info
            </button>
            <button className="mini-btn" disabled={busy} onClick={() => setIdentityState("rejected")}>
              Reject
            </button>
          </>
        ) : null}
      </div>
      {message ? (
        <small className={`inline-feedback ${messageKind}`} aria-live="polite">
          {message}
        </small>
      ) : null}
    </div>
  );
}
