/**
 * Transitions Generator
 * 
 * Generates smart transitions between report sections to ensure
 * smooth narrative flow and logical connections.
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
  timeoutMs = 30000
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

export type SectionSummary = {
  id: string;
  title: string;
  content: string;
};

export type Transition = {
  afterSectionId: string;
  beforeSectionId: string;
  content: string;
};

function getLastNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(-n).join(" ");
}

function getFirstNWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  return words.slice(0, n).join(" ");
}

export async function generateTransition(
  prevSection: SectionSummary,
  nextSection: SectionSummary,
  options?: {
    tone?: string;
    keyTerminology?: string[];
  }
): Promise<string> {
  const tone = options?.tone || "professional and analytical";
  const terms = options?.keyTerminology || [];

  const transitionPrompt = `You are writing a transition between two report sections.

PREVIOUS SECTION: "${prevSection.title}"
(Last 300 words)
${getLastNWords(prevSection.content, 300)}

NEXT SECTION: "${nextSection.title}"
(First 300 words)
${getFirstNWords(nextSection.content, 300)}

TASK:
Write a transition paragraph (50-100 words) that:
1. Summarizes the key insight or conclusion from "${prevSection.title}"
2. Explains WHY "${nextSection.title}" logically follows
3. Creates a smooth narrative bridge between the sections
4. Maintains ${tone} tone
${terms.length > 0 ? `5. Uses consistent terminology: ${terms.join(", ")}` : ""}

GUIDELINES:
- Be concise but meaningful
- Avoid generic phrases like "moving on" or "next we will discuss"
- Create anticipation for the next section
- Ensure logical flow

OUTPUT ONLY THE TRANSITION PARAGRAPH (no labels, no explanations).`;

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
            content: "You are an expert report writer specializing in creating smooth transitions between sections. Your transitions are concise, meaningful, and create logical narrative flow."
          },
          {
            role: "user",
            content: transitionPrompt
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 200
      }),
    },
    30000
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Transition generation failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error("No content in transition response");
  }

  return content.trim();
}

export async function generateAllTransitions(
  sections: SectionSummary[],
  options?: {
    tone?: string;
    keyTerminology?: string[];
  }
): Promise<Transition[]> {
  const transitions: Transition[] = [];

  console.log(`🔗 Generating ${sections.length - 1} transitions...`);

  for (let i = 0; i < sections.length - 1; i++) {
    const prevSection = sections[i];
    const nextSection = sections[i + 1];

    console.log(`  Transition ${i + 1}/${sections.length - 1}: ${prevSection.title} → ${nextSection.title}`);

    try {
      const transitionContent = await generateTransition(prevSection, nextSection, options);
      
      transitions.push({
        afterSectionId: prevSection.id,
        beforeSectionId: nextSection.id,
        content: transitionContent
      });
    } catch (err) {
      console.error(`  ⚠️ Failed to generate transition ${i + 1}:`, err);
      // Continue with other transitions even if one fails
    }
  }

  console.log(`✅ Generated ${transitions.length} transitions`);
  return transitions;
}

export function assembleReportWithTransitions(
  sections: SectionSummary[],
  transitions: Transition[]
): string {
  let report = "";

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    
    // Add section content
    report += section.content;
    
    // Add transition after this section (if exists)
    const transition = transitions.find(t => t.afterSectionId === section.id);
    if (transition) {
      report += "\n\n---\n\n";
      report += transition.content;
      report += "\n\n---\n\n";
    } else {
      // Just add spacing between sections
      report += "\n\n";
    }
  }

  return report.trim();
}

