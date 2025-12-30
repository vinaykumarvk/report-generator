import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: { runId: string } }
) {
  const supabase = supabaseAdmin();
  const { data: run, error } = await supabase
    .from("report_runs")
    .select("id")
    .eq("id", params.runId)
    .single();
  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastTimestamp: string | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      supabase
        .from("run_events")
        .select("*")
        .eq("run_id", params.runId)
        .order("created_at", { ascending: true })
        .limit(200)
        .then(({ data }) => {
          const events = data || [];
          events.forEach(send);
          if (events.length) {
            lastTimestamp = events[events.length - 1].created_at;
          }
        })
        .catch(() => {
          // ignore initial fetch errors; SSE will still retry on interval
        });

      const interval = setInterval(async () => {
        const { data } = await supabase
          .from("run_events")
          .select("*")
          .eq("run_id", params.runId)
          .order("created_at", { ascending: true })
          .gt("created_at", lastTimestamp || "1970-01-01T00:00:00Z");
        const updates = data || [];
        updates.forEach((event) => {
          send(event);
          lastTimestamp = event.created_at;
        });
      }, 1000);

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
