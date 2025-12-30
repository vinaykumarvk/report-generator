import { logger } from "@/lib/logger";

type Connector = {
  id: string;
  name: string;
  type: string;
  configJson?: Record<string, unknown>;
};

type WebResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
};

function getApiKey(envName: string | undefined) {
  if (!envName) return "";
  return process.env[envName] || "";
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

async function tavilySearch(connector: Connector, query: string, limit: number) {
  const apiKey = getApiKey((connector.configJson || {}).apiKeyEnv as string) || process.env.TAVILY_API_KEY || "";
  if (!apiKey) {
    logger.warn({ connectorId: connector.id }, "Tavily API key not configured");
    return [];
  }
  const res = await fetchWithTimeout("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      max_results: limit,
      include_raw_content: false,
    }),
  }, 15000); // 15 second timeout
  if (!res.ok) {
    logger.warn(
      { connectorId: connector.id, status: res.status, query },
      "Tavily API request failed"
    );
    return [];
  }
  const data = await res.json();
  return (data.results || []).map((item: any, idx: number) => ({
    id: item.url || `${connector.id}-${idx}`,
    title: item.title || "Result",
    url: item.url || "",
    snippet: item.content || item.snippet || "",
  }));
}

async function serpapiSearch(connector: Connector, query: string, limit: number) {
  const apiKey = getApiKey((connector.configJson || {}).apiKeyEnv as string) || process.env.SERPAPI_API_KEY || "";
  if (!apiKey) {
    logger.warn({ connectorId: connector.id }, "SerpAPI key not configured");
    return [];
  }
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  const res = await fetchWithTimeout(url.toString(), { method: "GET" }, 15000); // 15 second timeout
  if (!res.ok) {
    logger.warn(
      { connectorId: connector.id, status: res.status, query },
      "SerpAPI request failed"
    );
    return [];
  }
  const data = await res.json();
  const results = data.organic_results || [];
  return results.slice(0, limit).map((item: any, idx: number) => ({
    id: item.link || `${connector.id}-${idx}`,
    title: item.title || "Result",
    url: item.link || "",
    snippet: item.snippet || "",
  }));
}

async function customSearch(connector: Connector, query: string, limit: number) {
  const apiUrl = (connector.configJson || {}).apiUrl as string;
  if (!apiUrl) {
    logger.warn({ connectorId: connector.id }, "Custom search API URL not configured");
    return [];
  }
  const method = ((connector.configJson || {}).method as string) || "GET";
  const apiKeyEnv = (connector.configJson || {}).apiKeyEnv as string;
  const apiKey = getApiKey(apiKeyEnv);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  const reqUrl = new URL(apiUrl);
  if (method === "GET") {
    reqUrl.searchParams.set("q", query);
    reqUrl.searchParams.set("limit", String(limit));
  }
  const res = await fetchWithTimeout(reqUrl.toString(), {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify({ query, limit }),
  }, 15000); // 15 second timeout
  if (!res.ok) {
    logger.warn(
      { connectorId: connector.id, status: res.status, apiUrl },
      "Custom search API request failed"
    );
    return [];
  }
  const data = await res.json();
  const results = data.results || data.items || [];
  return results.slice(0, limit).map((item: any, idx: number) => ({
    id: item.url || item.link || `${connector.id}-${idx}`,
    title: item.title || "Result",
    url: item.url || item.link || "",
    snippet: item.snippet || item.content || "",
  }));
}

export async function searchWeb(connector: Connector, query: string, limit = 5): Promise<WebResult[]> {
  const provider = ((connector.configJson || {}).provider as string) || "mock";
  logger.debug({ connectorId: connector.id, provider, query, limit }, "Web search requested");

  if (provider === "tavily") {
    return tavilySearch(connector, query, limit);
  }
  if (provider === "serpapi") {
    return serpapiSearch(connector, query, limit);
  }
  if (provider === "custom") {
    return customSearch(connector, query, limit);
  }

  logger.debug({ connectorId: connector.id }, "Using mock web search provider");
  return [
    {
      id: `${connector.id}-mock`,
      title: "Mock Web Result",
      url: "https://example.com",
      snippet: `Mock result for "${query}" from ${connector.name}.`,
    },
  ];
}
