"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
type Rule = {id:string;weekday:number;start_time:string;end_time:string};
type BlockedDay = {id:string;date:string};
type MonthDay = {date:string;day:number;outside?:boolean;past?:boolean};

function dateInZone(zone:string){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const get=(type:string)=>parts.find(part=>part.type===type)?.value||"";
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

export default function AvailabilityEditor(){
  const supabase=useMemo(()=>createClient(),[]);
  const today=useMemo(()=>dateInZone("Africa/Johannesburg"),[]);
  const currentMonth=useMemo(()=>dateKey(parseDate(today).year,parseDate(today).month,1),[today]);
  const [visibleMonth,setVisibleMonth]=useState(currentMonth);
  const [providerId,setProviderId]=useState<string|null>(null);
  const [rules,setRules]=useState<Rule[]>([]);
  const [blockedDays,setBlockedDays]=useState<BlockedDay[]>([]);
  const [message,setMessage]=useState("Loading...");

  const load=useCallback(async()=>{
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){setMessage("Sign in to manage availability.");return;}
    const {data:p}=await supabase.from("provider_profiles").select("id").eq("user_id",auth.user.id).maybeSingle();
    if(!p){setMessage("Start your provider application first.");return;}
    setProviderId(p.id);
    const [rulesRes,blockedRes]=await Promise.all([
      supabase.from("availability_rules").select("id,weekday,start_time,end_time").eq("provider_id",p.id).eq("active",true).order("weekday"),
      supabase.from("availability_exceptions").select("id,date").eq("provider_id",p.id).eq("type","blocked").is("start_time",null).is("end_time",null).gte("date",today).order("date").limit(366)
    ]);
    setRules((rulesRes.data||[]) as Rule[]);
    setBlockedDays((blockedRes.data||[]) as BlockedDay[]);
    setMessage(rulesRes.error?.message||blockedRes.error?.message||"");
  },[supabase,today]);

  useEffect(()=>{load();},[load]);

  async function add(weekday:number){
    if(!providerId)return;
    const {error}=await supabase.from("availability_rules").insert({provider_id:providerId,weekday,start_time:"17:00",end_time:"20:00"});
    if(error)setMessage(error.message); else load();
  }

  async function remove(id:string){
    await supabase.from("availability_rules").delete().eq("id",id);
    load();
  }

  async function update(id:string,field:"start_time"|"end_time",value:string){
    setRules(rules.map(r=>r.id===id?{...r,[field]:value}:r));
    await supabase.from("availability_rules").update({[field]:value}).eq("id",id);
  }

  async function toggleBlockedDay(date:string){
    if(!providerId)return;
    const existing=blockedDays.find(day=>day.date===date);
    setMessage(existing?"Unblocking date...":"Blocking date...");
    if(existing){
      const {error}=await supabase.from("availability_exceptions").delete().eq("id",existing.id);
      if(error){setMessage(error.message);return;}
      setBlockedDays(days=>days.filter(day=>day.id!==existing.id));
      setMessage("Date unblocked.");
      return;
    }
    const {error}=await supabase.from("availability_exceptions").insert({provider_id:providerId,date,type:"blocked",start_time:null,end_time:null});
    if(error){setMessage(error.message);return;}
    await load();
    setMessage("Date blocked.");
  }

  const calendarDays=useMemo(()=>monthDays(visibleMonth,today),[visibleMonth,today]);
  const blockedMap=useMemo(()=>new Map(blockedDays.map(day=>[day.date,day])),[blockedDays]);
  const canGoBack=monthOffset(currentMonth,visibleMonth)>0;
  const canGoNext=monthOffset(currentMonth,visibleMonth)<5;

  return <section className="card"><div className="row"><div><h1>My Availability</h1><p>Set your normal weekly pattern once. RealSign uses your buffer time automatically and learners only see bookable times.</p></div><button className="help-btn">?</button></div><div className="notice"><strong>Simple setup</strong><br/>Add the days and times you usually teach or interpret. Then tap dates on the calendar when you want to block or unblock a whole day.</div><div className="availability-list">{DAYS.map((day,weekday)=>{const dayRules=rules.filter(r=>r.weekday===weekday);return <div className="availability-day" key={day}><div><strong>{day}</strong>{!dayRules.length?<small>Not available</small>:null}</div><div className="day-rules">{dayRules.map(r=><div className="time-row" key={r.id}><input type="time" value={r.start_time.slice(0,5)} onChange={e=>update(r.id,"start_time",e.target.value)}/><span>to</span><input type="time" value={r.end_time.slice(0,5)} onChange={e=>update(r.id,"end_time",e.target.value)}/><button className="mini-btn" onClick={()=>remove(r.id)}>Remove</button></div>)}<button className="mini-btn add-time" onClick={()=>add(weekday)}>+ Add time</button></div></div>})}</div><section className="blocked-days"><h2>Blocked dates</h2><p className="muted">Tap a day to block it. Tap the same day again to unblock it. Past dates cannot be changed.</p><div className="calendar-head"><button className="mini-btn" disabled={!canGoBack} onClick={()=>setVisibleMonth(addMonths(visibleMonth,-1))}>‹</button><strong>{monthLabel(visibleMonth)}</strong><button className="mini-btn" disabled={!canGoNext} onClick={()=>setVisibleMonth(addMonths(visibleMonth,1))}>›</button></div><div className="calendar-legend"><span><b className="legend-dot available"></b>Teaching / interpreting day</span><span><b className="legend-x">X</b>Blocked</span><span><b className="legend-dot unavailable"></b>Past</span></div><div className="booking-calendar provider-block-calendar" aria-label="Block unavailable dates">{WEEKDAYS.map(day=><div className="calendar-weekday" key={day}>{day}</div>)}{calendarDays.map(day=>{if(day.outside)return <div className="calendar-day empty" key={day.date}/>;const blocked=blockedMap.has(day.date);return <button key={day.date} type="button" disabled={day.past} className={`calendar-day ${blocked?"blocked has-slots":"no-slots"} ${day.past?"past":""}`} onClick={()=>toggleBlockedDay(day.date)} aria-pressed={blocked}><span className="day-number">{day.day}</span>{day.past?<span className="day-status">Past</span>:blocked?<span className="day-status blocked-label"><strong>X</strong><small>Blocked</small></span>:<span className="day-pill"><strong>Open</strong><small>Tap to block</small></span>}</button>})}</div>{blockedDays.length?<div className="blocked-summary"><strong>{blockedDays.length}</strong> upcoming blocked {blockedDays.length===1?"date":"dates"}</div>:<p className="muted">No upcoming blocked dates.</p>}</section>{message?<p className="muted" aria-live="polite">{message}</p>:null}<Link className="btn secondary" href="/provider/application">Back to application</Link></section>;
}
