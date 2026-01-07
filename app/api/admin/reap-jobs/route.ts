import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin endpoint to run the reap_expired_jobs function
 * Secured with x-admin-secret header
 */
export async function POST(request: Request) {
  // Check authentication
  const adminSecret = process.env.ADMIN_SECRET || process.env.WORKER_TRIGGER_SECRET;
  if (adminSecret) {
    const header = request.headers.get("x-admin-secret");
    if (header !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxAgeMinutes = body.max_age_minutes || 60;

    const supabase = supabaseAdmin();
    const { data, error } = await supabase.rpc("reap_expired_jobs", {
      max_age_minutes: maxAgeMinutes,
    });

    if (error) {
      console.error("Error running reaper:", error);
      return NextResponse.json(
        { error: "Failed to run reaper", details: error.message },
        { status: 500 }
      );
    }

    const result = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
      success: true,
      jobs_reclaimed: result?.jobs_reclaimed || 0,
      jobs_failed: result?.jobs_failed || 0,
      details: result?.details || {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Fatal error in reaper endpoint:", err);
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for health check / manual testing
 */
export async function GET() {
  return NextResponse.json({
    message: "Reaper endpoint is active",
    usage: "POST with x-admin-secret header and optional { max_age_minutes: 60 } body",
  });
}

