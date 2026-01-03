/**
 * Executive Summary Generator
 * 
 * Generates executive summaries using a hierarchical approach
 * to work within LLM token limits while maintaining quality.
 */

const OPENAI_BASE_URL = "https://api.openai.com/v1";

function getApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return key;
}

function getModel() {
  return process.env.OPENAI_WRITE_MODEL || "gpt-4o-mini";
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 60000
): Promise<Response> {
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
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

export type SectionForSummary = {
  id: string;
  title: string;
  content: string;
};

type MiniSummary = {
  sectionId: string;
  title: string;
  summary: string;
};

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

async function generateMiniSummary(section: SectionForSummary): Promise<MiniSummary> {
  const prompt = `Summarize this report section in 150-200 words, focusing on key findings, insights, and conclusions.

SECTION: ${section.title}

CONTENT:
${section.content}

REQUIREMENTS:
- Extract the most important findings and insights
- Focus on actionable information and key takeaways
- Be concise but comprehensive
- Use clear, direct language
- 150-200 words maximum

OUTPUT ONLY THE SUMMARY (no labels, no explanations).`;

  const res = await fetchWithTimeout(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: "You are an expert at distilling complex information into concise, actionable summaries. You focus on key insights and findings."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.5,
        max_tokens: 300
      }),
    },
    60000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Mini-summary generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in mini-summary response");
  }

  return {
    sectionId: section.id,
    title: section.title,
    summary: content.trim()
  };
}

async function generateClusterSummary(miniSummaries: MiniSummary[]): Promise<string> {
  const prompt = `Synthesize these section summaries into a cohesive narrative (300-400 words).

SECTION SUMMARIES:
${miniSummaries.map(m => `${m.title}:\n${m.summary}`).join("\n\n")}

REQUIREMENTS:
- Create an integrated narrative that shows connections between sections
- Highlight key themes and patterns across sections
- Maintain logical flow
- Focus on the most important insights
- 300-400 words

OUTPUT ONLY THE SYNTHESIZED NARRATIVE (no labels, no explanations).`;

  const res = await fetchWithTimeout(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: "You are an expert at synthesizing multiple pieces of information into cohesive narratives. You identify connections and themes across content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 600
      }),
    },
    60000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Cluster summary generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in cluster summary response");
  }

  return content.trim();
}

async function extractCrossCuttingThemes(miniSummaries: MiniSummary[]): Promise<string[]> {
  const prompt = `Identify 3-5 cross-cutting themes across these section summaries.

SECTION SUMMARIES:
${miniSummaries.map(m => `${m.title}:\n${m.summary}`).join("\n\n")}

TASK:
Identify recurring themes, patterns, or insights that appear across multiple sections.

OUTPUT:
Return a JSON array of 3-5 theme strings.
Example: ["Digital transformation is accelerating", "Cost optimization is critical", "Customer experience drives growth"]

OUTPUT ONLY VALID JSON ARRAY.`;

  const res = await fetchWithTimeout(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: "You are an expert at identifying patterns and themes across content. Always output valid JSON."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      }),
    },
    60000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Theme extraction failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in theme extraction response");
  }

  try {
    const parsed = JSON.parse(content);
    // Handle both direct array and object with themes property
    const themes = Array.isArray(parsed) ? parsed : (parsed.themes || []);
    return themes;
  } catch (err) {
    console.warn("Failed to parse themes, using empty array:", err);
    return [];
  }
}

async function generateFinalExecutiveSummary(
  clusterSummaries: string[],
  themes: string[]
): Promise<string> {
  const prompt = `Create a comprehensive executive summary by synthesizing these narratives (500-800 words).

${themes.length > 0 ? `KEY THEMES:\n${themes.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\n` : ""}CONTENT NARRATIVES:
${clusterSummaries.map((s, i) => `PART ${i + 1}:\n${s}`).join("\n\n")}

REQUIREMENTS:
- Create a cohesive executive summary suitable for senior stakeholders
- Structure: Overview → Key Findings → Insights → Recommendations
- Emphasize the identified themes
- Use clear, executive-level language
- Include specific, actionable insights
- 500-800 words

OUTPUT ONLY THE EXECUTIVE SUMMARY (no labels, no explanations).`;

  const res = await fetchWithTimeout(
    `${OPENAI_BASE_URL}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getModel(),
        messages: [
          {
            role: "system",
            content: "You are an expert executive summary writer. You create compelling, actionable summaries for senior stakeholders that highlight key insights and recommendations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 1200
      }),
    },
    60000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Final executive summary generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in final executive summary response");
  }

  return content.trim();
}

export async function generateHierarchicalExecutiveSummary(
  sections: SectionForSummary[]
): Promise<string> {
  console.log(`📊 Generating hierarchical executive summary for ${sections.length} sections...`);

  // Step 1: Generate mini-summaries for each section (parallel)
  console.log("  Step 1/4: Generating mini-summaries...");
  const miniSummaries = await Promise.all(
    sections.map(section => generateMiniSummary(section))
  );
  console.log(`  ✅ Generated ${miniSummaries.length} mini-summaries`);

  // Step 2: Extract cross-cutting themes
  console.log("  Step 2/4: Extracting cross-cutting themes...");
  const themes = await extractCrossCuttingThemes(miniSummaries);
  console.log(`  ✅ Identified ${themes.length} themes: ${themes.join(", ")}`);

  // Step 3: Generate cluster summaries (if >5 sections)
  let clusterSummaries: string[];
  
  if (miniSummaries.length <= 5) {
    console.log("  Step 3/4: Skipping clustering (≤5 sections)");
    clusterSummaries = [await generateClusterSummary(miniSummaries)];
  } else {
    console.log("  Step 3/4: Generating cluster summaries...");
    const clusters = chunkArray(miniSummaries, 3); // Groups of 3
    clusterSummaries = await Promise.all(
      clusters.map((cluster, i) => {
        console.log(`    Cluster ${i + 1}/${clusters.length}`);
        return generateClusterSummary(cluster);
      })
    );
    console.log(`  ✅ Generated ${clusterSummaries.length} cluster summaries`);
  }

  // Step 4: Generate final executive summary
  console.log("  Step 4/4: Generating final executive summary...");
  const finalSummary = await generateFinalExecutiveSummary(clusterSummaries, themes);
  console.log("  ✅ Executive summary complete");

  return finalSummary;
}

