import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
  // SSR's browser helper forces PKCE and may reuse an existing client.
  // Recovery must work when the email opens in a different browser.
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Recovery is handled explicitly by ResetPasswordPanel. Implicit
        // recovery links carry the session in the URL fragment, so a link
        // opened from an email app does not depend on a browser-only verifier.
        flowType: "implicit",
        detectSessionInUrl: false,
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
