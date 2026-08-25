"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LanguageSelector from "@/components/LanguageSelector";
import { createClient } from "@/lib/supabase/client";
import { roleLabel, serviceDetailLabel, serviceLabel } from "@/lib/marketplace";
import { BOOKING_NOTICE_OPTIONS, BUFFER_OPTIONS, PROVIDER_ROLES, SESSION_DURATIONS, minutesLabel } from "@/lib/provider";
import type { ProviderRole, ProviderStatus, VerificationState, VerificationType } from "@/lib/domain";

type Service = { id: string; title: string; duration_min: number; price_cents: number; status: string; provider_role: ProviderRole };
type Verification = { type: VerificationType; state: VerificationState; storage_path: string | null };
type RateRule = { provider_role: ProviderRole; duration_min: number; min_price_cents: number; max_price_cents: number };

const HELP_LABEL = "Open SASL help";
const ACTIVE_PROVIDER_ROLES: ProviderRole[] = ["deaf_tutor", "interpreter"];
const SERVICE_OPTIONS: Record<ProviderRole, string[]> = {
  deaf_tutor: [
    "Beginner SASL: introductions and greetings",
    "Beginner SASL: fingerspelling and numbers",
    "Everyday SASL conversation practice",
    "SASL vocabulary practice",
    "SASL homework or revision support",
  ],
  interpreter: [
    "Video Call SASL Interpreting",
    "Education SASL Interpreting",
    "Work or appointment SASL Interpreting",
    "General SASL Interpreting",
  ],
  qualified_deaf_teacher: [],
};

export default function ProviderApplication() {
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus>("draft");
  const [displayName, setDisplayName] = useState("");
  const [introText, setIntroText] = useState("");
  const [roles, setRoles] = useState<Set<ProviderRole>>(new Set());
  const [services, setServices] = useState<Service[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [notice, setNotice] = useState(120);
  const [buffer, setBuffer] = useState(15);
  const [serviceRole, setServiceRole] = useState<ProviderRole>("deaf_tutor");
  const [serviceDuration, setServiceDuration] = useState(30);
  const [rateRules, setRateRules] = useState<RateRule[]>([]);

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
      supabase.from("provider_profiles").select("status,public_display_name,introduction_text").eq("id", pid).single(),
      supabase.from("provider_roles").select("role").eq("provider_id", pid),
      supabase.from("provider_services").select("id,title,duration_min,price_cents,status,provider_role").eq("provider_id", pid).order("created_at"),
      supabase.from("verification_records").select("type,state,storage_path").eq("provider_id", pid),
      supabase.from("provider_booking_settings").select("booking_notice_min,buffer_min").eq("provider_id", pid).single(),
      supabase.from("rate_rules").select("provider_role,duration_min,min_price_cents,max_price_cents").eq("active", true),
    ]);
    if (profileRes.data) {
      setStatus(profileRes.data.status as ProviderStatus);
      setDisplayName(profileRes.data.public_display_name || "");
      setIntroText(profileRes.data.introduction_text || "");
    }
    setRoles(new Set((roleRes.data || []).map((r: { role: ProviderRole }) => r.role).filter(role => ACTIVE_PROVIDER_ROLES.includes(role))));
    setServices((serviceRes.data || []) as Service[]);
    setVerifications((verifyRes.data || []) as Verification[]);
    setRateRules((rateRulesRes.data || []) as RateRule[]);
    if (settingsRes.data) { setNotice(settingsRes.data.booking_notice_min); setBuffer(settingsRes.data.buffer_min); }
    setBusy(false);
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  async function saveRoles() {
    if (!providerId) return;
    setMessage("Saving roles…");
    const { error: del } = await supabase.from("provider_roles").delete().eq("provider_id", providerId);
    if (del) return setMessage(del.message);
    if (roles.size) {
      const { error } = await supabase.from("provider_roles").insert(Array.from(roles).map(role => ({ provider_id: providerId, role })));
      if (error) return setMessage(error.message);
    }
    setMessage("Provider roles saved ✓");
  }

  async function saveProfile() {
    if (!providerId) return;
    setMessage("Saving profile…");
    const { error } = await supabase.from("provider_profiles").update({ public_display_name: displayName, introduction_text: introText }).eq("id", providerId);
    setMessage(error ? error.message : "Profile saved ✓");
  }

  async function uploadIntro(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId || !providerId) return;
    setMessage("Uploading introduction video…");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/intro/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("provider-media").upload(path, file, { upsert: false });
    if (uploadError) return setMessage(uploadError.message);
    const { error } = await supabase.from("provider_profiles").update({ introduction_video_path: path }).eq("id", providerId);
    setMessage(error ? error.message : "Introduction video uploaded ✓");
  }

  async function uploadVerification(type: VerificationType, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId || !providerId) return;
    setMessage("Uploading verification document…");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${userId}/${type}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("verification-documents").upload(path, file, { upsert: false });
    if (uploadError) return setMessage(uploadError.message);
    const existing = verifications.find(v => v.type === type);
    const payload = { provider_id: providerId, type, state: "pending", storage_path: path, submitted_at: new Date().toISOString() };
    const query = existing
      ? supabase.from("verification_records").update(payload).eq("provider_id", providerId).eq("type", type)
      : supabase.from("verification_records").insert(payload);
    const { error } = await query;
    if (error) return setMessage(error.message);
    setMessage("Verification submitted ✓");
    await refresh();
  }

  async function createService(form: HTMLFormElement) {
    if (!providerId) return;
    const data = new FormData(form);
    const providerRole = String(data.get("providerRole")) as ProviderRole;
    const duration = Number(data.get("duration"));
    const priceRands = Number(data.get("price"));
    const title = String(data.get("title") || "").trim();
    const { data: rule } = await supabase.from("rate_rules").select("min_price_cents,max_price_cents").eq("provider_role", providerRole).eq("duration_min", duration).eq("active", true).maybeSingle();
    const cents = Math.round(priceRands * 100);
    if (rule && (cents < rule.min_price_cents || cents > rule.max_price_cents)) {
      setMessage(`Price must be between R${(rule.min_price_cents/100).toFixed(0)} and R${(rule.max_price_cents/100).toFixed(0)}.`); return;
    }
    const { error } = await supabase.from("provider_services").insert({ provider_id: providerId, provider_role: providerRole, subject_id: null, title, duration_min: duration, price_cents: cents, status: "active", remote: true });
    setMessage(error ? error.message : "Service added ✓");
    if (!error) { form.reset(); await refresh(); }
  }

  async function saveBookingSettings() {
    if (!providerId) return;
    const { error } = await supabase.from("provider_booking_settings").update({ booking_notice_min: notice, buffer_min: buffer }).eq("provider_id", providerId);
    setMessage(error ? error.message : "Booking settings saved ✓");
  }

  async function submitApplication() {
    if (!roles.size) return setMessage("Choose at least one provider role first.");
    const { error } = await supabase.rpc("submit_provider_application");
    setMessage(error ? error.message : "Application submitted to RealSign Admin ✓");
    if (!error) await refresh();
  }

  if (busy) return <section className="card"><h1>Provider application</h1><p>Loading…</p></section>;
  if (!userId) return <section className="card"><h1>Become a provider</h1><p>Sign in before starting your application.</p><Link className="btn" href="/sign-in">Sign in</Link></section>;

  const verificationState = (type: VerificationType) => verifications.find(v => v.type === type)?.state || "not_submitted";
  const editable = status === "draft" || status === "rejected";
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
      <div className="row"><div><h1>Provider application</h1><p>Status: <strong>{status.replaceAll("_", " ")}</strong></p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
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
    </section>

    <section className="card">
      <h2>2. Verification</h2>
      <VerificationRow label="Identity" state={verificationState("identity")} onFile={e=>uploadVerification("identity",e)} disabled={!editable} />
      {roles.has("deaf_tutor") ? <VerificationRow label="Deaf SASL tutor verification" state={verificationState("deaf")} onFile={e=>uploadVerification("deaf",e)} disabled={!editable} /> : null}
      {roles.has("interpreter") ? <VerificationRow label="Interpreter assessment / evidence" state={verificationState("interpreter_assessment")} onFile={e=>uploadVerification("interpreter_assessment",e)} disabled={!editable} /> : null}
    </section>

    <section className="card">
      <div className="row"><div><h2>3. Introduction</h2><p>Video first, with optional written text.</p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
      <label>Public display name<input className="field" value={displayName} disabled={!editable} onChange={e=>setDisplayName(e.target.value)} /></label>
      <label>Introduction video<input className="field" type="file" accept="video/*" disabled={!editable} onChange={uploadIntro} /></label>
      <label>About me<textarea className="field" rows={5} value={introText} disabled={!editable} onChange={e=>setIntroText(e.target.value)} /></label>
      <div className="row wrap">{editable ? <button className="btn secondary" onClick={saveProfile}>Save introduction</button> : null}<button className="btn ghost" type="button" disabled>✨ Improve my writing — AI hook ready</button></div>
    </section>

    <LanguageSelector modes={languageModes} />

    <section className="card">
      <h2>4. Lessons, interpreting & rates</h2><p>Choose a service type, service option, length and price.</p>
      {services.length ? <div className="service-list">{services.map(s=><div className="service-row" key={s.id}><div><strong>{serviceLabel(s)}</strong><small>{s.duration_min} min · {roleLabel(s.provider_role)}</small>{serviceDetailLabel(s)?<small>Outline: {serviceDetailLabel(s)}</small>:null}</div><strong>R{(s.price_cents/100).toFixed(0)}</strong></div>)}</div> : <p className="muted">No services yet.</p>}
      {editable ? <form className="form-grid" onSubmit={async e=>{e.preventDefault(); await createService(e.currentTarget);}}>
        <label>Role<select className="field" name="providerRole" required value={selectedServiceRole} onChange={e=>setServiceRole(e.target.value as ProviderRole)}>{Array.from(roles).map(r=><option key={r} value={r}>{PROVIDER_ROLES.find(x=>x.value===r)?.label}</option>)}</select></label>
        <label>Duration<select className="field" name="duration" value={serviceDuration} onChange={e=>setServiceDuration(Number(e.target.value))}>{SESSION_DURATIONS.map(d=><option key={d} value={d}>{d} minutes</option>)}</select></label>
        <label className="span2">Service option<select className="field" name="title" required>{serviceOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></label>
        <label>Price (R)<input className="field" name="price" type="number" min={minPrice ?? 0} max={maxPrice ?? undefined} step="1" required />{selectedRateRule ? <small className="price-guidance">Allowed price: R{minPrice?.toFixed(0)} to R{maxPrice?.toFixed(0)} for {serviceDuration} minutes.</small> : <small className="price-guidance">Choose a role and duration to see the allowed price range.</small>}</label>
        <button className="btn span2" disabled={!roles.size}>Add service</button>
      </form> : null}
    </section>

    <section className="card">
      <div className="row"><div><h2>5. Booking settings</h2><p>RealSign protects preparation and rest time.</p></div><button className="help-btn" aria-label={HELP_LABEL}>?</button></div>
      <div className="grid2">
        <label>Minimum notice<select className="field" disabled={!editable} value={notice} onChange={e=>setNotice(Number(e.target.value))}>{BOOKING_NOTICE_OPTIONS.map(n=><option value={n} key={n}>{minutesLabel(n)}</option>)}</select><small>RealSign minimum: 1 hour</small></label>
        <label>Break between sessions<select className="field" disabled={!editable} value={buffer} onChange={e=>setBuffer(Number(e.target.value))}>{BUFFER_OPTIONS.map(n=><option value={n} key={n}>{n} minutes</option>)}</select><small>RealSign minimum: 15 minutes</small></label>
      </div>
      {editable ? <button className="btn secondary" onClick={saveBookingSettings}>Save booking settings</button> : null}
      <Link className="btn ghost" href="/provider/availability">Set weekly availability →</Link>
    </section>

    <section className="card">
      <h2>6. Submit</h2><p>RealSign Admin will review your profile and verification. Approval is required before you can be booked.</p>
      {editable ? <button className="btn" onClick={submitApplication}>Submit for approval</button> : null}
      {message ? <p className="muted" aria-live="polite">{message}</p> : null}
    </section>
  </div>;
}

function VerificationRow({label,state,onFile,disabled}:{label:string;state:VerificationState;onFile:(e:ChangeEvent<HTMLInputElement>)=>void;disabled:boolean}) {
  return <div className="verification-row"><div><strong>{label}</strong><small>Status: {state.replaceAll("_"," ")}</small></div>{state === "approved" ? <span className="status approved">✓ Approved</span> : <label className="upload-btn">Upload<input hidden type="file" disabled={disabled} onChange={onFile} /></label>}</div>;
}
