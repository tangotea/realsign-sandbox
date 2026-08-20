"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { OFFICIAL_LANGUAGES } from "@/lib/languages";

export default function LanguageSelector() {
  const supabase = useMemo(() => createClient(), []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading…");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || null;
      setUserId(uid);
      if (!uid) {
        setStatus("Sign in to save your language choices.");
        return;
      }
      const { data: languages } = await supabase.from("languages").select("id,code");
      const { data: links } = await supabase.from("user_languages").select("language_id").eq("user_id", uid);
      const chosenIds = new Set((links || []).map((x: { language_id: number }) => x.language_id));
      const chosenCodes = new Set((languages || []).filter((x: { id: number; code: string }) => chosenIds.has(x.id)).map((x: { code: string }) => x.code));
      setSelected(chosenCodes);
      setStatus("");
    })();
  }, [supabase]);

  function toggle(code: string) {
    const next = new Set(selected);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelected(next);
  }

  async function save() {
    if (!userId) return;
    setStatus("Saving…");
    const { data: languages, error: languageError } = await supabase.from("languages").select("id,code").in("code", Array.from(selected));
    if (languageError) { setStatus(languageError.message); return; }
    const { error: deleteError } = await supabase.from("user_languages").delete().eq("user_id", userId);
    if (deleteError) { setStatus(deleteError.message); return; }
    if ((languages || []).length) {
      const { error: insertError } = await supabase.from("user_languages").insert((languages || []).map((language: { id: number }) => ({ user_id: userId, language_id: language.id })));
      if (insertError) { setStatus(insertError.message); return; }
    }
    setStatus("Languages saved ✓");
  }

  return (
    <section className="card">
      <div className="row"><div><h2>Languages I use</h2><p>Select all that apply.</p></div><button className="help-btn" aria-label="Languages help">?</button></div>
      <div className="checklist">
        {OFFICIAL_LANGUAGES.map((language) => <label className="check" key={language.code}><input type="checkbox" checked={selected.has(language.code)} onChange={() => toggle(language.code)} /><span><strong>{language.label}</strong>{language.modality === "signed" ? <span className="pill" style={{marginLeft:8}}>Sign language</span> : null}</span></label>)}
      </div>
      {userId ? <button className="btn" style={{marginTop:16}} onClick={save}>Save languages</button> : <Link href="/sign-in" className="btn" style={{marginTop:16}}>Sign in to save</Link>}
      {status ? <p className="muted" aria-live="polite">{status}</p> : null}
    </section>
  );
}
