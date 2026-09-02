import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HelpVideoManager from "@/components/admin/HelpVideoManager";
import { DEFAULT_HELP_CONTENT, type HelpContentItem } from "@/lib/helpContent";

export default async function Page() {
  const s = await createClient();
  const { data: auth } = await s.auth.getUser();
  if (!auth.user) return <main className="main"><Link href="/sign-in">Sign in</Link></main>;

  const { data: admin } = await s.from("admin_profiles").select("role").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
  if (!admin) return <main className="main"><h1>Access denied</h1></main>;

  const { data: items } = await s.from("help_content").select("id,slug,title,text_explanation,audience,screen_key,placement_key,active,video_path,updated_at").order("updated_at", { ascending: false });
  const saved = (items || []) as HelpContentItem[];
  const savedBySlug = new Map(saved.map(item => [item.slug, item]));
  const helpItems = DEFAULT_HELP_CONTENT.map(item => savedBySlug.get(item.slug) ? { ...item, ...savedBySlug.get(item.slug) } : item);
  const builtInSlugs = new Set(DEFAULT_HELP_CONTENT.map(item => item.slug));
  helpItems.push(...saved.filter(item => !builtInSlugs.has(item.slug)));
  return (
    <div className="admin-shell">
      <aside className="sidebar"><div className="brand">REALSIGN ADMIN</div><nav><Link href="/admin">Dashboard</Link><Link href="/admin/help">Help Videos</Link><Link href="/admin/sponsorships">Sponsorships</Link></nav></aside>
      <main className="admin-main">
        <h1>SASL Help Video Manager</h1>
        <p className="muted">Publish or edit short SASL explanations without releasing a new app version.</p>
        <div className="admin-review-grid">
          <div className="admin-table">
            {helpItems.map((item: HelpContentItem) => <div className="admin-row" key={item.id}><div><strong>{item.title}</strong><small>{item.slug} · {item.screen_key}/{item.placement_key}</small></div><span className="status">{item.active ? "active" : "inactive"}</span><span>{item.video_path ? "Video ✓" : "Text only"}</span></div>)}
          </div>
          <HelpVideoManager items={helpItems} />
        </div>
      </main>
    </div>
  );
}
