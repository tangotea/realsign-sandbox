import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{providerId:string}> }) {
  const { providerId } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase.from("provider_profiles").select("status,introduction_video_path").eq("id",providerId).eq("status","approved").maybeSingle();
  if (!profile?.introduction_video_path) return new NextResponse("Not found", {status:404});
  const admin = createAdminClient();
  if (!admin) return new NextResponse("Provider media signing is not configured", {status:503});
  const { data, error } = await admin.storage.from("provider-media").createSignedUrl(profile.introduction_video_path, 60 * 10);
  if (error || !data?.signedUrl) return new NextResponse("Unable to open media", {status:404});
  return NextResponse.redirect(data.signedUrl);
}
