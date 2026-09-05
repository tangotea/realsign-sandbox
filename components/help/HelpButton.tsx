"use client";
import { useState } from "react";
import { createPortal } from "react-dom";

type HelpButtonProps = { slug: string; label?: string; fallbackText?: string; size?: "mini" | "regular" };

export default function HelpButton({ slug, label = "Help", fallbackText, size = "mini" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function show() {
    setOpen(true);
    if (data) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/help?slug=${encodeURIComponent(slug)}`);
      const json = await response.json().catch(() => ({}));
      setData(response.ok ? json : { title: label, text_explanation: fallbackText || json.error || "Help is not available yet." });
    } catch {
      setData({ title: label, text_explanation: fallbackText || "Help is not available yet." });
    } finally {
      setBusy(false);
    }
  }

  const modal = open ? (
    <div className="help-modal-backdrop" onClick={() => setOpen(false)}>
      <section className="help-modal" role="dialog" aria-modal="true" aria-label={data?.title || label} onClick={event => event.stopPropagation()}>
        <div className="row">
          <h2>{data?.title || label}</h2>
          <button type="button" className="mini-btn" onClick={() => setOpen(false)}>Close</button>
        </div>
        {busy ? <p>Loading help...</p> : null}
        {data?.videoUrl ? <video className="help-video" src={data.videoUrl} controls playsInline /> : null}
        {data?.text_explanation ? <p>{data.text_explanation}</p> : null}
      </section>
    </div>
  ) : null;

  return <>
    <button type="button" className={`help-btn${size === "mini" ? " mini" : ""}`} aria-label={label} onClick={show}>?</button>
    {typeof document !== "undefined" && modal ? createPortal(modal, document.body) : null}
  </>;
}
