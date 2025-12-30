import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

async function openaiFetch(path: string, init: RequestInit = {}) {
  const headers = {
    Authorization: `Bearer ${getApiKey()}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const res = await fetch(`${OPENAI_BASE_URL}${path}`, {
    ...init,
    headers,
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${errorText}`);
  }
  return res.json();
}

/**
 * GET /api/openai/vector-stores/[vectorStoreId]/files
 * Fetches all files in a specific vector store with pagination
 */
export async function GET(
  _request: Request,
  { params }: { params: { vectorStoreId: string } }
) {
  try {
    const vectorStoreId = params.vectorStoreId;
    const allFiles: any[] = [];

    // Fetch first page of files from the vector store
    let response = await openaiFetch(
      `/vector_stores/${vectorStoreId}/files?limit=100`,
      { method: "GET" }
    );
    
    allFiles.push(...(response.data || []));

    // Fetch subsequent pages of files from the vector store
    while (response.has_more && response.last_id) {
      response = await openaiFetch(
        `/vector_stores/${vectorStoreId}/files?limit=100&after=${response.last_id}`,
        { method: "GET" }
      );
      allFiles.push(...(response.data || []));
    }

    console.log(`Fetched ${allFiles.length} files from vector store ${vectorStoreId}`);

    // Process all collected file objects from the vector store
    const filesWithDetails = await Promise.all(
      allFiles.map(async (file: any) => {
        try {
          // Retrieve the actual file details from OpenAI's file storage
          const fileDetails = await openaiFetch(`/files/${file.id}`, {
            method: "GET",
          });
          return {
            id: file.id,
            filename: fileDetails.filename || file.id,
            bytes: fileDetails.bytes || 0,
            created_at: fileDetails.created_at,
            status: file.status,
          };
        } catch (err: any) {
          // Handle NotFoundError - file associated with vector store but not found in OpenAI file storage
          if (err.message?.includes("404")) {
            console.warn(
              `Warning: File ${file.id} associated with vector store but not found in OpenAI file storage.`
            );
          } else {
            console.error(
              `An unexpected error occurred while retrieving file ${file.id}:`,
              err
            );
          }
          
          // Return basic info even if file details couldn't be fetched
          return {
            id: file.id,
            filename: file.id,
            bytes: 0,
            created_at: file.created_at,
            status: file.status || "unknown",
          };
        }
      })
    );

    return NextResponse.json(filesWithDetails);
  } catch (error: any) {
    console.error("Failed to fetch vector store files:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch vector store files." },
      { status: 500 }
    );
  }
}
