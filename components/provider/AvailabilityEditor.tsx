"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const WEEKDAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const REPEAT_DAYS = [
  {weekday:1,label:"M",name:"Mon"},
  {weekday:2,label:"T",name:"Tue"},
  {weekday:3,label:"W",name:"Wed"},
  {weekday:4,label:"T",name:"Thu"},
  {weekday:5,label:"F",name:"Fri"},
  {weekday:6,label:"S",name:"Sat"},
  {weekday:0,label:"S",name:"Sun"},
];

type Rule = {id:string;weekday:number;start_time:string;end_time:string;active:boolean};
type BlockedDay = {id:string;date:string};
type MonthDay = {date:string;day:number;outside?:boolean;past?:boolean};
type AvailabilityBlock = {key:string;ids:string[];weekdays:number[];start_time:string;end_time:string;active:boolean};

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

function cleanTime(value:string){
  return value.slice(0,5);
}

function timeValue(minutes:number){
  return `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
}

function minutesFromTime(value:string){
  const [hour,minute]=cleanTime(value).split(":").map(Number);
  return hour*60+minute;
}

function groupRules(rules:Rule[]){
  const groups=new Map<string,AvailabilityBlock>();
  for(const rule of rules){
    const start=cleanTime(rule.start_time);
    const end=cleanTime(rule.end_time);
    const key=`${start}-${end}-${rule.active}`;
    const current=groups.get(key)||{key,ids:[],weekdays:[],start_time:start,end_time:end,active:rule.active};
    current.ids.push(rule.id);
    current.weekdays.push(rule.weekday);
    groups.set(key,current);
  }
  return [...groups.values()].map(group=>({
    ...group,
    weekdays:[...new Set(group.weekdays)].sort((a,b)=>REPEAT_DAYS.findIndex(d=>d.weekday===a)-REPEAT_DAYS.findIndex(d=>d.weekday===b))
  })).sort((a,b)=>minutesFromTime(a.start_time)-minutesFromTime(b.start_time));
}

const TIME_OPTIONS=Array.from({length:96},(_,index)=>timeValue(index*15));

export default function AvailabilityEditor(){
  const supabase=useMemo(()=>createClient(),[]);
  const today=useMemo(()=>dateInZone("Africa/Johannesburg"),[]);
  const currentMonth=useMemo(()=>dateKey(parseDate(today).year,parseDate(today).month,1),[today]);
  const [visibleMonth,setVisibleMonth]=useState(currentMonth);
  const [providerId,setProviderId]=useState<string|null>(null);
  const [rules,setRules]=useState<Rule[]>([]);
  const [blockedDays,setBlockedDays]=useState<BlockedDay[]>([]);
  const [newStart,setNewStart]=useState("17:00");
  const [newEnd,setNewEnd]=useState("20:00");
  const [newDays,setNewDays]=useState<number[]>([1,2,3,4,5]);
  const [message,setMessage]=useState("Loading...");

  const load=useCallback(async()=>{
    const {data:auth}=await supabase.auth.getUser();
    if(!auth.user){setMessage("Sign in to manage availability.");return;}
    const {data:p}=await supabase.from("provider_profiles").select("id").eq("user_id",auth.user.id).maybeSingle();
    if(!p){setMessage("Start your provider application first.");return;}
    setProviderId(p.id);
    const [rulesRes,blockedRes]=await Promise.all([
      supabase.from("availability_rules").select("id,weekday,start_time,end_time,active").eq("provider_id",p.id).order("start_time"),
      supabase.from("availability_exceptions").select("id,date").eq("provider_id",p.id).eq("type","blocked").is("start_time",null).is("end_time",null).gte("date",today).order("date").limit(366)
    ]);
    setRules(((rulesRes.data||[]) as Rule[]).map(rule=>({...rule,start_time:cleanTime(rule.start_time),end_time:cleanTime(rule.end_time)})));
    setBlockedDays((blockedRes.data||[]) as BlockedDay[]);
    setMessage(rulesRes.error?.message||blockedRes.error?.message||"");
  },[supabase,today]);

  useEffect(()=>{load();},[load]);

  async function addAvailability(){
    if(!providerId)return;
    if(!newDays.length){setMessage("Choose at least one repeat day.");return;}
    if(minutesFromTime(newEnd)<=minutesFromTime(newStart)){setMessage("End time must be after start time.");return;}
    setMessage("Adding availability...");
    const rows=newDays.map(weekday=>({provider_id:providerId,weekday,start_time:newStart,end_time:newEnd,active:true}));
    const {error}=await supabase.from("availability_rules").insert(rows);
    if(error){setMessage(error.message);return;}
    setMessage("Availability added.");
    await load();
  }

  async function deleteBlock(block:AvailabilityBlock){
    setMessage("Removing availability...");
    const {error}=await supabase.from("availability_rules").delete().in("id",block.ids);
    if(error){setMessage(error.message);return;}
    setRules(current=>current.filter(rule=>!block.ids.includes(rule.id)));
    setMessage("Availability removed.");
  }

  async function toggleBlockActive(block:AvailabilityBlock){
    const active=!block.active;
    setMessage(active?"Turning availability on...":"Turning availability off...");
    const {error}=await supabase.from("availability_rules").update({active}).in("id",block.ids);
    if(error){setMessage(error.message);return;}
    setRules(current=>current.map(rule=>block.ids.includes(rule.id)?{...rule,active}:rule));
    setMessage(active?"Availability is on.":"Availability is off.");
  }

  async function updateBlockTime(block:AvailabilityBlock,field:"start_time"|"end_time",value:string){
    const nextStart=field==="start_time"?value:block.start_time;
    const nextEnd=field==="end_time"?value:block.end_time;
    if(minutesFromTime(nextEnd)<=minutesFromTime(nextStart)){setMessage("End time must be after start time.");return;}
    const {error}=await supabase.from("availability_rules").update({[field]:value}).in("id",block.ids);
    if(error){setMessage(error.message);return;}
    setRules(current=>current.map(rule=>block.ids.includes(rule.id)?{...rule,[field]:value}:rule));
    setMessage("Time updated.");
  }

  async function toggleBlockWeekday(block:AvailabilityBlock,weekday:number){
    if(!providerId)return;
    const existing=rules.find(rule=>block.ids.includes(rule.id)&&rule.weekday===weekday);
    if(existing){
      const {error}=await supabase.from("availability_rules").delete().eq("id",existing.id);
      if(error){setMessage(error.message);return;}
      setRules(current=>current.filter(rule=>rule.id!==existing.id));
      setMessage("Repeat day removed.");
      return;
    }
    const {error}=await supabase.from("availability_rules").insert({provider_id:providerId,weekday,start_time:block.start_time,end_time:block.end_time,active:block.active});
    if(error){setMessage(error.message);return;}
    setMessage("Repeat day added.");
    await load();
  }

  async function toggleNewDay(weekday:number){
    setNewDays(days=>days.includes(weekday)?days.filter(day=>day!==weekday):[...days,weekday].sort((a,b)=>REPEAT_DAYS.findIndex(d=>d.weekday===a)-REPEAT_DAYS.findIndex(d=>d.weekday===b)));
  }

  async function toggleBlockedDay(date:string){
    if(!providerId)return;
    const existing=blockedDays.find(day=>day.date===date);
    setMessage(existing?"Opening date...":"Closing date...");
    if(existing){
      const {error}=await supabase.from("availability_exceptions").delete().eq("id",existing.id);
      if(error){setMessage(error.message);return;}
      setBlockedDays(days=>days.filter(day=>day.id!==existing.id));
      setMessage("Date opened again.");
      return;
    }
    const {error}=await supabase.from("availability_exceptions").insert({provider_id:providerId,date,type:"blocked",start_time:null,end_time:null});
    if(error){setMessage(error.message);return;}
    await load();
    setMessage("Date closed.");
  }

  const blocks=useMemo(()=>groupRules(rules),[rules]);
  const calendarDays=useMemo(()=>monthDays(visibleMonth,today),[visibleMonth,today]);
  const blockedMap=useMemo(()=>new Map(blockedDays.map(day=>[day.date,day])),[blockedDays]);
  const canGoBack=monthOffset(currentMonth,visibleMonth)>0;
  const canGoNext=monthOffset(currentMonth,visibleMonth)<5;
  const newEndOptions=TIME_OPTIONS.filter(time=>minutesFromTime(time)>minutesFromTime(newStart));

  return <section className="card"><div className="row"><div><h1>My Availability</h1><p>Turn on the times learners may book. Times move in 15-minute steps, and RealSign still protects your buffer time automatically.</p></div><button className="help-btn">?</button></div><div className="notice"><strong>Simple setup</strong><br/>Create one availability card for each regular time window. Switch it off when you do not want that time to be bookable.</div><div className="availability-cards">{blocks.length?blocks.map(block=><article className={`availability-card ${block.active?"active":"inactive"}`} key={block.key}><div className="availability-card-top"><div><strong>{block.start_time} - {block.end_time}</strong><small>{block.weekdays.length?`Every ${block.weekdays.map(day=>REPEAT_DAYS.find(item=>item.weekday===day)?.name).join(", ")}`:"No repeat days selected"}</small></div><button type="button" className={`toggle-switch ${block.active?"on":""}`} aria-pressed={block.active} onClick={()=>toggleBlockActive(block)}><span></span></button></div><div className="time-select-row"><label>Start<select className="field" value={block.start_time} onChange={e=>updateBlockTime(block,"start_time",e.target.value)}>{TIME_OPTIONS.slice(0,-1).map(time=><option key={time} value={time}>{time}</option>)}</select></label><label>End<select className="field" value={block.end_time} onChange={e=>updateBlockTime(block,"end_time",e.target.value)}>{TIME_OPTIONS.filter(time=>minutesFromTime(time)>minutesFromTime(block.start_time)).map(time=><option key={time} value={time}>{time}</option>)}</select></label></div><div className="repeat-days">{REPEAT_DAYS.map(day=><button key={day.weekday} type="button" className={block.weekdays.includes(day.weekday)?"selected":""} onClick={()=>toggleBlockWeekday(block,day.weekday)} aria-pressed={block.weekdays.includes(day.weekday)}>{day.label}</button>)}</div><button className="mini-btn danger-text" type="button" onClick={()=>deleteBlock(block)}>Remove availability</button></article>):<p className="muted">No availability yet. Add your first regular time window below.</p>}</div><section className="new-availability-panel"><h2>Add availability</h2><div className="time-select-row"><label>Start<select className="field" value={newStart} onChange={e=>{const start=e.target.value;setNewStart(start);if(minutesFromTime(newEnd)<=minutesFromTime(start))setNewEnd(timeValue(Math.min(minutesFromTime(start)+60,1425)));}}>{TIME_OPTIONS.slice(0,-1).map(time=><option key={time} value={time}>{time}</option>)}</select></label><label>End<select className="field" value={newEnd} onChange={e=>setNewEnd(e.target.value)}>{newEndOptions.map(time=><option key={time} value={time}>{time}</option>)}</select></label></div><div className="repeat-days">{REPEAT_DAYS.map(day=><button key={day.weekday} type="button" className={newDays.includes(day.weekday)?"selected":""} onClick={()=>toggleNewDay(day.weekday)} aria-pressed={newDays.includes(day.weekday)}>{day.label}</button>)}</div><button className="btn secondary" type="button" onClick={addAvailability}>Add availability</button></section><section className="blocked-days"><h2>Special closed days</h2><p className="muted">Use this only for holidays, appointments, or a normal teaching day you want to close.</p><div className="calendar-head"><button className="mini-btn" disabled={!canGoBack} onClick={()=>setVisibleMonth(addMonths(visibleMonth,-1))}>‹</button><strong>{monthLabel(visibleMonth)}</strong><button className="mini-btn" disabled={!canGoNext} onClick={()=>setVisibleMonth(addMonths(visibleMonth,1))}>›</button></div><div className="calendar-legend"><span><b className="legend-dot available"></b>Can use normal availability</span><span><b className="legend-x">X</b>Closed</span><span><b className="legend-dot unavailable"></b>Past</span></div><div className="booking-calendar provider-block-calendar" aria-label="Close special dates">{WEEKDAYS.map(day=><div className="calendar-weekday" key={day}>{day}</div>)}{calendarDays.map(day=>{if(day.outside)return <div className="calendar-day empty" key={day.date}/>;const blocked=blockedMap.has(day.date);return <button key={day.date} type="button" disabled={day.past} className={`calendar-day ${blocked?"blocked has-slots":"no-slots"} ${day.past?"past":""}`} onClick={()=>toggleBlockedDay(day.date)} aria-pressed={blocked}><span className="day-number">{day.day}</span>{day.past?<span className="day-status">Past</span>:blocked?<span className="day-status blocked-label"><strong>X</strong><small>Closed</small></span>:<span className="day-pill"><strong>Open</strong><small>Tap to close</small></span>}</button>})}</div>{blockedDays.length?<div className="blocked-summary"><strong>{blockedDays.length}</strong> upcoming closed {blockedDays.length===1?"date":"dates"}</div>:<p className="muted">No upcoming closed dates.</p>}</section>{message?<p className="muted" aria-live="polite">{message}</p>:null}<Link className="btn secondary" href="/profile">Back to profile</Link></section>;
}
