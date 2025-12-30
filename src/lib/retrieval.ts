type RetrievalQuery = {
  query: string;
  vectorStoreIds: string[];
  webAllowed: boolean;
  limit?: number;
  allowlist?: string[];
  blocklist?: string[];
};

type Connector = {
  id: string;
  type: string;
  name: string;
  configJson?: Record<string, unknown>;
};

type WebResult = {
  id: string;
  title: string;
  url: string;
  snippet: string;
};

export type EvidenceItem = {
  id: string;
  source: string;
  kind: "vector" | "web";
  content: string;
  metadata: Record<string, unknown>;
};

function buildVectorEvidence(
  connector: Connector,
  query: RetrievalQuery
): EvidenceItem {
  const vectorStoreId = connector.configJson?.vectorStoreId || connector.id;
  return {
    id: `${connector.id}-${query.query.replace(/\s+/g, "-").slice(0, 24)}`,
    source: connector.name,
    kind: "vector",
    content: `Placeholder evidence for "${query.query}" from vector store ${vectorStoreId}.`,
    metadata: { vectorStoreId },
  };
}

function isOpenAIVectorConnector(connector: Connector) {
  const provider = connector.configJson?.provider;
  if (provider === "openai") return true;
  if (connector.configJson?.vectorStoreId) return true;
  if (Array.isArray(connector.configJson?.vectorStores)) return true;
  return false;
}

async function buildWebEvidence(connector: Connector, query: RetrievalQuery): Promise<EvidenceItem[]> {
  const { searchWeb } = await import("@/lib/webSearch");
  const results: WebResult[] = await searchWeb(connector, query.query, query.limit || 5);
  const allowlist = (query.allowlist || []).map((item) => item.toLowerCase());
  const blocklist = (query.blocklist || []).map((item) => item.toLowerCase());
  const filtered = results.filter((item) => {
    if (!item.url) return true;
    const hostname = new URL(item.url).hostname.toLowerCase();
    if (blocklist.length && blocklist.some((entry) => hostname.includes(entry))) {
      return false;
    }
    if (allowlist.length && !allowlist.some((entry) => hostname.includes(entry))) {
      return false;
    }
    return true;
  });
  return filtered.map((item) => ({
    id: item.id,
    source: connector.name,
    kind: "web",
    content: item.snippet,
    metadata: { url: item.url, title: item.title },
  }));
}

async function fetchOpenAIVectorEvidence(
  connector: Connector,
  query: RetrievalQuery
): Promise<EvidenceItem[]> {
  if (!isOpenAIVectorConnector(connector)) {
    return [];
  }

  const vectorStores = Array.isArray(connector.configJson?.vectorStores)
    ? connector.configJson?.vectorStores
    : null;
  const resolvedStores = vectorStores && vectorStores.length > 0
    ? vectorStores
    : [
        {
          id: connector.configJson?.vectorStoreId || connector.id,
        },
      ];

  try {
    const { searchVectorStore } = await import("@/lib/openaiVectorStores");
    const resultsByStore = await Promise.all(
      resolvedStores.map(async (store: any) => {
        const vectorStoreId = store?.id;
        if (!vectorStoreId) return [];
        const fileIds =
          Array.isArray(store?.fileIds) && store.fileIds.length > 0
            ? store.fileIds
            : undefined;
        const results = await searchVectorStore({
          vectorStoreId,
          query: query.query,
          maxResults: 5,
          fileIds,
        });
        const filtered = fileIds
          ? results.filter((result: any) => {
              const resultFileId =
                result.file_id ||
                result.metadata?.file_id ||
                result.metadata?.fileId;
              return resultFileId && fileIds.includes(resultFileId);
            })
          : results;
        return filtered.map((result: any): EvidenceItem => ({
          id: result.id,
          source: connector.name,
          kind: "vector",
          content:
            result.content && result.content[0]?.text
              ? result.content[0].text
              : "OpenAI vector store result.",
          metadata: {
            vectorStoreId,
            fileId:
              result.file_id ||
              result.metadata?.file_id ||
              result.metadata?.fileId ||
              null,
          },
        }));
      })
    );
    return resultsByStore.flat();
  } catch (err) {
    const logger = require("@/lib/logger").logger;
    logger.error(
      { error: err, connectorId: connector.id, query: query.query },
      "Failed to fetch OpenAI vector evidence"
    );
    return [];
  }
}

export async function retrieveEvidenceBundle(
  connectors: Connector[],
  query: RetrievalQuery
): Promise<EvidenceItem[]> {
  const vectorConnectors = connectors.filter((c) => c.type === "VECTOR");
  const webConnectors = connectors.filter((c) => c.type === "WEB_SEARCH");
  const items: EvidenceItem[] = [];

  const selectedVectors = vectorConnectors.filter((connector) =>
    query.vectorStoreIds.includes(connector.id)
  );
  const openaiVectors = selectedVectors.filter(isOpenAIVectorConnector);
  selectedVectors
    .filter((connector) => !isOpenAIVectorConnector(connector))
    .forEach((connector) => {
      items.push(buildVectorEvidence(connector, query));
    });

  if (query.webAllowed && webConnectors.length > 0) {
    const webItems = await buildWebEvidence(webConnectors[0], query);
    items.push(...webItems);
  }

  if (openaiVectors.length === 0) {
    return items;
  }

  const openaiPromises = openaiVectors.map((connector) =>
    fetchOpenAIVectorEvidence(connector, query)
  );
  const openaiItems = await Promise.all(openaiPromises);
  openaiItems.forEach((list) => items.push(...list));
  return items;
}
