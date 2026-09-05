import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}

export function createEmailConfirmationClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { flowType: "implicit" } }
  );
}

export function createRecoveryClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Recovery is handled explicitly by ResetPasswordPanel. Implicit
        // recovery links carry the session in the URL fragment, so a link
        // opened from an email app does not depend on a browser-only verifier.
        flowType: "implicit",
        detectSessionInUrl: false,
      },
    }
  );
}
