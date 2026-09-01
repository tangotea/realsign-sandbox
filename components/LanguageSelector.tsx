"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LanguageDisplayMode, officialLanguageLabel, officialLanguageOptions } from "@/lib/languages";
import HelpButton from "@/components/help/HelpButton";

type LanguageSelectorProps = {
  modes?: Array<Exclude<LanguageDisplayMode, "combined">>;
};

const MODE_COPY: Record<LanguageDisplayMode, { title: string; subtitle: string; button: string }> = {
  tutor: {
    title: "Written languages I can use",
    subtitle: "Lessons are taught in SASL. Select the languages you can read and type. This does not mean you hear or speak these languages.",
    button: "Save tutor languages",
  },
  interpreter: {
    title: "Languages I can interpret",
    subtitle: "Select the spoken languages you can interpret between and SASL.",
    button: "Save interpreter languages",
  },
  combined: {
    title: "Languages I can use for both roles",
    subtitle: "Select only languages you can read and type and also interpret between SASL. Selecting a language does not mean you hear or speak it.",
    button: "Save language choices",
  },
};

export default function LanguageSelector({ modes = ["tutor"] }: LanguageSelectorProps) {
  const supabase = useMemo(() => createClient(), []);
  const visibleModes = Array.from(new Set(modes));
  const displayMode: LanguageDisplayMode | null = visibleModes.length > 1 ? "combined" : visibleModes[0] || null;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [statusKind, setStatusKind] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || null;
      setUserId(uid);
      if (!uid) {
        setStatusKind("info");
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
    setStatusKind("info");
    setStatus("Saving…");
    const { data: languages, error: languageError } = await supabase.from("languages").select("id,code").in("code", Array.from(selected));
    if (languageError) { setStatusKind("error"); setStatus(languageError.message); return; }
    const { error: deleteError } = await supabase.from("user_languages").delete().eq("user_id", userId);
    if (deleteError) { setStatusKind("error"); setStatus(deleteError.message); return; }
    if ((languages || []).length) {
      const { error: insertError } = await supabase.from("user_languages").insert((languages || []).map((language: { id: number }) => ({ user_id: userId, language_id: language.id })));
      if (insertError) { setStatusKind("error"); setStatus(insertError.message); return; }
    }
    setStatusKind("success");
    setStatus("Languages saved.");
  }

  return (
    <section className="card">
      <div className="row"><div><h2>Languages</h2><p>{displayMode ? "Select all that apply." : "Choose tutor or interpreter first."}</p></div><HelpButton slug="provider-languages" label="Provider languages help" fallbackText="Choose the languages you can use for teaching or interpreting. A language choice describes communication ability and does not mean you hear or speak the language." /></div>
      {displayMode ? (
        <div className="language-mode">
          <h3>{MODE_COPY[displayMode].title}</h3>
          <p>{MODE_COPY[displayMode].subtitle}</p>
          <div className="checklist">
            {officialLanguageOptions(displayMode).map((language) => <label className="check" key={language.code}><input type="checkbox" checked={selected.has(language.code)} onChange={() => toggle(language.code)} /><span><strong>{officialLanguageLabel(language.code, displayMode)}</strong>{language.modality === "signed" ? <span className="pill" style={{marginLeft:8}}>Sign language</span> : null}</span></label>)}
          </div>
        </div>
      ) : null}
      {userId && displayMode ? <button className="btn" style={{marginTop:16}} onClick={save}>{MODE_COPY[displayMode].button}</button> : null}
      {!userId ? <Link href="/sign-in" className="btn" style={{marginTop:16}}>Sign in to save</Link> : null}
      {status ? <p className={`inline-feedback ${statusKind}`} aria-live="polite">{status}</p> : null}
    </section>
  );
}
