"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandLockup from "@/components/BrandLockup";
import AppNav from "@/components/AppNav";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];

type IdentityState = "loading" | "signed_out" | "not_started" | "pending" | "approved" | "rejected" | "needs_information";

function statusLabel(state: IdentityState) {
  switch (state) {
    case "pending": return "Pending review";
    case "approved": return "Approved";
    case "needs_information": return "Needs information";
    case "rejected": return "Not approved";
    default: return "Not submitted";
  }
}

async function uploadWithProgress(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return new Promise<{ error: string | null }>(resolve => {
    const request = new XMLHttpRequest();
    request.open("POST", `${supabaseUrl}/storage/v1/object/${encodeURIComponent("verification-documents")}/${encodedPath}`);
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("apikey", publishableKey);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onerror = () => resolve({ error: "Upload failed. Please check your connection and try again." });
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve({ error: null });
        return;
      }
      let message = "Upload failed. Please try again.";
      try {
        const response = JSON.parse(request.responseText) as { message?: string; error?: string };
        message = response.message || response.error || message;
      } catch {
        // Keep the friendly fallback when storage returns a non-JSON response.
      }
      resolve({ error: message });
    };
    request.send(file);
  });
}

export default function Page() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<IdentityState>("loading");
  const [uid, setUid] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setState("signed_out"); return; }
      setUid(auth.user.id);
      const { data, error } = await supabase.from("user_identity_verifications").select("state,storage_path").eq("user_id", auth.user.id).maybeSingle();
      if (error) { setMessageKind("error"); setMessage(error.message); }
      setStoragePath(data?.storage_path || null);
      setState((data?.state as IdentityState) || "not_started");
    })();
  }, [supabase]);

  async function uploadIdentity(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !uid) return;
    if (file.size > MAX_FILE_BYTES) { setMessageKind("error"); setMessage("Please choose a PDF, JPG or PNG file that is 10 MB or smaller."); return; }
    if (!(MIME_TYPES.includes(file.type) || EXTENSIONS.some(extension => file.name.toLowerCase().endsWith(extension)))) {
      setMessageKind("error"); setMessage("Please choose a PDF, JPG or PNG file."); return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!accessToken || !supabaseUrl || !publishableKey) { setMessageKind("error"); setMessage("Your sign-in session has expired. Please sign in again."); return; }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${uid}/learner-identity/${Date.now()}-${safeName}`;
    setProgress(0);
    setMessageKind("info");
    setMessage("Uploading identity document… 0%");
    const upload = await uploadWithProgress(supabaseUrl, publishableKey, accessToken, path, file, percent => {
      setProgress(percent);
      setMessage(`Uploading identity document… ${percent}%`);
    });
    setProgress(null);
    if (upload.error) { setMessageKind("error"); setMessage(upload.error); return; }
    const { error } = await supabase.from("user_identity_verifications").upsert({
      user_id: uid,
      state: "pending",
      storage_path: path,
      submitted_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) {
      await supabase.storage.from("verification-documents").remove([path]);
      setMessageKind("error"); setMessage(error.message); return;
    }
    if (storagePath && storagePath !== path) {
      await supabase.storage.from("verification-documents").remove([storagePath]);
    }
    setStoragePath(path);
    setState("pending");
    setMessageKind("success");
    setMessage("Identity document uploaded successfully. Awaiting admin review.");
    event.target.value = "";
  }

  async function removeIdentity() {
    if (!uid || !storagePath || !window.confirm("Remove this identity document? You can upload a replacement.")) return;
    setMessageKind("info");
    setMessage("Removing identity document…");
    const { error: storageError } = await supabase.storage.from("verification-documents").remove([storagePath]);
    if (storageError) { setMessageKind("error"); setMessage(storageError.message); return; }
    const { error } = await supabase.from("user_identity_verifications").update({ state: "not_started", storage_path: null, submitted_at: null }).eq("user_id", uid);
    if (error) { setMessageKind("error"); setMessage(error.message); return; }
    setStoragePath(null);
    setState("not_started");
    setMessageKind("success");
    setMessage("Identity document removed.");
  }

  return <div className="shell">
    <header className="topbar"><BrandLockup /><strong>Identity verification</strong></header>
    <main className="main">
      <section className="card">
        <div className="row"><div><h1>Identity verification</h1><p>Status: <strong>{statusLabel(state)}</strong></p></div><Link className="help-btn" href="/profile" aria-label="Back to profile">←</Link></div>
        <p>Upload one identity document for RealSign Admin review. This is separate from provider application verification.</p>
        <p className="upload-guidance">Accepted files: PDF, JPG or PNG · Maximum 10 MB. Your document is private and is only available to you and RealSign Admin.</p>
        {state === "approved" ? <p className="notice">Your identity has been approved. You can continue to use RealSign.</p> : null}
        {state !== "approved" && state !== "signed_out" ? <div className="row wrap"><label className="upload-btn">{storagePath ? "Replace document" : "Upload identity document"}<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={progress !== null} onChange={uploadIdentity} /></label>{storagePath ? <button type="button" className="mini-btn danger-text" disabled={progress !== null} onClick={removeIdentity}>Remove document</button> : null}</div> : null}
        {state === "signed_out" ? <Link className="btn" href="/sign-in">Sign in</Link> : null}
        {progress !== null ? <div className="upload-progress" role="status" aria-live="polite"><div className="upload-progress-top"><strong>Uploading identity document</strong><span>{progress}%</span></div><progress value={progress} max={100} aria-label={`Uploading identity document ${progress}%`} /></div> : null}
        {message ? <p className={`inline-feedback ${messageKind}`} aria-live="polite">{message}</p> : null}
        {state === "pending" && storagePath ? <p className="notice">Your document is waiting for RealSign Admin review. You do not need to upload it again unless you want to replace it.</p> : null}
      </section>
    </main>
    <AppNav />
  </div>;
}
