"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
type Rule = {id:string;weekday:number;start_time:string;end_time:string};

export default function AvailabilityEditor(){
  const supabase=useMemo(()=>createClient(),[]); const [providerId,setProviderId]=useState<string|null>(null); const [rules,setRules]=useState<Rule[]>([]); const [message,setMessage]=useState("Loading…");
  const load=useCallback(async()=>{const {data:auth}=await supabase.auth.getUser(); if(!auth.user){setMessage("Sign in to manage availability.");return;} const {data:p}=await supabase.from("provider_profiles").select("id").eq("user_id",auth.user.id).maybeSingle(); if(!p){setMessage("Start your provider application first.");return;} setProviderId(p.id); const {data,error}=await supabase.from("availability_rules").select("id,weekday,start_time,end_time").eq("provider_id",p.id).eq("active",true).order("weekday"); setRules((data||[]) as Rule[]); setMessage(error?error.message:"");},[supabase]);
  useEffect(()=>{load();},[load]);
  async function add(weekday:number){if(!providerId)return; const {error}=await supabase.from("availability_rules").insert({provider_id:providerId,weekday,start_time:"17:00",end_time:"20:00"}); if(error)setMessage(error.message); else load();}
  async function remove(id:string){await supabase.from("availability_rules").delete().eq("id",id); load();}
  async function update(id:string,field:"start_time"|"end_time",value:string){setRules(rules.map(r=>r.id===id?{...r,[field]:value}:r)); await supabase.from("availability_rules").update({[field]:value}).eq("id",id);}
  return <section className="card"><div className="row"><div><h1>My Availability</h1><p>Only published time can become bookable.</p></div><button className="help-btn">?</button></div><div className="availability-list">{DAYS.map((day,weekday)=>{const dayRules=rules.filter(r=>r.weekday===weekday);return <div className="availability-day" key={day}><div><strong>{day}</strong>{!dayRules.length?<small>Not available</small>:null}</div><div className="day-rules">{dayRules.map(r=><div className="time-row" key={r.id}><input type="time" value={r.start_time.slice(0,5)} onChange={e=>update(r.id,"start_time",e.target.value)}/><span>→</span><input type="time" value={r.end_time.slice(0,5)} onChange={e=>update(r.id,"end_time",e.target.value)}/><button className="mini-btn" onClick={()=>remove(r.id)}>Remove</button></div>)}<button className="mini-btn" onClick={()=>add(weekday)}>+ Add time</button></div></div>})}</div>{message?<p className="muted">{message}</p>:null}<Link className="btn secondary" href="/provider/application">Back to application</Link></section>;
}
