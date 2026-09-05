import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") || "/profile";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/profile";
  const isRecovery = next === "/reset-password";
  const errorDestination = isRecovery ? "/reset-password?error=recovery" : "/auth/confirmed?error=confirmation";

  // Recovery links must be completed in the browser because the PKCE verifier
  // is stored there, not in the server request cookies.
  if (isRecovery) {
    const recoveryDestination = new URL("/reset-password", url.origin);
    if (code) recoveryDestination.searchParams.set("code", code);
    if (url.searchParams.get("error")) recoveryDestination.searchParams.set("error", "recovery");
    return NextResponse.redirect(recoveryDestination);
  }

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(new URL(errorDestination, url.origin));
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(errorDestination, url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
