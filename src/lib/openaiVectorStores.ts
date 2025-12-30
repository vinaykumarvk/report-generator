type OpenAIVectorStore = {
  id: string;
  name: string;
  created_at?: number;
};

type OpenAISearchResult = {
  id: string;
  score?: number;
  content?: { text?: string }[];
  file_id?: string;
  metadata?: Record<string, unknown>;
};

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

async function openaiFetch(path: string, init: RequestInit) {
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

export async function listVectorStores(): Promise<OpenAIVectorStore[]> {
  const data = await openaiFetch("/vector_stores", { method: "GET" });
  return (data.data || []).map((item: any) => ({
    id: item.id,
    name: item.name || item.id,
    created_at: item.created_at,
  }));
}

export async function searchVectorStore(params: {
  vectorStoreId: string;
  query: string;
  maxResults?: number;
  fileIds?: string[];
}): Promise<OpenAISearchResult[]> {
  const fileIds =
    Array.isArray(params.fileIds) && params.fileIds.length > 0
      ? params.fileIds
      : undefined;
  const data = await openaiFetch(
    `/vector_stores/${params.vectorStoreId}/search`,
    {
      method: "POST",
      body: JSON.stringify({
        query: params.query,
        max_results: params.maxResults || 5,
        ...(fileIds ? { file_ids: fileIds } : {}),
      }),
    }
  );
  return data.data || [];
}
