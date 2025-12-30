import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";

const DEFAULT_WORKSPACE_NAME =
  process.env.DEFAULT_WORKSPACE_NAME || "Default Workspace";

export async function getDefaultWorkspaceId() {
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
  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: createError } = await supabase
    .from("workspaces")
    .insert({ name: DEFAULT_WORKSPACE_NAME })
    .select("id")
    .single();
  assertNoSupabaseError(createError, "Failed to create default workspace");
  return created.id;
}
