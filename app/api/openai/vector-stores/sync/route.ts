import { NextResponse } from "next/server";
import { listVectorStores } from "@/lib/openaiVectorStores";
import { supabaseAdmin, assertNoSupabaseError } from "@/lib/supabaseAdmin";
import { getDefaultWorkspaceId } from "@/lib/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const vectorStores = await listVectorStores();
    const created: string[] = [];
    const updated: string[] = [];
    const supabase = supabaseAdmin();
    const workspaceId = await getDefaultWorkspaceId();

    for (const store of vectorStores) {
      const { data: existing } = (await supabase
        .from("connectors")
        .select("*")
        .eq("type", "VECTOR")
        .contains("config_json", { vectorStoreId: store.id })
        .maybeSingle()) as { data: any; error: any };
      if (existing) {
        const { error: updateError } = await (supabase
          .from("connectors") as any)
          .update({
            name: store.name,
            config_json: {
              ...(existing.config_json || {}),
              provider: "openai",
              vectorStoreId: store.id,
            },
          })
          .eq("id", existing.id);
        assertNoSupabaseError(updateError, "Failed to update vector connector");
        updated.push(store.id);
      } else {
        const { error: createError } = await (supabase.from("connectors") as any).insert({
          workspace_id: workspaceId,
          name: store.name,
          type: "VECTOR",
          description: "Synced from OpenAI",
          config_json: { provider: "openai", vectorStoreId: store.id },
          tags: ["openai"],
        });
        assertNoSupabaseError(createError, "Failed to create vector connector");
        created.push(store.id);
      }
    }

    return NextResponse.json({ created, updated, total: vectorStores.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to sync vector stores." },
      { status: 500 }
    );
  }
}
