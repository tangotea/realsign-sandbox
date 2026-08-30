import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const VERIFICATION_TYPES = new Set(["identity", "deaf", "interpreter_assessment"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "");
  const providerId = String(body.providerId || "");
  const path = String(body.path || "");
  if (!providerId || !path) return NextResponse.json({ error: "Upload details are missing." }, { status: 400 });

  const { data: provider } = await supabase.from("provider_profiles").select("id,user_id,introduction_video_path").eq("id", providerId).eq("user_id", auth.user.id).maybeSingle();
  if (!provider) return NextResponse.json({ error: "Provider application not found." }, { status: 404 });
  if (!path.startsWith(`${auth.user.id}/`)) return NextResponse.json({ error: "That file does not belong to this account." }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "File removal is not configured on the server." }, { status: 500 });

  if (kind === "introduction_video") {
    if (provider.introduction_video_path !== path) return NextResponse.json({ error: "That introduction video is no longer current." }, { status: 409 });
    const { error: storageError } = await admin.storage.from("provider-media").remove([path]);
    if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
    const { error } = await admin.from("provider_profiles").update({ introduction_video_path: null }).eq("id", providerId).eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const verificationType = String(body.verificationType || "");
  if (kind !== "verification" || !VERIFICATION_TYPES.has(verificationType)) return NextResponse.json({ error: "Invalid upload type." }, { status: 400 });
  const { data: verification } = await supabase.from("verification_records").select("id,state,storage_path").eq("provider_id", providerId).eq("type", verificationType).maybeSingle();
  if (!verification || verification.storage_path !== path) return NextResponse.json({ error: "That verification file is no longer current." }, { status: 409 });
  if (verification.state === "approved") return NextResponse.json({ error: "Approved verification files cannot be removed." }, { status: 400 });
  const { error: storageError } = await admin.storage.from("verification-documents").remove([path]);
  if (storageError) return NextResponse.json({ error: storageError.message }, { status: 500 });
  const { error } = await admin.from("verification_records").update({ state: "not_submitted", storage_path: null, submitted_at: null, reviewed_at: null, reviewed_by: null, internal_note: null, retention_delete_after: null }).eq("id", verification.id).eq("provider_id", providerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
