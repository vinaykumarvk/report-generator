import { getSupabaseClient } from "@/lib/supabase";

export function supabaseAdmin() {
  return getSupabaseClient();
}

export function assertNoSupabaseError(error: unknown, context: string) {
  if (!error) return;
  const message =
    error instanceof Error ? error.message : "Supabase request failed";
  throw new Error(`${context}: ${message}`);
}
