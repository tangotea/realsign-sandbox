"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { money, PublicProvider, serviceDetailLabel, serviceLabel } from "@/lib/marketplace";

type Service = PublicProvider["services"][number];
type Slot = { start_at:string; end_at:string };
type MonthDay = { date: string; day: number; outside?: boolean; past?: boolean };

function dateInZone(zone:string){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(t:string)=>parts.find(p=>p.type===t)?.value||"";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseDate(value:string){
  const [year,month,day]=value.split("-").map(Number);
  return {year,month,day};
}

function dateKey(year:number,month:number,day:number){
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function addMonths(value:string,delta:number){
  const {year,month}=parseDate(value);
  const next=new Date(Date.UTC(year,month-1+delta,1));
  return dateKey(next.getUTCFullYear(),next.getUTCMonth()+1,1);
}

function monthOffset(from:string,to:string){
  const a=parseDate(from),b=parseDate(to);
  return (b.year-a.year)*12+(b.month-a.month);
}

function monthLabel(value:string){
  const {year,month}=parseDate(value);
  return new Intl.DateTimeFormat("en-ZA",{month:"long",year:"numeric"}).format(new Date(Date.UTC(year,month-1,1)));
}

function monthDays(monthValue:string,today:string){
  const {year,month}=parseDate(monthValue);
  const first=new Date(Date.UTC(year,month-1,1));
  const daysInMonth=new Date(Date.UTC(year,month,0)).getUTCDate();
  const leading=(first.getUTCDay()+6)%7;
  const cells:MonthDay[]=[];
  for(let i=0;i<leading;i++)cells.push({date:`blank-${i}`,day:0,outside:true});
  for(let day=1;day<=daysInMonth;day++){
    const date=dateKey(year,month,day);
    cells.push({date,day,past:date<today});
  }
  while(cells.length%7)cells.push({date:`blank-${cells.length}`,day:0,outside:true});
  return cells;
}

function timeLabel(slot:Slot,zone:string){
  return new Intl.DateTimeFormat("en-ZA",{timeZone:zone,hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(slot.start_at));
}

export default function BookingPicker({provider,service,services}:{provider:PublicProvider;service:Service;services?:Service[]}){
  const supabase=useMemo(()=>createClient(),[]); const router=useRouter();
  const serviceChoices=useMemo(()=>{const all=services?.length?services:[service];return all.filter((s,i,a)=>a.findIndex(x=>x.id===s.id)===i);},[service,services]);
  const [serviceId,setServiceId]=useState(service.id);
  useEffect(()=>{setServiceId(service.id);},[service.id]);
  const selectedService=serviceChoices.find(s=>s.id===serviceId)||service;
  const zone=provider.booking_settings?.timezone||"Africa/Johannesburg";
  const today=useMemo(()=>dateInZone(zone),[zone]);
  const currentMonth=useMemo(()=>dateKey(parseDate(today).year,parseDate(today).month,1),[today]);
  const maxMonthOffset=selectedService.provider_role==="interpreter"?3:2;
  const [visibleMonth,setVisibleMonth]=useState(currentMonth);
  const [date,setDate]=useState(today);
  const [monthSlots,setMonthSlots]=useState<Record<string,Slot[]>>({});
  const [selected,setSelected]=useState<Slot|null>(null); const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  const [learnerFor,setLearnerFor]=useState("myself"); const [firstName,setFirstName]=useState(""); const [grade,setGrade]=useState(""); const [note,setNote]=useState("");
  useEffect(()=>{setVisibleMonth(currentMonth);setDate(today);},[currentMonth,today,selectedService.id]);
  const calendarDays=useMemo(()=>monthDays(visibleMonth,today),[visibleMonth,today]);
  const selectedSlots=monthSlots[date]||[];
  useEffect(()=>{let active=true;(async()=>{setBusy(true);setMessage("");const results=await Promise.all(calendarDays.filter(d=>!d.outside&&!d.past).map(async d=>{const {data,error}=await supabase.rpc("get_service_slots",{p_service_id:selectedService.id,p_date:d.date});return [d.date,{slots:(data||[]) as Slot[],error:error?.message||""}] as const;}));if(!active)return;const next:Record<string,Slot[]>={};let errorMessage="";for(const [day,result] of results){next[day]=result.slots;if(result.error&&!errorMessage)errorMessage=result.error;}setMonthSlots(next);setMessage(errorMessage);setSelected(null);setBusy(false);})();return()=>{active=false};},[calendarDays,selectedService.id,supabase]);
  async function continueBooking(){ if(!selected)return; setBusy(true); setMessage(""); const {data:auth}=await supabase.auth.getUser(); if(!auth.user){router.push("/sign-in");return;} const {data:identity}=await supabase.from("user_identity_verifications").select("state").eq("user_id",auth.user.id).maybeSingle(); if(identity?.state!=="approved"){setBusy(false);setMessage("Identity verification is required before booking.");return;} const {data,error}=await supabase.rpc("create_booking_hold",{p_service_id:selectedService.id,p_start_at:selected.start_at,p_learner_for:learnerFor,p_learner_first_name:firstName||null,p_learner_grade:grade?Number(grade):null,p_learner_note:note||null}); if(error){setBusy(false);setMessage(error.message);return;} router.push(`/checkout/${data.hold_id}`); }
  const canGoBack=monthOffset(currentMonth,visibleMonth)>0;
  const canGoNext=monthOffset(currentMonth,visibleMonth)<maxMonthOffset;
  return <div className="stack"><section className="card"><h1>Book {provider.display_name}</h1>{serviceChoices.length>1?<div className="service-picker" role="group" aria-label="Choose lesson length">{serviceChoices.map(s=><button key={s.id} type="button" className={s.id===selectedService.id?"selected":""} onClick={()=>{setServiceId(s.id);setSelected(null);}}><strong>{s.duration_min} min</strong><small>{money(s.price_cents)} · {serviceLabel(s)}</small></button>)}</div>:null}<p><strong>{serviceLabel(selectedService)}</strong><br/>{selectedService.duration_min} minutes · {money(selectedService.price_cents)}{serviceDetailLabel(selectedService)?<><br/><span className="muted">{serviceDetailLabel(selectedService)}</span></>:null}</p><div className="calendar-head"><button className="mini-btn" disabled={!canGoBack} onClick={()=>setVisibleMonth(addMonths(visibleMonth,-1))}>‹</button><strong>{monthLabel(visibleMonth)}</strong><button className="mini-btn" disabled={!canGoNext} onClick={()=>setVisibleMonth(addMonths(visibleMonth,1))}>›</button></div><div className="calendar-legend"><span><b className="legend-dot available"></b>Available</span><span><b className="legend-dot unavailable"></b>Unavailable</span><span><b className="legend-x">X</b>Blocked or closed</span></div><div className="booking-calendar" aria-label="Choose a day">{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=><div className="calendar-weekday" key={day}>{day}</div>)}{calendarDays.map(day=>{if(day.outside)return <div className="calendar-day empty" key={day.date}/>;const slots=monthSlots[day.date]||[];const isSelected=date===day.date;const hasSlots=slots.length>0;return <button key={day.date} type="button" disabled={day.past||!hasSlots} className={`calendar-day ${isSelected?"selected":""} ${hasSlots?"has-slots":"no-slots"} ${day.past?"past":""}`} onClick={()=>{setDate(day.date);setSelected(null);}}><span className="day-number">{day.day}</span>{day.past?<span className="day-status">Past</span>:hasSlots?<span className="day-pill"><strong>{slots.length===1?timeLabel(slots[0],zone):`${slots.length} slots`}</strong><small>Available</small></span>:<span className="day-status"><strong>X</strong><small>Unavailable</small></span>}</button>})}</div><div className="selected-day"><strong>{date}</strong>{busy?<p className="muted">Checking availability...</p>:selectedSlots.length?<div className="slot-grid">{selectedSlots.map(s=><button key={s.start_at} className={`slot-btn ${selected?.start_at===s.start_at?"selected":""}`} onClick={()=>setSelected(s)}><strong>{timeLabel(s,zone)}</strong><small>Available</small></button>)}</div>:<p className="muted">No available times on this date. Choose a green day.</p>}</div></section>
  {selected?<section className="card"><h2>Who is this session for?</h2><label className="check"><input type="radio" checked={learnerFor==="myself"} onChange={()=>setLearnerFor("myself")}/> Myself</label><label className="check"><input type="radio" checked={learnerFor==="child_or_dependent"} onChange={()=>setLearnerFor("child_or_dependent")}/> My child / dependent</label><label className="check"><input type="radio" checked={learnerFor==="assisted_person"} onChange={()=>setLearnerFor("assisted_person")}/> Someone I am assisting</label>{learnerFor!=="myself"?<label>Learner first name<input className="field" value={firstName} onChange={e=>setFirstName(e.target.value)}/></label>:null}<label>Grade (optional)<input className="field" type="number" min="0" max="12" value={grade} onChange={e=>setGrade(e.target.value)}/></label><label>Anything useful for the tutor? (optional)<textarea className="field" rows={3} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="btn" disabled={busy} onClick={continueBooking}>Continue to checkout</button>{message?<p className="notice">{message} {message.includes("Identity")?<a href="/profile/identity"><strong>Open identity verification →</strong></a>:null}</p>:null}</section>:null}</div>;
}
