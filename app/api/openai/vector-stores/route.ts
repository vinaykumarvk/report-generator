import { NextResponse } from "next/server";
import { listVectorStores } from "@/lib/openaiVectorStores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/openai/vector-stores
 * Fetches all vector stores from OpenAI API
 */
export async function GET() {
  try {
    const vectorStores = await listVectorStores();
    
    // Return the vector stores with id and name
    const formattedStores = vectorStores.map((store) => ({
      id: store.id,
      name: store.name || store.id,
      created_at: store.created_at,
    }));

    return NextResponse.json(formattedStores);
  } catch (error: any) {
    console.error("Failed to fetch vector stores:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch vector stores from OpenAI." },
      { status: 500 }
    );
  }
}




