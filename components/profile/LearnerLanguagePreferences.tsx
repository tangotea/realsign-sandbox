"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LEARNER_LANGUAGE_OPTIONS } from "@/lib/languages";

type LearnerLanguagePreferencesProps = {
  initialSpokenLanguage: string;
  initialUsesSasl: boolean;
};

export default function LearnerLanguagePreferences({ initialSpokenLanguage, initialUsesSasl }: LearnerLanguagePreferencesProps) {
  const supabase = useMemo(() => createClient(), []);
  const [spokenLanguage, setSpokenLanguage] = useState(initialSpokenLanguage || "en");
  const [usesSasl, setUsesSasl] = useState(initialUsesSasl);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({
      data: {
        learner_spoken_language: spokenLanguage,
        learner_uses_sasl: usesSasl,
      },
    });
    setMessage(error ? error.message : "Language preferences saved.");
    setBusy(false);
  }

  return (
    <section className="card">
      <div className="row"><div><h2>Languages</h2><p>Your learner language preference.</p></div><button className="help-btn" aria-label="Language preference help">?</button></div>
      <label>Spoken language<select className="field" value={spokenLanguage} onChange={event => setSpokenLanguage(event.target.value)}>
        {LEARNER_LANGUAGE_OPTIONS.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
      </select></label>
      <label className="check"><input type="checkbox" checked={usesSasl} onChange={() => setUsesSasl(value => !value)} /><span><strong>South African Sign Language (SASL)</strong><small>Show SASL help where it is available.</small></span></label>
      <button className="btn secondary" style={{ marginTop: 16 }} onClick={save} disabled={busy}>{busy ? "Saving..." : "Save language preference"}</button>
      {message ? <p className="muted" aria-live="polite">{message}</p> : null}
    </section>
  );
}
