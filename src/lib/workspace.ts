import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

const DEFAULT_WORKSPACE_NAME =
  process.env.DEFAULT_WORKSPACE_NAME || "Default Workspace";
const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID;

export async function getDefaultWorkspaceId(): Promise<string> {
  // If explicit workspace ID is set, use it
  if (DEFAULT_WORKSPACE_ID) {
    console.log('[Workspace] Using explicit DEFAULT_WORKSPACE_ID:', DEFAULT_WORKSPACE_ID);
    return DEFAULT_WORKSPACE_ID;
  }
  const supabase = supabaseAdmin();
  const { data: existing, error: findError } = await supabase
    .from("workspaces")
    .select("id")
    .eq("name", DEFAULT_WORKSPACE_NAME)
    .limit(1)
    .maybeSingle();
  if (findError && findError.code !== "PGRST116") {
    assertNoSupabaseError(findError, "Failed to lookup default workspace");
  }
  const existingId = existing?.id;
  if (typeof existingId === "string" || typeof existingId === "number") {
    return String(existingId);
  }

  const { data: created, error: createError } = await supabase
    .from("workspaces")
    .insert({ name: DEFAULT_WORKSPACE_NAME })
    .select("id")
    .single();
  assertNoSupabaseError(createError, "Failed to create default workspace");
  const createdId = created?.id;
  if (!(typeof createdId === "string" || typeof createdId === "number")) {
    throw new Error("Failed to create default workspace");
  }
  return String(createdId);
}
