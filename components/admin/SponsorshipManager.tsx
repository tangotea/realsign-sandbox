"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Person = { id: string; display_name: string | null };

export default function SponsorshipManager({ funds, users, providers }: { funds: any[]; users: Person[]; providers: Person[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(body: any) {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/admin/sponsorships", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setBusy(false);
    setMsg(r.ok ? "Saved." : j.error || "Unable to save");
    if (r.ok) router.refresh();
  }

  return <div className="stack">
    <form className="card" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); send({ action: "create_fund", sponsorName: f.get("sponsorName"), fundName: f.get("fundName"), contributionCents: Math.round(Number(f.get("amount")) * 100), adminFeeBps: Math.round(Number(f.get("fee")) * 100), scope: f.get("scope"), maxPerBookingCents: Math.round(Number(f.get("maxBooking") || 0) * 100) || null, maxPerUserMonthCents: Math.round(Number(f.get("maxMonth") || 0) * 100) || null }); }}>
      <h2>Create sponsor fund</h2>
      <label>Sponsor name<input className="field" name="sponsorName" required /></label>
      <label>Fund / programme name<input className="field" name="fundName" required /></label>
      <div className="form-grid">
        <label>Contribution (R)<input className="field" type="number" min="1" step="0.01" name="amount" required /></label>
        <label>RealSign administration fee (%)<input className="field" type="number" min="0" max="100" step="0.1" name="fee" defaultValue="7.5" /></label>
        <label>Credit scope<select className="field" name="scope" defaultValue="interpreter_only"><option value="interpreter_only">Interpreter only</option><option value="tutor_teacher_only">Tutor / Teacher only</option><option value="any_service">Any eligible service</option></select></label>
        <label>Maximum subsidy per booking (R, optional)<input className="field" type="number" min="0" step="1" name="maxBooking" /></label>
        <label>Maximum per user/month (R, optional)<input className="field" type="number" min="0" step="1" name="maxMonth" /></label>
      </div>
      <button className="btn" disabled={busy}>Create fund</button>
    </form>

    <form className="card" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); send({ action: "allocate", fundId: f.get("fundId"), userId: f.get("userId") === "general" ? null : f.get("userId"), amountCents: Math.round(Number(f.get("amount")) * 100), scope: f.get("scope"), endDate: f.get("endDate") || null }); }}>
      <h2>Allocate sponsored credit</h2>
      <label>Fund<select className="field" name="fundId" required><option value="">Choose fund</option>{funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>Recipient<select className="field" name="userId" defaultValue="general"><option value="general">General Deaf Access Pool</option>{users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.id}</option>)}</select></label>
      <div className="form-grid">
        <label>Amount (R)<input className="field" type="number" min="1" step="0.01" name="amount" required /></label>
        <label>Can be used for<select className="field" name="scope" defaultValue="interpreter_only"><option value="interpreter_only">Interpreter only</option><option value="tutor_teacher_only">Tutor / Teacher only</option><option value="any_service">Any eligible RealSign service</option></select></label>
        <label>Allocation end date<input className="field" type="date" name="endDate" /></label>
      </div>
      <button className="btn" disabled={busy}>Allocate credit</button>
      <p className="muted">A user-level allocation returns to the originating fund when it ends unused. General-pool use requires Deaf verification.</p>
    </form>

    <form className="card" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); send({ action: "allocate_group", fundId: f.get("fundId"), userIds: f.getAll("userIds"), amountCents: Math.round(Number(f.get("amount")) * 100), scope: f.get("scope"), endDate: f.get("endDate") || null }); }}>
      <h2>Allocate to selected providers</h2>
      <p className="muted">Select one or more approved providers. The amount is allocated to each selected provider.</p>
      <label>Fund<select className="field" name="fundId" required><option value="">Choose fund</option>{funds.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <fieldset className="provider-recipient-list">
        <legend>Choose providers</legend>
        {providers.map(u => <label className="check" key={u.id}><input type="checkbox" name="userIds" value={u.id} /><span>{u.display_name || u.id}</span></label>)}
        {!providers.length ? <p className="muted">No approved providers are available.</p> : null}
      </fieldset>
      <div className="form-grid">
        <label>Amount per provider (R)<input className="field" type="number" min="1" step="0.01" name="amount" required /></label>
        <label>Can be used for<select className="field" name="scope" defaultValue="interpreter_only"><option value="interpreter_only">Interpreter only</option><option value="tutor_teacher_only">Tutor / Teacher only</option><option value="any_service">Any eligible RealSign service</option></select></label>
        <label>Allocation end date<input className="field" type="date" name="endDate" /></label>
      </div>
      <button className="btn" disabled={busy || !providers.length}>Allocate to providers</button>
    </form>
    {msg ? <p className="notice" role="status">{msg}</p> : null}
  </div>;
}
