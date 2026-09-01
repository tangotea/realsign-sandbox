"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type HelpItem = {
  id: string;
  slug: string;
  title: string;
  text_explanation: string | null;
  audience: string[] | string | null;
  screen_key: string;
  placement_key: string;
  video_path: string | null;
  active: boolean;
};

function audienceValue(item: HelpItem | null) {
  return Array.isArray(item?.audience) ? item.audience[0] || "everyone" : item?.audience || "everyone";
}

export default function HelpVideoManager({ items }: { items: HelpItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<HelpItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function startNew() {
    setEditing(null);
    setMsg("");
  }

  function startEditing(item: HelpItem) {
    setEditing(item);
    setMsg("");
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const form = e.currentTarget;
    const result = await fetch("/api/admin/help", { method: "POST", body: new FormData(form) });
    const body = await result.json().catch(() => ({}));
    if (!result.ok) {
      setMsg(body.error || "Unable to save help content.");
      setBusy(false);
      return;
    }
    setMsg(editing ? "Help content updated." : "Help content created.");
    setBusy(false);
    if (!editing) form.reset();
    router.refresh();
  }

  return (
    <div className="stack" style={{ marginTop: 0 }}>
      <section className="card">
        <div className="row wrap">
          <div>
            <h2>{editing ? "Edit SASL help" : "Add SASL help"}</h2>
            <p className="muted">Edit the text or replace the video used by a help button.</p>
          </div>
          {editing ? <button type="button" className="mini-btn" onClick={startNew}>Create new</button> : null}
        </div>
        <form key={editing?.id || "new"} onSubmit={submit}>
          <label>Title<input className="field" name="title" defaultValue={editing?.title || ""} required /></label>
          <label>Slug<input className="field" name="slug" defaultValue={editing?.slug || ""} placeholder="provider-availability" required /></label>
          <label>Text explanation<textarea className="field" name="text" rows={4} defaultValue={editing?.text_explanation || ""} /></label>
          <label>SASL video<input className="field" type="file" name="video" accept="video/*" />{editing?.video_path ? <small className="muted">A video is already published. Leave this empty to keep it.</small> : null}</label>
          <div className="form-grid">
            <label>Audience<select className="field" name="audience" defaultValue={audienceValue(editing)}><option value="everyone">Everyone</option><option value="learner">Learner</option><option value="provider">Provider</option><option value="interpreter">Interpreter</option></select></label>
            <label>Screen<select className="field" name="screenKey" defaultValue={editing?.screen_key || "general"}><option value="general">General Help</option><option value="home">Home</option><option value="booking">Booking</option><option value="provider">Provider</option><option value="video">Video Session</option></select></label>
            <label>Placement key<input className="field" name="placementKey" defaultValue={editing?.placement_key || "general"} /></label>
          </div>
          <button className="btn" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Save help content"}</button>
          {msg ? <p className="admin-success" role="status">{msg}</p> : null}
        </form>
      </section>
      <section className="card">
        <h2>Published help content</h2>
        <div className="stack" style={{ marginTop: 12 }}>
          {items.map(item => <div className="service-row" key={item.id}><div><strong>{item.title}</strong><small>{item.slug}</small></div><button type="button" className="mini-btn" onClick={() => startEditing(item)}>Edit</button></div>)}
          {!items.length ? <p className="muted">No help content yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
