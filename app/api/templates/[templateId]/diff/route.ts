import { NextResponse } from "next/server";
import { diffObjects } from "@/lib/diff";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { templateId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: template, error } = await supabase
    .from("templates")
    .select("history_json")
    .eq("id", params.templateId)
    .single();
  if (error || !template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  const history = (template.history_json as any[]) || [];
  const url = new URL(request.url);
  const fromVersion = Number(url.searchParams.get("from"));
  const toVersion = Number(url.searchParams.get("to"));

  const fromSnapshot = history.find((entry: any) => entry.version === fromVersion);
  const toSnapshot = history.find((entry: any) => entry.version === toVersion);
  if (!fromSnapshot || !toSnapshot) {
    return NextResponse.json(
      { error: "Invalid from/to version" },
      { status: 400 }
    );
  }

  const diffs = diffObjects(fromSnapshot.state, toSnapshot.state);
  return NextResponse.json({ fromVersion, toVersion, diffs });
}
