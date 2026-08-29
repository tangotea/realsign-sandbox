import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const confirmationTypes = new Set<EmailOtpType>(["email", "signup", "invite", "email_change"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !confirmationTypes.has(type)) {
    return NextResponse.redirect(new URL("/auth/confirmed?error=confirmation", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(new URL("/auth/confirmed?error=confirmation", url.origin));
  }

  return NextResponse.redirect(new URL("/auth/confirmed", url.origin));
}
