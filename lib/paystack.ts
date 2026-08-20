import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const API = "https://api.paystack.co";

function secret() {
  const value = process.env.PAYSTACK_SECRET_KEY;
  if (!value) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  return value;
}

export async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.status === false) throw new Error(body?.message || `Paystack request failed (${response.status})`);
  return body as T;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secret()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type VerifiedTransaction = {
  id: number | string;
  status: string;
  reference: string;
  amount: number;
  fees?: number | null;
  channel?: string | null;
  paid_at?: string | null;
  gateway_response?: string | null;
  currency?: string | null;
};

export async function verifyAndFinalizePayment(reference: string) {
  const result = await paystackRequest<{status:boolean; data:VerifiedTransaction}>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
  const tx = result.data;
  if (tx.status !== "success") return { status: tx.status };
  if (tx.currency && tx.currency !== "ZAR") return { status: "manual_review", reason: "currency_mismatch" };
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin.rpc("record_successful_paystack_payment", {
    p_reference: reference,
    p_paystack_transaction_id: String(tx.id),
    p_amount_cents: tx.amount,
    p_gateway_fee_cents: tx.fees || 0,
    p_channel: tx.channel || null,
    p_paid_at: tx.paid_at || new Date().toISOString(),
    p_gateway_response: tx.gateway_response || null,
  });
  if (error) throw error;
  return data as {status:string; booking_id?:string; reason?:string};
}

export function paymentReference() {
  return `rs-${crypto.randomUUID()}`;
}

export function transferReference() {
  return `rsp-${crypto.randomUUID()}`;
}
