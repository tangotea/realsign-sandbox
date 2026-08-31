"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import LanguageSelector from "@/components/LanguageSelector";
import { createClient } from "@/lib/supabase/client";
import { roleLabel, serviceDetailLabel, serviceLabel } from "@/lib/marketplace";
import { BOOKING_NOTICE_OPTIONS, BUFFER_OPTIONS, PROVIDER_ROLES, SESSION_DURATIONS, minutesLabel } from "@/lib/provider";
import { TUTOR_LESSON_GUIDES } from "@/lib/lesson-guides";
import type { ProviderRole, ProviderStatus, VerificationState, VerificationType } from "@/lib/domain";

type Service = { id: string; title: string; duration_min: number; price_cents: number; status: string; provider_role: ProviderRole };
type Verification = { id: string; type: VerificationType; state: VerificationState; storage_path: string | null };
type RateRule = { provider_role: ProviderRole; duration_min: number; min_price_cents: number; max_price_cents: number };
type FeedbackKind = "success" | "error" | "info";

const HELP_LABEL = "Open SASL help";
const MAX_VERIFICATION_FILE_BYTES = 10 * 1024 * 1024;
const MAX_INTRO_VIDEO_BYTES = 100 * 1024 * 1024;
const VERIFICATION_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const VERIFICATION_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
const ACTIVE_PROVIDER_ROLES: ProviderRole[] = ["deaf_tutor", "interpreter"];
const SERVICE_OPTIONS: Record<ProviderRole, string[]> = {
  deaf_tutor: TUTOR_LESSON_GUIDES.map(guide => guide.title),
  interpreter: [
    "Video Call SASL Interpreting",
    "Education SASL Interpreting",
    "Work or appointment SASL Interpreting",
    "General SASL Interpreting",
  ],
  qualified_deaf_teacher: [],
};

async function uploadToStorageWithProgress(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<{ error: { message: string } | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!accessToken || !supabaseUrl || !publishableKey) {
    return { error: { message: "Your sign-in session has expired. Please sign in again." } };
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return new Promise(resolve => {
    const request = new XMLHttpRequest();
    request.open("POST", `${supabaseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`);
    request.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    request.setRequestHeader("apikey", publishableKey);
    request.setRequestHeader("x-upsert", "false");
    request.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    request.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };
    request.onerror = () => resolve({ error: { message: "Upload failed. Please check your connection and try again." } });
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
      resolve({ error: { message } });
    };
    request.send(file);
  });
}

function restoreScrollPosition(scrollTop: number) {
  requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" })));
}

function UploadProgress({ label, progress }: { label: string; progress: number }) {
  return <div className="upload-progress" role="status" aria-live="polite">
    <div className="upload-progress-top"><strong>{label}</strong><span>{progress}%</span></div>
    <progress value={progress} max={100} aria-label={`${label} ${progress}%`} />
  </div>;
}

export default function ProviderApplication() {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [serviceMessage, setServiceMessage] = useState("");
  const [serviceMessageKind, setServiceMessageKind] = useState<FeedbackKind>("success");
  const [rolesMessage, setRolesMessage] = useState("");
  const [rolesMessageKind, setRolesMessageKind] = useState<FeedbackKind>("success");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageKind, setProfileMessageKind] = useState<FeedbackKind>("success");
  const [introProgress, setIntroProgress] = useState<number | null>(null);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationMessageKind, setVerificationMessageKind] = useState<FeedbackKind>("success");
  const [verificationProgress, setVerificationProgress] = useState<number | null>(null);
  const [bookingMessage, setBookingMessage] = useState("");
  const [bookingMessageKind, setBookingMessageKind] = useState<FeedbackKind>("success");
  const [userId, setUserId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus>("draft");
  const [displayName, setDisplayName] = useState("");
  const [introText, setIntroText] = useState("");
  const [introVideoPath, setIntroVideoPath] = useState<string | null>(null);
  const [roles, setRoles] = useState<Set<ProviderRole>>(new Set());
  const [services, setServices] = useState<Service[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [notice, setNotice] = useState(120);
  const [buffer, setBuffer] = useState(15);
  const [serviceRole, setServiceRole] = useState<ProviderRole>("deaf_tutor");
  const [serviceDuration, setServiceDuration] = useState(30);
  const [rateRules, setRateRules] = useState<RateRule[]>([]);
  const restoreScrollTopRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    setBusy(true);
    setMessage("");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setBusy(false); return; }
    setUserId(auth.user.id);
    const { data: ensured, error: ensureError } = await supabase.rpc("ensure_provider_application");
    if (ensureError) { setMessage(ensureError.message); setBusy(false); return; }
    const pid = String(ensured);
    setProviderId(pid);

    const [profileRes, roleRes, serviceRes, verifyRes, settingsRes, rateRulesRes] = await Promise.all([
      supabase.from("provider_profiles").select("status,public_display_name,introduction_text,introduction_video_path").eq("id", pid).single(),
      supabase.from("provider_roles").select("role").eq("provider_id", pid),
      supabase.from("provider_services").select("id,title,duration_min,price_cents,status,provider_role").eq("provider_id", pid).eq("status", "active").order("created_at"),
      supabase.from("verification_records").select("id,type,state,storage_path").eq("provider_id", pid),
      supabase.from("provider_booking_settings").select("booking_notice_min,buffer_min").eq("provider_id", pid).single(),
      supabase.from("rate_rules").select("provider_role,duration_min,min_price_cents,max_price_cents").eq("active", true),
    ]);
    if (profileRes.data) {
      setStatus(profileRes.data.status as ProviderStatus);
      setDisplayName(profileRes.data.public_display_name || "");
      setIntroText(profileRes.data.introduction_text || "");
      setIntroVideoPath(profileRes.data.introduction_video_path || null);
    }
    setRoles(new Set((roleRes.data || []).map((r: { role: ProviderRole }) => r.role).filter(role => ACTIVE_PROVIDER_ROLES.includes(role))));
    setServices((serviceRes.data || []) as Service[]);
    setVerifications((verifyRes.data || []) as Verification[]);
    setRateRules((rateRulesRes.data || []) as RateRule[]);
    if (settingsRes.data) { setNotice(settingsRes.data.booking_notice_min); setBuffer(settingsRes.data.buffer_min); }
    setBusy(false);
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (busy || restoreScrollTopRef.current === null) return;
    const scrollTop = restoreScrollTopRef.current;
    restoreScrollTopRef.current = null;
    restoreScrollPosition(scrollTop);
  }, [busy]);

  async function saveRoles() {
    if (!providerId) return;
    setMessage("");
    setRolesMessageKind("info");
    setRolesMessage("Saving roles…");
    const { error: del } = await supabase.from("provider_roles").delete().eq("provider_id", providerId);
    if (del) { setRolesMessageKind("error"); setRolesMessage(del.message); return; }
    if (roles.size) {
      const { error } = await supabase.from("provider_roles").insert(Array.from(roles).map(role => ({ provider_id: providerId, role })));
      if (error) { setRolesMessageKind("error"); setRolesMessage(error.message); return; }
    }
    setRolesMessageKind("success");
    setRolesMessage("Provider roles saved.");
  }

  async function saveProfile() {
    if (!providerId) return;
    setMessage("");
    setProfileMessageKind("info");
    setProfileMessage("Saving profile…");
    const { error } = await supabase.from("provider_profiles").update({ public_display_name: displayName, introduction_text: introText }).eq("id", providerId);
    setProfileMessageKind(error ? "error" : "success");
    setProfileMessage(error ? error.message : "Introduction saved.");
  }

  async function uploadIntro(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId || !providerId) return;
    const scrollTop = window.scrollY;
    const input = event.currentTarget;
    if (file.size > MAX_INTRO_VIDEO_BYTES) {
      setProfileMessageKind("error");
      setProfileMessage("Introduction video must be 100 MB or smaller.");
      return;
    }
    if (!(VIDEO_MIME_TYPES.includes(file.type) || VIDEO_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)))) {
      setProfileMessageKind("error");
      setProfileMessage("Please choose an MP4, WebM or MOV video.");
      return;
    }
    setProfileMessageKind("info");
    setIntroProgress(0);
    setProfileMessage("Uploading introduction video… 0%");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/intro/${Date.now()}-${safeName}`;
    const { error: uploadError } = await uploadToStorageWithProgress(supabase, "provider-media", path, file, percent => {
      setIntroProgress(percent);
      setProfileMessage(`Uploading introduction video… ${percent}%`);
    });
    setIntroProgress(null);
    if (uploadError) { setProfileMessageKind("error"); setProfileMessage(uploadError.message); return; }
    const { error } = await supabase.from("provider_profiles").update({ introduction_video_path: path }).eq("id", providerId);
    if (error) await supabase.storage.from("provider-media").remove([path]);
    setProfileMessageKind(error ? "error" : "success");
    setProfileMessage(error ? error.message : "Introduction video uploaded successfully.");
    if (!error) {
      setIntroVideoPath(path);
      input.value = "";
      restoreScrollPosition(scrollTop);
    }
  }

  async function uploadVerification(type: VerificationType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId || !providerId) return;
    const scrollTop = window.scrollY;
    const input = event.currentTarget;
    if (file.size > MAX_VERIFICATION_FILE_BYTES) {
      setVerificationMessageKind("error");
      setVerificationMessage("Verification files must be 10 MB or smaller.");
      return;
    }
    if (!(VERIFICATION_MIME_TYPES.includes(file.type) || VERIFICATION_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)))) {
      setVerificationMessageKind("error");
      setVerificationMessage("Please choose a PDF, JPG or PNG file.");
      return;
    }
    setVerificationMessageKind("info");
    setVerificationProgress(0);
    setVerificationMessage("Uploading verification document… 0%");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/${type}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await uploadToStorageWithProgress(supabase, "verification-documents", path, file, percent => {
      setVerificationProgress(percent);
      setVerificationMessage(`Uploading verification document… ${percent}%`);
    });
    setVerificationProgress(null);
    if (uploadError) { setVerificationMessageKind("error"); setVerificationMessage(uploadError.message); return; }
    const existing = verifications.find(v => v.type === type);
    const payload = { provider_id: providerId, type, state: "pending", storage_path: path, submitted_at: new Date().toISOString() };
    const query = existing
      ? supabase.from("verification_records").update(payload).eq("provider_id", providerId).eq("type", type)
      : supabase.from("verification_records").insert(payload);
    const { error } = await query;
    if (error) { await supabase.storage.from("verification-documents").remove([path]); setVerificationMessageKind("error"); setVerificationMessage(error.message); return; }
    setVerificationMessageKind("success");
    setVerificationMessage("Verification uploaded successfully. Awaiting admin approval.");
    restoreScrollTopRef.current = scrollTop;
    await refresh();
    input.value = "";
  }

  async function removeVerification(type: VerificationType) {
    if (!providerId) return;
    const verification = verifications.find(item => item.type === type);
    if (!verification?.storage_path) return;
    if (!window.confirm("Remove this verification file? You can upload a replacement before submitting your application.")) return;
    const scrollTop = window.scrollY;
    restoreScrollTopRef.current = scrollTop;
    setVerificationMessageKind("info");
    setVerificationMessage("Removing verification file…");
    const response = await fetch("/api/provider/uploads/remove", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "verification", providerId, verificationType: type, path: verification.storage_path }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { restoreScrollTopRef.current = null; setVerificationMessageKind("error"); setVerificationMessage(result.error || "Unable to remove the verification file."); return; }
    setVerificationMessageKind("success");
    setVerificationMessage("Verification file removed.");
    await refresh();
  }

  async function removeIntroVideo() {
    if (!providerId || !introVideoPath) return;
    if (!window.confirm("Remove this introduction video?")) return;
    const scrollTop = window.scrollY;
    setProfileMessageKind("info");
    setProfileMessage("Removing introduction video…");
    const response = await fetch("/api/provider/uploads/remove", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "introduction_video", providerId, path: introVideoPath }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setProfileMessageKind("error"); setProfileMessage(result.error || "Unable to remove the introduction video."); return; }
    setIntroVideoPath(null);
    setProfileMessageKind("success");
    setProfileMessage("Introduction video removed.");
    restoreScrollPosition(scrollTop);
  }

  async function createService(form: HTMLFormElement) {
    if (!providerId) return;
    const scrollTop = window.scrollY;
    setServiceMessage("");
    const data = new FormData(form);
    const providerRole = String(data.get("providerRole")) as ProviderRole;
    const duration = Number(data.get("duration"));
    const priceRands = Number(data.get("price"));
    const title = String(data.get("title") || "").trim();
    const { data: rule } = await supabase.from("rate_rules").select("min_price_cents,max_price_cents").eq("provider_role", providerRole).eq("duration_min", duration).eq("active", true).maybeSingle();
    const cents = Math.round(priceRands * 100);
    if (rule && (cents < rule.min_price_cents || cents > rule.max_price_cents)) {
      setServiceMessageKind("error");
      setServiceMessage(`Price must be between R${(rule.min_price_cents/100).toFixed(0)} and R${(rule.max_price_cents/100).toFixed(0)}.`); return;
    }
    const { error } = await supabase.from("provider_services").insert({ provider_id: providerId, provider_role: providerRole, subject_id: null, title, duration_min: duration, price_cents: cents, status: "active", remote: true });
    setServiceMessageKind(error ? "error" : "success");
    setServiceMessage(error ? error.message : "Service added.");
    if (!error) {
      (document.activeElement as HTMLElement | null)?.blur();
      form.reset();
      restoreScrollTopRef.current = scrollTop;
      await refresh();
      setServiceMessage("Service added.");
    }
  }

  async function removeService(service: Service) {
    if (!providerId) return;
    const scrollTop = window.scrollY;
    const confirmed = window.confirm(`Remove ${serviceLabel(service)} from your services?`);
    if (!confirmed) return;
    setServiceMessageKind("info");
    setServiceMessage("Removing service…");
    const { error } = await supabase.from("provider_services").update({ status: "archived" }).eq("id", service.id).eq("provider_id", providerId).eq("status", "active");
    if (error) { setServiceMessageKind("error"); setServiceMessage(error.message); return; }
    (document.activeElement as HTMLElement | null)?.blur();
    setServices(current => current.filter(item => item.id !== service.id));
    setServiceMessageKind("success");
    setServiceMessage("Service removed.");
    restoreScrollPosition(scrollTop);
  }

  async function saveBookingSettings() {
    if (!providerId) return;
    setMessage("");
    setBookingMessageKind("info");
    setBookingMessage("Saving preferences…");
    const { error } = await supabase.from("provider_booking_settings").update({ booking_notice_min: notice, buffer_min: buffer }).eq("provider_id", providerId);
    setBookingMessageKind(error ? "error" : "success");
    setBookingMessage(error ? error.message : "Preferences saved.");
  }

  async function submitApplication() {
    if (!roles.size) return setMessage("Choose at least one provider role first.");
    const { error } = await supabase.rpc("submit_provider_application");
    setMessage(error ? error.message : "Application submitted to RealSign Admin ✓");
    if (!error) await refresh();
  }

  if (busy) return <section className="card"><h1>Provider Application for Deaf Tutors and Interpreters</h1><p>Loading…</p></section>;
  if (!userId) return <section className="card"><h1>Become a provider</h1><p>Sign in before starting your application.</p><Link className="btn" href="/sign-in">Sign in</Link></section>;

  const verificationState = (type: VerificationType) => verifications.find(v => v.type === type)?.state || "not_submitted";
  const editable = status === "draft" || status === "rejected";
  const providerSettingsEditable = editable || status === "approved";
  const selectedServiceRole = roles.has(serviceRole) ? serviceRole : (Array.from(roles)[0] || "deaf_tutor");
  const serviceOptions = SERVICE_OPTIONS[selectedServiceRole].length ? SERVICE_OPTIONS[selectedServiceRole] : ["General RealSign service"];
  const selectedRateRule = rateRules.find(rule => rule.provider_role === selectedServiceRole && rule.duration_min === serviceDuration);
  const minPrice = selectedRateRule ? selectedRateRule.min_price_cents / 100 : null;
  const maxPrice = selectedRateRule ? selectedRateRule.max_price_cents / 100 : null;
  const languageModes = [
    roles.has("deaf_tutor") ? "tutor" : null,
    roles.has("interpreter") ? "interpreter" : null,
  ].filter(Boolean) as ("tutor" | "interpreter")[];

  return <div className="stack">
    <section className="card">
      <div className="row"><div><h1>Provider Application for Deaf Tutors and Interpreters</h1><p>Status: <strong>{status.replaceAll("_", " ")}</strong></p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
      {status === "pending" ? <p className="notice">Your application is with RealSign Admin. You can view it here while it is being reviewed.</p> : null}
      {status === "approved" ? <p className="success-box">Approved ✓ Your provider profile is ready for the payout-setup step.</p> : null}
    </section>

    <section className="card">
      <div className="row"><div><h2>1. What would you like to offer?</h2><p>You can select more than one role.</p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
      <div className="stack compact">
        {PROVIDER_ROLES.map(r => <label className="check" key={r.value}><input disabled={!editable} type="checkbox" checked={roles.has(r.value)} onChange={() => { const next=new Set(roles); next.has(r.value)?next.delete(r.value):next.add(r.value); setRoles(next); }} /><span><strong>{r.icon} {r.label}</strong><small>{r.description}</small></span></label>)}
      </div>
      {roles.has("deaf_tutor") ? <p className="notice">RealSign SASL lessons are reserved for Deaf SASL tutors. Interpreter approval is handled separately.</p> : null}
      {editable ? <button className="btn secondary" onClick={saveRoles}>Save roles</button> : null}
      {rolesMessage ? <p className={`inline-feedback ${rolesMessageKind}`} aria-live="polite">{rolesMessage}</p> : null}
    </section>

    <section className="card">
      <h2>2. Verification</h2>
      <p className="upload-guidance">Accepted files: PDF, JPG or PNG · Maximum 10 MB. Your files are reviewed by RealSign Admin.</p>
      <VerificationRow label="Identity" state={verificationState("identity")} storagePath={verifications.find(v=>v.type==="identity")?.storage_path} onFile={e=>uploadVerification("identity",e)} onRemove={()=>removeVerification("identity")} disabled={!editable || verificationProgress !== null} />
      {roles.has("deaf_tutor") ? <VerificationRow label="Deaf SASL tutor verification" state={verificationState("deaf")} storagePath={verifications.find(v=>v.type==="deaf")?.storage_path} onFile={e=>uploadVerification("deaf",e)} onRemove={()=>removeVerification("deaf")} disabled={!editable || verificationProgress !== null} /> : null}
      {roles.has("interpreter") ? <VerificationRow label="Interpreter assessment / evidence" state={verificationState("interpreter_assessment")} storagePath={verifications.find(v=>v.type==="interpreter_assessment")?.storage_path} onFile={e=>uploadVerification("interpreter_assessment",e)} onRemove={()=>removeVerification("interpreter_assessment")} disabled={!editable || verificationProgress !== null} /> : null}
      {verificationProgress !== null ? <UploadProgress label="Uploading verification file" progress={verificationProgress} /> : null}
      {verificationMessage ? <p className={`inline-feedback ${verificationMessageKind}`} aria-live="polite">{verificationMessage}</p> : null}
    </section>

    <section className="card">
      <div className="row"><div><h2>3. Introduction</h2><p>Video first, with optional written text.</p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
      <label>Public display name<input className="field" value={displayName} disabled={!editable} onChange={e=>setDisplayName(e.target.value)} /></label>
      <label>Introduction video<input className="field" type="file" accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime" disabled={!editable || introProgress !== null} onChange={uploadIntro} /><small className="upload-guidance">Accepted videos: MP4, WebM or MOV · Maximum 100 MB.</small></label>
      {introProgress !== null ? <UploadProgress label="Uploading introduction video" progress={introProgress} /> : null}
      {introVideoPath ? <div className="upload-summary"><div><strong>Introduction video uploaded.</strong><small>Ready for RealSign Admin review.</small></div>{editable ? <button type="button" className="mini-btn danger-text" onClick={removeIntroVideo}>Remove video</button> : null}</div> : null}
      <label>About me<textarea className="field" rows={5} value={introText} disabled={!editable} onChange={e=>setIntroText(e.target.value)} /></label>
      <div className="row wrap">{editable ? <button className="btn secondary" onClick={saveProfile}>Save introduction</button> : null}<button className="btn ghost" type="button" disabled>✨ Improve my writing — AI hook ready</button></div>
      {profileMessage ? <p className={`inline-feedback ${profileMessageKind}`} aria-live="polite">{profileMessage}</p> : null}
    </section>

    <LanguageSelector modes={languageModes} />

    <section className="card">
      <h2>4. Lessons, interpreting & rates</h2><p>Choose a service type, service option, length and price.</p>
      {services.length ? <div className="service-list">{services.map(s=><div className="service-row" key={s.id}><div><strong>{serviceLabel(s)}</strong><small>{s.duration_min} min · {roleLabel(s.provider_role)}</small>{serviceDetailLabel(s)?<small>Outline: {serviceDetailLabel(s)}</small>:null}</div><div className="service-action"><strong>R{(s.price_cents/100).toFixed(0)}</strong>{providerSettingsEditable ? <button type="button" className="mini-btn danger-text" disabled={busy} onClick={()=>removeService(s)}>Remove</button> : null}</div></div>)}</div> : <p className="muted">No services yet.</p>}
      {serviceMessage ? <p className={`service-feedback ${serviceMessageKind}`} aria-live="polite">{serviceMessage}</p> : null}
      {providerSettingsEditable ? <form className="form-grid" onSubmit={async e=>{e.preventDefault(); await createService(e.currentTarget);}}>
        <label>Role<select className="field" name="providerRole" required value={selectedServiceRole} onChange={e=>setServiceRole(e.target.value as ProviderRole)}>{Array.from(roles).map(r=><option key={r} value={r}>{PROVIDER_ROLES.find(x=>x.value===r)?.label}</option>)}</select></label>
        <label>Duration<select className="field" name="duration" value={serviceDuration} onChange={e=>setServiceDuration(Number(e.target.value))}>{SESSION_DURATIONS.map(d=><option key={d} value={d}>{d} minutes</option>)}</select></label>
        <label className="span2">Service option<select className="field" name="title" required>{serviceOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></label>
        <label>Price (R)<input className="field" name="price" type="number" min={minPrice ?? 0} max={maxPrice ?? undefined} step="1" required />{selectedRateRule ? <small className="price-guidance">Allowed price: R{minPrice?.toFixed(0)} to R{maxPrice?.toFixed(0)} for {serviceDuration} minutes.</small> : <small className="price-guidance">Choose a role and duration to see the allowed price range.</small>}</label>
        <button className="btn span2" disabled={!roles.size}>Add service</button>
      </form> : null}
    </section>

    <section className="card">
      <div className="row"><div><h2>5. Booking preferences</h2><p>Set your minimum notice time and break between sessions.</p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
      <div className="grid2">
         <label>Minimum notice before someone can book you<select className="field" disabled={!providerSettingsEditable} value={notice} onChange={e=>setNotice(Number(e.target.value))}>{BOOKING_NOTICE_OPTIONS.map(n=><option value={n} key={n}>{minutesLabel(n)}</option>)}</select><small>RealSign minimum: 1 hour</small></label>
         <label>Break between sessions<select className="field" disabled={!providerSettingsEditable} value={buffer} onChange={e=>setBuffer(Number(e.target.value))}>{BUFFER_OPTIONS.map(n=><option value={n} key={n}>{n} minutes</option>)}</select><small>RealSign minimum: 15 minutes</small></label>
      </div>
      {providerSettingsEditable ? <button className="btn secondary" onClick={saveBookingSettings}>Save preferences</button> : null}
      {bookingMessage ? <p className={`inline-feedback ${bookingMessageKind}`} aria-live="polite">{bookingMessage}</p> : null}
    </section>

    <section className="card">
      <h2>6. Submit</h2><p>RealSign Admin will review your profile and verification. Approval is required before you can be booked.</p>
      {editable ? <button className="btn" onClick={submitApplication}>Submit for approval</button> : null}
      {message ? <p className="muted" aria-live="polite">{message}</p> : null}
    </section>
  </div>;
}

function VerificationRow({label,state,storagePath,onFile,onRemove,disabled}:{label:string;state:VerificationState;storagePath?:string|null;onFile:(e:ChangeEvent<HTMLInputElement>)=>void;onRemove:()=>void;disabled:boolean}) {
  return <div className="verification-row"><div><strong>{label}</strong><small>{state === "approved" ? "Status: approved" : storagePath ? "Uploaded successfully · awaiting admin approval" : `Status: ${state.replaceAll("_"," ")}`}</small></div>{state === "approved" ? <span className="status approved">✓ Approved</span> : storagePath ? <div className="row wrap"><span className="status">Uploaded</span>{!disabled ? <button type="button" className="mini-btn danger-text" onClick={onRemove}>Remove file</button> : null}</div> : <label className="upload-btn">Upload<input hidden type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={disabled} onChange={onFile} /></label>}</div>;
}
