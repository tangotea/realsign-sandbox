"use client";

import { useState } from "react";
import Link from "next/link";
import BookingRole from "./BookingRole";
import { related } from "@/lib/bookingRole";
import { money, serviceLabel } from "@/lib/marketplace";

export default function BookingList({ bookings, now }: { bookings: any[]; now: number }) {
  const [view, setView] = useState("Upcoming");
  const visible = bookings.filter(b => {
    const cancelled = b.state.startsWith("cancel") || b.state === "refunded";
    const past = new Date(b.end_at).getTime() <= now || ["completed", "no_show"].includes(b.state);
    return view === "Cancelled" ? cancelled : view === "Past" ? !cancelled && past : !cancelled && !past;
  }).sort((a,b) => view === "Upcoming" ? Date.parse(a.start_at)-Date.parse(b.start_at) : Date.parse(b.start_at)-Date.parse(a.start_at));
  return <>
    <div className="booking-filter-switch" role="group" aria-label="Filter bookings">
      {["Upcoming", "Past", "Cancelled"].map(label => <button type="button" className="mini-btn" key={label} aria-pressed={view === label} onClick={() => setView(label)}>{label}</button>)}
    </div>
    <div className="stack" aria-live="polite">
      {visible.map(b => <section className="card" key={b.id}>
        <BookingRole serviceRole={related<any>(b.provider_services)?.provider_role} providing={b.providing} />
        <span className="status">{b.state.replaceAll("_", " ")}</span>
        <h2>{b.providing ? b.learner_first_name || "Client" : related<any>(b.provider_profiles)?.public_display_name}</h2>
        <p>{serviceLabel(related<any>(b.provider_services))}<br />{new Date(b.start_at).toLocaleString()} · {money(b.price_cents)}</p>
        <small>{b.reference}</small>
        <div style={{marginTop:12}}><Link className="mini-btn" href={`/bookings/${b.id}`}>Manage booking</Link></div>
      </section>)}
      {!visible.length ? <p>No {view.toLowerCase()} bookings.</p> : null}
    </div>
  </>;
}
