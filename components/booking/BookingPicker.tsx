"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money, PublicProvider } from "@/lib/marketplace";

type Service = PublicProvider["services"][number];
type Slot = { start_at:string; end_at:string };

function dateInZone(zone:string){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export default function BookingPicker({provider,service}:{provider:PublicProvider;service:Service}){
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter();
  const zone=provider.booking_settings?.timezone||"Africa/Johannesburg";
  const [date,setDate]=useState(()=>dateInZone(zone)); const [slots,setSlots]=useState<Slot[]>([]); const [selected,setSelected]=useState<Slot|null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  const [learnerFor,setLearnerFor]=useState("myself"); const [firstName,setFirstName]=useState(""); const [grade,setGrade]=useState(""); const [note,setNote]=useState("");
  useEffect(()=>{(async()=>{setBusy(true);setSelected(null);const {data,error}=await supabase.rpc("get_service_slots",{p_service_id:service.id,p_date:date});setSlots((data||[]) as Slot[]);setMessage(error?.message||"");setBusy(false);})();},[date,service.id,supabase]);
  async function continueBooking(){ if(!selected)return; setBusy(true); setMessage(""); const {data:auth}=await supabase.auth.getUser(); if(!auth.user){router.push("/sign-in");return;} const {data:identity}=await supabase.from("user_identity_verifications").select("state").eq("user_id",auth.user.id).maybeSingle(); if(identity?.state!=="approved"){setBusy(false);setMessage("Identity verification is required before booking.");return;} const {data,error}=await supabase.rpc("create_booking_hold",{p_service_id:service.id,p_start_at:selected.start_at,p_learner_for:learnerFor,p_learner_first_name:firstName||null,p_learner_grade:grade?Number(grade):null,p_learner_note:note||null}); if(error){setBusy(false);setMessage(error.message);return;} router.push(`/checkout/${data.hold_id}`); }
  return <div className="stack"><section className="card"><h1>Book {provider.display_name}</h1><p><strong>{service.title}</strong><br/>{service.duration_min} minutes · {money(service.price_cents)}</p><label>Choose date<input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><div className="slot-grid">{busy?<span className="muted">Checking availability…</span>:slots.map(s=><button key={s.start_at} className={`slot-btn ${selected?.start_at===s.start_at?"selected":""}`} onClick={()=>setSelected(s)}>{new Intl.DateTimeFormat("en-ZA",{timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(s.start_at))}</button>)}</div>{!busy&&!slots.length?<p className="muted">No available times on this date.</p>:null}</section>
  {selected?<section className="card"><h2>Who is this session for?</h2><label className="check"><input type="radio" checked={learnerFor==="myself"} onChange={()=>setLearnerFor("myself")}/> Myself</label><label className="check"><input type="radio" checked={learnerFor==="child_or_dependent"} onChange={()=>setLearnerFor("child_or_dependent")}/> My child / dependent</label><label className="check"><input type="radio" checked={learnerFor==="assisted_person"} onChange={()=>setLearnerFor("assisted_person")}/> Someone I am assisting</label>{learnerFor!=="myself"?<label>Learner first name<input className="field" value={firstName} onChange={e=>setFirstName(e.target.value)}/></label>:null}<label>Grade (optional)<input className="field" type="number" min="0" max="12" value={grade} onChange={e=>setGrade(e.target.value)}/></label><label>Anything useful for the tutor? (optional)<textarea className="field" rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="btn" disabled={busy} onClick={continueBooking}>Continue to checkout</button>{message?<p className="notice">{message} {message.includes("Identity")?<a href="/profile/identity"><strong>Open identity verification →</strong></a>:null}</p>:null}</section>:null}</div>;
}
