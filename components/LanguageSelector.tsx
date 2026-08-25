"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageDisplayMode, officialLanguageLabel, officialLanguageOptions } from "@/lib/languages";

type LanguageSelectorProps = {
  modes?: LanguageDisplayMode[];
};

const MODE_COPY: Record<LanguageDisplayMode, { title: string; subtitle: string; button: string }> = {
  tutor: {
    title: "Languages I can use while teaching",
    subtitle: "Choose the written languages you can use while teaching SASL.",
    button: "Save tutor languages",
  },
  interpreter: {
    title: "Languages I can interpret",
    subtitle: "Choose the spoken or written languages you can interpret with SASL.",
    button: "Save interpreter languages",
  },
};

export default function LanguageSelector({ modes = ["tutor"] }: LanguageSelectorProps) {
  const supabase = useMemo(() => createClient(), []);
  const visibleModes = Array.from(new Set(modes));
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
      <div className="row"><div><h2>Languages I use</h2><p>{visibleModes.length ? "Select all that apply." : "Choose tutor or interpreter first."}</p></div><button className="help-btn" aria-label="Languages help">?</button></div>
      {visibleModes.map(mode => (
        <div className="language-mode" key={mode}>
          <h3>{MODE_COPY[mode].title}</h3>
          <p>{MODE_COPY[mode].subtitle}</p>
          <div className="checklist">
            {officialLanguageOptions(mode).map((language) => <label className="check" key={`${mode}-${language.code}`}><input type="checkbox" checked={selected.has(language.code)} onChange={() => toggle(language.code)} /><span><strong>{officialLanguageLabel(language.code, mode)}</strong>{language.modality === "signed" ? <span className="pill" style={{marginLeft:8}}>Sign language</span> : null}</span></label>)}
          </div>
        </div>
      ))}
      {userId ? <button className="btn" style={{marginTop:16}} onClick={save}>{visibleModes.length === 1 ? MODE_COPY[visibleModes[0]].button : "Save languages"}</button> : <Link href="/sign-in" className="btn" style={{marginTop:16}}>Sign in to save</Link>}
      {status ? <p className="muted" aria-live="polite">{status}</p> : null}
    </section>
  );
}
