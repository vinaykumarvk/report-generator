# Template Objective and Section Purpose - Usage Documentation

## Overview

This document explains where and how the **template-level objective** (stored as `description`) and **section-level purpose** are captured and used in the report generation pipeline.

---

## 1. Template-Level Objective (Description)

### Where It's Captured

**Database Field:** `templates.description` (text field)

**UI Location:** 
- **Reports Studio** → Create/Edit Template → **"Objectives"** section (Step 1 of 3)
- File: `app/reports-studio/reports-studio-client.tsx` (lines ~1117-1200)
- The UI label says "Objectives" but it maps to the `description` field in the database

**Schema:**
```sql
CREATE TABLE templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text,  -- This is the "objective"
  ...
);
```

### How It's Used

#### 1. **Blueprint Generation** (Primary Use)
**File:** `src/lib/blueprintGenerator.ts` (lines 68-87)

When generating the report blueprint, the template description is used to provide context about the overall report purpose:

```typescript
export async function generateReportBlueprint(params: {
  templateName: string;
  templateDescription?: string;  // ← Template description
  sections: Array<{
    id: string;
    title: string;
    purpose?: string;  // ← Section purpose
  }>;
  ...
}) {
  const blueprintPrompt = `You are planning a comprehensive "${templateName}" report.

${templateDescription ? `REPORT PURPOSE:\n${templateDescription}\n\n` : ""}USER INPUT:
${JSON.stringify(userInput, null, 2)}

SECTIONS TO GENERATE:
${sections.map((s, i) => `${i + 1}. ${s.title}${s.purpose ? `: ${s.purpose}` : ""}`).join("\n")}
...
```

**Called from:** `workers/worker-core.js` (line 91-93)
```javascript
const cohesionBlueprint = await generateReportBlueprint({
  templateName: template.name || "Report",
  templateDescription: template.description,  // ← Used here
  sections: (template.sections || []).map(s => ({
    id: s.id,
    title: s.title,
    purpose: s.purpose  // ← Section purpose also passed
  })),
  ...
});
```

**Impact:** The template description helps the AI understand:
- The overall goal of the report
- The context and scope
- How to structure the narrative arc
- What terminology to use consistently

---

## 2. Section-Level Purpose

### Where It's Captured

**Database Field:** `template_sections.purpose` (text field)

**UI Location:**
- **Reports Studio** → Create/Edit Template → **"Sections"** section
- Each section has a "Purpose" textarea field
- File: `app/reports-studio/reports-studio-client.tsx` (lines ~1624, 2129, 2752)

**Schema:**
```sql
CREATE TABLE template_sections (
  id uuid PRIMARY KEY,
  template_id uuid REFERENCES templates(id),
  title text NOT NULL,
  purpose text,  -- This is the section purpose
  ...
);
```

### How It's Used

#### 1. **Blueprint Generation** (Section Context)
**File:** `src/lib/blueprintGenerator.ts` (line 87)

The section purpose is included in the blueprint prompt to help the AI understand what each section should accomplish:

```typescript
SECTIONS TO GENERATE:
${sections.map((s, i) => `${i + 1}. ${s.title}${s.purpose ? `: ${s.purpose}` : ""}`).join("\n")}
```

**Example Output:**
```
SECTIONS TO GENERATE:
1. Executive Summary: Provide a high-level overview of key findings
2. Market Analysis: Analyze current market conditions and trends
3. Recommendations: Provide actionable recommendations based on findings
```

#### 2. **Section Planning** (Outline Generation)
**File:** `src/lib/runEngine.ts` (line 146)

When planning a section, the purpose is used to create the initial outline:

```typescript
function planSection(section: SectionSnapshot) {
  return {
    outline: [`Cover purpose: ${section.purpose || section.title}`],
    retrievalQueries: [section.title],
    keyConstraints: [section.outputFormat || "NARRATIVE"],
    riskNotes: [],
  };
}
```

**Impact:** If a section has a purpose, the outline will explicitly state "Cover purpose: [purpose text]". Otherwise, it falls back to the section title.

#### 3. **Section Writing** (AI Prompt)
**File:** `src/lib/openaiWriter.ts` (line 154)

When generating the actual section content, the purpose is included in the prompt sent to OpenAI:

```typescript
const prompt = [
  "You are drafting a report section for a regulated audience.",
  "Follow the instructions exactly and return only the section content.",
  "",
  `Section Title: ${section.title}`,
  section.purpose ? `Purpose: ${section.purpose}` : "",  // ← Used here
  `Output Format: ${section.outputFormat || "NARRATIVE"}`,
  `Evidence Policy: ${section.evidencePolicy || "LLM_ONLY"}`,
  ...
].filter(Boolean).join("\n");
```

**Impact:** The purpose directly guides the AI on what content to generate for that specific section.

#### 4. **Section Context** (Additional Context)
**File:** `src/lib/runEngine.ts` (line 232)

The purpose is also used as additional context when writing sections:

```typescript
const contextText = [
  section.purpose ? section.purpose : "",
  ...
].filter(Boolean).join("\n");
```

---

## Summary

### Template Description (Objective)

| Aspect | Details |
|--------|---------|
| **Stored As** | `templates.description` |
| **UI Label** | "Objectives" (Step 1 in template creation) |
| **Primary Use** | Blueprint generation - provides overall report context |
| **Impact** | Helps AI understand report scope, narrative arc, terminology |

### Section Purpose

| Aspect | Details |
|--------|---------|
| **Stored As** | `template_sections.purpose` |
| **UI Location** | Section editing form (textarea field) |
| **Primary Uses** | 1. Blueprint generation (section context)<br>2. Section planning (outline generation)<br>3. Section writing (AI prompt)<br>4. Section context (additional guidance) |
| **Impact** | Directly guides AI on what each section should accomplish |

---

## Code Flow

```
1. User creates template
   └─> Enters "Objectives" (description) in UI
   └─> Enters "Purpose" for each section

2. User creates report run
   └─> Template snapshot includes description + section purposes

3. Blueprint Generation (handleGenerateBlueprint)
   └─> generateReportBlueprint() called with:
       - templateDescription: template.description
       - sections: [{ title, purpose }]
   └─> Used in blueprint prompt to guide overall structure

4. Section Generation (handleRunSection)
   └─> planSection() uses purpose for outline
   └─> runWriterPrompt() includes purpose in AI prompt
   └─> Directly influences generated content
```

---

## Best Practices

1. **Template Description (Objective):**
   - Should be 2-3 sentences describing the overall report goal
   - Helps ensure all sections align with the report's purpose
   - Example: "A comprehensive analysis of market conditions, competitive landscape, and strategic recommendations for Q4 2024."

2. **Section Purpose:**
   - Should be 1-2 sentences describing what the section should accomplish
   - More specific than the title
   - Example: "Provide a high-level summary of key findings, recommendations, and strategic implications for executive decision-making."

---

## Files Reference

- **UI Capture:**
  - `app/reports-studio/reports-studio-client.tsx` (template description & section purpose inputs)

- **Database Schema:**
  - `scripts/supabase_schema.sql` (templates.description, template_sections.purpose)

- **Usage:**
  - `src/lib/blueprintGenerator.ts` (blueprint generation)
  - `src/lib/runEngine.ts` (section planning & context)
  - `src/lib/openaiWriter.ts` (section writing prompt)
  - `workers/worker-core.js` (orchestration)


