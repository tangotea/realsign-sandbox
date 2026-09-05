-- Keep account blocks private to server-side admin and trigger code.
revoke all on table public.account_blocks from anon, authenticated;

drop policy if exists "account_blocks_no_client_access" on public.account_blocks;
create policy "account_blocks_no_client_access"
on public.account_blocks for all to anon, authenticated
using (false)
with check (false);

-- This function is invoked by the auth trigger, never by the Data API.
revoke execute on function public.reject_blocked_email_signup() from public, anon, authenticated;
