# **Business Requirements Document (BRD)**

## **Report Generation App (Template-Driven, Evidence-Aware, Best-in-Class)**

**Document Version:** 1.0  
**Date:** 2025-12-20  
**Owner:** Product / Founder  
**Primary Consumer:** Cursor (AI coding assistant) \+ Engineering team  
**Goal:** Provide a complete, implementation-ready BRD so Cursor can generate the full application end-to-end.

---

## **1\. Executive Summary**

This application enables users to create **report templates** (e.g., BRD, RFP response, research report) composed of **sections**. Each section defines:

* What the section should contain (purpose, format, length)  
* How it should be generated (**LLM-only**, **Vector Store**, **Web Search**, or combinations)  
* Which prompts/models to use per stage (plan → retrieve → write → verify → repair)  
* Which quality gates must pass (citations, evidence coverage, consistency, no-new-facts rules)

At runtime, users start a **Report Run** using a template \+ inputs. The system generates a **Blueprint** (shared definitions \+ assumptions), executes **per-section pipelines** (often in parallel), performs **cross-section normalization**, then assembles a final report with **TOC \+ executive summary**, and exports to Markdown/DOCX/PDF.

Best-in-class features include:

* Evidence policy enforcement (no cross-contamination)  
* Quality verification and repair loops  
* Reviewer simulation (skeptical reviewer/compliance)  
* Confidence/evidence scoring  
* Audit logs and provenance mapping  
* Delta-aware regeneration of impacted sections only

---

## **2\. Problem Statement**

Users want comprehensive, high-quality reports quickly. Current tools either:

* Produce “stitched AI answers” (low trust, inconsistent), or  
* Require heavy manual writing and editing, or  
* Fail to enforce evidence boundaries (dangerous for regulated/contractual output)

This app must produce documents that are:

* **Cohesive**  
* **Defensible (evidence-backed where required)**  
* **Repeatable (template-driven)**  
* **Auditable (provenance, citations, logs)**

---

## **3\. Objectives and Success Metrics**

### **3.1 Objectives**

1. Allow users to define and version **templates** with sections and evidence policies.  
2. Generate reports with **high coherence** across sections.  
3. Support 3 evidence modes per section: **LLM-only**, **Vector store**, **Web search** (plus combinations).  
4. Enforce quality gates and provide **repair loops**.  
5. Provide export formats and an audit trail.

### **3.2 Success Metrics (KPIs)**

* **Time-to-first-draft:** \< 5 minutes for medium templates (10–15 sections) in “Fast Draft” mode.  
* **Time-to-defensible-report:** \< 20 minutes in “Defensible” mode with verification.  
* **User edits reduction:** ≥ 30% reduction in manual edits after v2.  
* **Evidence compliance rate:** ≥ 99% of vector-only sections contain no web-derived claims.  
* **Template reuse:** ≥ 40% of reports created from existing templates (not ad hoc).  
* **User satisfaction:** ≥ 4.5/5 for output quality.

---

## **4\. Personas and Roles (RBAC)**

### **4.1 Roles**

* **Owner/Admin:** manage workspaces, connectors, global policies.  
* **Template Author:** create/edit templates and prompts.  
* **Report Writer:** run reports using templates, supply inputs, regenerate sections.  
* **Reviewer:** comment/approve blueprint or outputs; cannot change templates.  
* **Viewer:** read/export reports only.

### **4.2 Personas**

* Product Manager (BRD/PRD generation)  
* Sales Engineer (RFP response)  
* Analyst (research report)  
* Compliance Officer (review evidence and claims)

---

## **5\. Scope**

### **5.1 In Scope (v1)**

* Multi-tenant workspace (optional but recommended)  
* Template Studio:  
  * Section definitions  
  * Evidence policy per section  
  * Attach vector store(s) to sections  
  * Web search settings  
  * Prompt Studio with versioning  
  * Template validation/linting  
* Report Factory:  
  * Report Runs \+ job orchestration  
  * Blueprint generation  
  * Per-section plan/retrieve/write/verify/repair  
  * Cross-section normalization  
  * Final assembly: transitions, TOC, executive summary  
  * Export: Markdown (must), DOCX (should), PDF (optional)  
* Observability:  
  * Token/cost/time per section  
  * Evidence bundle capture  
  * Audit log of actions  
* Safety:  
  * Prompt injection defenses (web \+ docs)  
  * “No new facts” enforcement in final synthesis

### **5.2 Out of Scope (v1)**

* Real-time collaborative editing like Google Docs  
* Live co-authoring with cursors and comments at scale  
* Complex visual diagram generation (UML, BPMN) beyond simple tables  
* Full legal/compliance certification workflow (can be v2)

---

## **6\. High-Level User Journeys**

### **Journey A: Create Template → Run Report**

1. User creates a template: “BRD Generator”  
2. Adds sections: “Problem Statement”, “Scope”, “Requirements”, “Risks”  
3. For each section chooses evidence mode:  
   * Requirements: VECTOR\_ONLY (internal docs)  
   * Market Landscape: WEB\_ONLY (with citations)  
   * Executive Summary: SYNTHESIS\_ONLY (no new facts)  
4. User runs report: provides topic \+ context docs \+ selects vector store(s)  
5. App generates report with progress tracking  
6. User reviews outputs, regenerates weak sections, exports DOCX

### **Journey B: Delta-aware regeneration**

1. User edits an assumption (“target users include internal staff”)  
2. System identifies impacted sections (persona, requirements, scope)  
3. Only those sections regenerate; executive summary updates

---

## **7\. Product Principles (Non-Negotiables)**

1. **Evidence boundaries are enforced**  
   If a section is VECTOR\_ONLY, the generated text must not introduce web facts or unsupported claims.  
2. **Final synthesis must not introduce new claims**  
   Executive summary and cohesion passes summarize only the generated sections.  
3. **Auditability is built-in**  
   Every output is traceable to prompts, models, evidence bundles, and run configuration.  
4. **Two-speed UX**  
   “Fast Draft” vs “Defensible” modes with different strictness/cost/time.

---

## **8\. Functional Requirements (FR)**

Each requirement includes Priority: **MVP (P0)**, **P1**, **P2**.

### **~~8.1 Authentication, Workspaces, RBAC~~**

**~~FR-001 (P0):~~** ~~Users can sign in and belong to a workspace.~~  
**~~FR-002 (P0):~~** ~~Role-based access control (Owner/Admin/Author/Writer/Reviewer/Viewer).~~  
**~~FR-003 (P1):~~** ~~Invite users via email with role assignment.~~

**~~Acceptance Criteria~~**

* ~~Users without “Template Author” cannot modify templates/prompts.~~  
* ~~Viewer cannot start a report run.~~

---

### **8.2 Template Studio (Template Definition)**

**FR-010 (P0):** Create/edit templates with metadata: name, description, audience, tone, domain, jurisdiction.  
**FR-011 (P0):** Define ordered sections with:

* title  
* purpose  
* output format (narrative/bullets/table/requirements)  
* target length (short/medium/long or word range)  
* dependencies (optional: “requires blueprint glossary”, “depends on section X”)

**FR-012 (P0):** Evidence policy per section:

* `LLM_ONLY`  
* `VECTOR_ONLY`  
* `WEB_ONLY`  
* `VECTOR+LLM`  
* `WEB+LLM`  
* `VECTOR+WEB`  
* `ALL`  
* `SYNTHESIS_ONLY` (summarize existing sections only; no retrieval)

**FR-013 (P0):** Vector store attachment per section (one or more stores, with optional filters).  
**FR-014 (P0):** Web search settings per section:

* allowlist/blocklist domains  
* recency window (e.g., 90 days)  
* minimum sources (e.g., 3\)  
* citation style (inline footnotes/endnotes)

**Acceptance Criteria**

* A template cannot be “Published/Active” unless all sections have evidence policy set.  
* SYNTHESIS\_ONLY sections cannot request retrieval.

---

### **8.3 Connector Registry (Vector Stores \+ Web Providers)**

**FR-020 (P0):** Create/manage “Vector Store” connectors:

* name  
* description  
* type (pgvector / pinecone / other)  
* configuration (connection info stored as secrets)  
* tags

**FR-021 (P0):** Upload documents to a vector store OR register an existing store.

* Minimal MVP: upload docs → chunk → embed → store in pgvector.

**FR-022 (P1):** Web Search provider config:

* provider name  
* API key  
* default allowlist tiers (optional)  
* rate limits \+ backoff

**Acceptance Criteria**

* Vector store health check returns OK and document count \> 0\.  
* Web search requires configured provider; otherwise sections fail gracefully with actionable error.

---

### **8.4 Prompt Studio (User-Modifiable Prompts With Guardrails)**

**FR-030 (P0):** Prompt components:

* Global system prompt  
* Global developer prompt  
* Section-level prompts for: Plan, Write, Verify, Repair, Synthesis

**FR-031 (P0):** Prompt versioning:

* draft vs published  
* compare versions (diff)  
* rollback

**FR-032 (P1):** Guardrail enforcement:

* Non-removable policy clauses injected by the system (e.g., “VECTOR\_ONLY uses only evidence bundle”).

**Acceptance Criteria**

* Authors can edit prompts without breaking policy; app enforces mandatory clauses.

---

### **8.5 Model Registry and Generation Profiles**

**FR-040 (P0):** Model registry supports multiple models/providers (at least one provider in MVP).  
**FR-041 (P0):** Generation profiles:

* “Fast Draft”: fewer verification steps, less retrieval  
* “Defensible”: strict verification, citations required, reviewer simulation enabled

**Acceptance Criteria**

* Profile affects pipeline stage execution order and strictness.

---

### **8.6 Report Runs (Runtime Execution)**

**FR-050 (P0):** Create a Report Run from a template:

* input fields (topic, client name, constraints)  
* attach vector stores (if template allows overrides)  
* configure web recency override (optional)  
* choose profile (fast/defensible)

**FR-051 (P0):** Generate a **Blueprint**:

* glossary/definitions  
* assumptions  
* non-goals  
* scope boundaries  
* “do-not-repeat” guidance

**FR-052 (P0):** Per-section pipeline execution:

* Plan → Retrieve → Write → Verify → Repair loop (if needed)  
* sections can run in parallel when independent

**FR-053 (P0):** Cross-section normalization pass:

* normalize terminology to blueprint  
* deduplicate repeated content  
* flag unresolved conflicts

**FR-054 (P0):** Final assembly:

* transitions and cohesion pass  
* TOC generation  
* Executive Summary generation (SYNTHESIS\_ONLY rule)

**FR-055 (P0):** Progress tracking UI:

* per section status: queued/running/needs-review/failed/done  
* view artifacts: evidence bundle, prompts used, verification results

**Acceptance Criteria**

* A report run shows deterministic states and can be resumed after server restart (job queue persistence).  
* Failed sections show error reason \+ “retry” action.

---

### **8.7 Verification and Quality Gates (What Makes It Best-in-Class)**

**FR-060 (P0):** Verifier checks:

* Evidence compliance (VECTOR\_ONLY / WEB\_ONLY)  
* Citation count and format (where required)  
* Contradiction detection against blueprint definitions/assumptions  
* Redundancy detection against prior sections  
* Formatting requirements satisfied

**FR-061 (P0):** Repair loop:

* If verification fails, system generates targeted repair instructions and regenerates section.

**FR-062 (P1):** Claim-to-evidence mapping:

* For key claims, store evidence IDs used.

**Acceptance Criteria**

* VECTOR\_ONLY section must either:  
  * produce content with citations to internal evidence snippets, or  
  * explicitly list missing information questions.

---

### **8.8 Reviewer Simulation (Differentiator)**

**FR-070 (P1):** Reviewer simulation agent produces:

* objections and questions per section  
* risk flags (compliance/accuracy)  
* suggested strengthening areas  
* confidence score

**Acceptance Criteria**

* Reviewer output does not rewrite the report; it creates a review checklist.

---

### **8.9 Evidence and Confidence Scoring**

**FR-080 (P1):** Section-level evidence scoring:

* coverage score  
* diversity score  
* recency score (web)  
* redundancy score

**FR-081 (P1):** Report-level “Strength of Support” dashboard.

**Acceptance Criteria**

* Scores are shown and explainable (“coverage low because only 1 source matched”).

---

### **8.10 Delta-aware Regeneration**

**FR-090 (P2):** Dependency tracking between:

* sections  
* blueprint assumptions  
* evidence bundle queries  
* outputs

**FR-091 (P2):** If inputs change, system computes impacted sections and regenerates only those.

---

### **8.11 Export and Publishing**

**FR-100 (P0):** Export to Markdown with citations.  
**FR-101 (P1):** Export to DOCX.  
**FR-102 (P2):** Export to PDF.

**Acceptance Criteria**

* Export does not trigger regeneration.  
* Export captures template version and run metadata in appendix.

---

### **8.12 Audit, Logs, and Analytics**

**FR-110 (P0):** Audit log for:

* template edits  
* prompt edits  
* report runs started/canceled  
* exports generated

**FR-111 (P0):** Cost/time tracking per section:

* model used  
* tokens in/out  
* wall time  
* retries

---

## **9\. Non-Functional Requirements (NFR)**

### **9.1 Performance & Scalability**

* **NFR-001 (P0):** Support 20 concurrent report runs per workspace (configurable).  
* **NFR-002 (P0):** Parallel section execution with job queue.  
* **NFR-003 (P1):** Caching of retrieval results per query+filters.

### **9.2 Reliability**

* **NFR-010 (P0):** Job execution is durable across restarts.  
* **NFR-011 (P0):** Idempotent retries for section generation.

### **9.3 Security**

* **NFR-020 (P0):** Secrets stored encrypted (KMS or framework secrets).  
* **NFR-021 (P0):** RBAC enforced server-side (not only UI).  
* **NFR-022 (P0):** Prompt injection defenses:  
  * sanitize web snippets  
  * strip tool instructions from retrieved content  
  * enforce evidence policy at verifier stage

### **9.4 Privacy & Compliance (Configurable)**

* **NFR-030 (P1):** Optional PII redaction before sending text to LLM.  
* **NFR-031 (P1):** Data retention policies per workspace.

### **9.5 Maintainability**

* **NFR-040 (P0):** Clear module boundaries: template, run engine, retrieval, llm provider, verification.  
* **NFR-041 (P0):** Typed schemas for all stored artifacts.

---

## **10\. Recommended Technical Architecture (Implementation-Ready)**

### **10.1 Suggested Stack (Concrete Default)**

* **Frontend:** Next.js (App Router) \+ TypeScript \+ Tailwind  
* **Backend API:** Next.js Route Handlers (or separate Node service if preferred)  
* **DB:** Postgres \+ Supabase  
* **Vector Store (MVP):** Postgres \+ pgvector extension  
* **Queue:** Redis \+ BullMQ (background jobs for sections)  
* **Storage:** S3-compatible (or local filesystem in dev) for exports and artifacts  
* **Auth:** Auth.js / NextAuth  
* **Observability:** structured logs \+ request IDs; optional OpenTelemetry later

Cursor should implement with Docker Compose for local dev: Postgres \+ Redis.

### **10.2 Services / Modules**

1. **Template Service**  
2. **Prompt Service**  
3. **Connector Service** (vector \+ web provider configs)  
4. **Report Run Orchestrator**  
5. **Retrieval Engine**  
6. **LLM Provider Adapter**  
7. **Verification Engine**  
8. **Export Engine**  
9. **Audit/Telemetry**

### **10.3 Pipeline Invariants (Must Enforce)**

* VECTOR\_ONLY: writer model receives **only** evidence bundle \+ blueprint; if missing evidence → output “Missing info”.  
* WEB\_ONLY: writer model must cite web sources; if not enough sources found → fail verification.  
* SYNTHESIS\_ONLY: no retrieval tools; must summarize provided sections only.  
* Final assembly \+ exec summary: **no new facts**.

---

## **11\. Data Model (Supabase-Friendly)**

### **11.1 Core Entities**

**Workspace**

* id, name, createdAt

**User**

* id, email, name, createdAt

**WorkspaceMember**

* workspaceId, userId, role

**Template**

* id, workspaceId  
* name, description, audience, tone, jurisdiction  
* status: DRAFT | PUBLISHED | ARCHIVED  
* versionNumber  
* createdBy, createdAt, updatedAt

**TemplateSection**

* id, templateId, order  
* title, purpose  
* outputFormat: NARRATIVE | BULLETS | TABLE | REQUIREMENTS | JSON\_SCHEMA  
* targetLengthMin, targetLengthMax  
* evidencePolicy (enum above)  
* modelConfigId (optional)  
* webPolicyJson  
* vectorPolicyJson  
* createdAt, updatedAt

**PromptSet**

* id, templateId, versionNumber, status  
* globalSystemPrompt  
* globalDeveloperPrompt  
* perSectionOverrides (json)  
* createdAt

**Connector**

* id, workspaceId  
* type: VECTOR | WEB\_SEARCH  
* name, description  
* configEncryptedJson  
* createdAt

**~~VectorDocument~~**

* ~~id, connectorId~~  
* ~~filename, mimeType, metadataJson~~  
* ~~createdAt~~

**~~VectorChunk~~**

* ~~id, documentId~~  
* ~~chunkText~~  
* ~~embedding (vector)~~  
* ~~metadataJson (page, section, tags)~~  
* ~~createdAt~~

**Vectorstore ID \- maintain vectorstore id and description.** 

**ReportRun**

* id, templateId, templateVersionSnapshotJson  
* workspaceId, createdBy  
* profile: FAST | DEFENSIBLE  
* inputJson  
* status: QUEUED | RUNNING | FAILED | COMPLETED | CANCELED  
* startedAt, completedAt

**ReportBlueprint**

* id, reportRunId  
* blueprintJson (glossary, assumptions, nonGoals, boundaries)  
* createdAt

**SectionRun**

* id, reportRunId, templateSectionId  
* status: QUEUED | RUNNING | FAILED | NEEDS\_REVIEW | COMPLETED  
* attemptCount  
* timingsJson  
* modelUsed  
* createdAt, updatedAt

**EvidenceBundle**

* id, sectionRunId  
* vectorHitsJson (chunk ids \+ excerpts)  
* webHitsJson (url, title, date, snippet)  
* retrievalMetricsJson

**SectionArtifact**

* id, sectionRunId  
* type: PLAN | DRAFT | VERIFIED\_DRAFT | REVIEW\_NOTES | FINAL  
* contentMarkdown  
* contentJson (optional structured)  
* provenanceJson (claim→evidence ids)  
* createdAt

**Export**

* id, reportRunId  
* format: MARKDOWN | DOCX | PDF  
* filePath, createdAt

**AuditLog**

* id, workspaceId, actorUserId  
* actionType  
* targetType, targetId  
* detailsJson  
* createdAt

---

## **12\. API Requirements (Routes)**

Use REST. All endpoints require workspace auth.

### **Template APIs**

* `POST /api/templates` create template  
* `GET /api/templates` list templates  
* `GET /api/templates/:id` get template details  
* `PUT /api/templates/:id` update template metadata  
* `POST /api/templates/:id/sections` add section  
* `PUT /api/sections/:id` update section  
* `POST /api/templates/:id/publish` publish template version  
* `POST /api/templates/:id/validate` run template linter

### **Prompt APIs**

* `GET /api/templates/:id/prompts` list prompt versions  
* `POST /api/templates/:id/prompts` create prompt set version  
* `PUT /api/prompts/:id` edit prompt set  
* `POST /api/prompts/:id/publish` publish prompt version  
* `POST /api/prompts/:id/rollback` rollback

### **Connector APIs**

* `POST /api/connectors` create connector  
* `GET /api/connectors` list connectors  
* `POST /api/vector/upload` upload docs \+ ingest  
* `POST /api/vector/reindex` re-embed/re-chunk

### **Report Run APIs**

* `POST /api/report-runs` create run  
* `GET /api/report-runs` list runs  
* `GET /api/report-runs/:id` run details  
* `POST /api/report-runs/:id/start` start generation  
* `POST /api/report-runs/:id/cancel` cancel  
* `POST /api/section-runs/:id/retry` retry section  
* `POST /api/report-runs/:id/export` generate export

### **Streaming/Progress**

* `GET /api/report-runs/:id/events` (SSE) for progress updates

---

## **13\. UI/UX Requirements (Screens)**

### **13.1 Core Screens**

1. **Login / Workspace Switch**  
2. **Dashboard**  
   * templates list  
   * recent report runs  
3. **Template Studio**  
   * template metadata editor  
   * section list with reorder  
   * section editor: evidence policy, vector stores, web constraints  
   * validate/publish actions  
4. **Prompt Studio**  
   * prompt components editor  
   * version history \+ diff \+ publish/rollback  
5. **Connectors**  
   * vector stores list \+ upload docs \+ ingestion status  
   * web provider config  
6. **Run Report**  
   * select template  
   * fill inputs  
   * choose profile  
   * start run  
7. **Run Detail**  
   * section status list with progress  
   * view evidence bundle  
   * view draft \+ verifier notes  
   * retry/regenerate section  
   * export  
8. **Export Viewer**  
   * preview final markdown  
   * download docx/pdf

### **13.2 UX Non-negotiables**

* Visible provenance: “Sources used” per section when applicable  
* Clear “Fast vs Defensible” explanation  
* Errors are actionable (missing connector, no evidence found, web provider not set)

---

## **14\. Template Linter Rules (Validation Engine)**

**Lint Rule Set (must implement)**

1. All sections have an evidencePolicy.  
2. SYNTHESIS\_ONLY sections must not have retrieval enabled.  
3. VECTOR\_ONLY sections must have at least one vector connector configured.  
4. WEB\_ONLY sections must have web provider configured at workspace level.  
5. Exec summary must be SYNTHESIS\_ONLY or ALL with “no new facts” gate.  
6. Detect likely contradictions:  
   * same concept defined differently in two sections’ “expected content”  
7. Token risk warnings:  
   * estimate token budget per section vs model limits

---

## **15\. Generation Details (Prompting \+ Tooling Contract)**

### **15.1 Standard Stage Contracts**

Each SectionRun uses these stages (profile-dependent):

1. **Plan Stage**  
   Output: outline \+ retrieval queries \+ constraints checklist.  
2. **Retrieve Stage**  
   Output: EvidenceBundle.  
3. **Write Stage**  
   Output: draft section text (Markdown and/or structured JSON).  
4. **Verify Stage**  
   Output: pass/fail \+ issues list \+ confidence/evidence scores.  
5. **Repair Stage (if needed)**  
   Output: corrected draft.

### **15.2 Prompt Variables (must support)**

* `{{blueprint}}`  
* `{{section_title}}`  
* `{{section_purpose}}`  
* `{{section_constraints}}`  
* `{{evidence_policy}}`  
* `{{evidence_bundle}}`  
* `{{prior_sections_sanitized_summary}}` (optional; no new facts)

---

## **16\. Testing and Acceptance Criteria**

### **16.1 Automated Test Coverage**

* Unit tests:  
  * linter rules  
  * evidence policy enforcement logic  
  * citation formatter  
* Integration tests:  
  * report run pipeline on sample template  
  * vector ingestion and retrieval  
  * web search provider stub  
* E2E tests (Playwright):  
  * create template → publish → run report → export markdown

### **16.2 Key Acceptance Tests**

1. **VECTOR\_ONLY containment test:**  
   Force a web-only fact into context; verifier must flag contamination and fail.  
2. **SYNTHESIS\_ONLY guard test:**  
   Executive summary must not include any claim not present in sections.  
3. **Repair loop test:**  
   When citations are missing, system repairs section and passes.  
4. **Audit test:**  
   Every report run records template version snapshot, prompts used, models used.

---

## **17\. MVP Deliverables (P0 Checklist)**

* Auth \+ workspace \+ RBAC (basic)  
* Template Studio with sections \+ evidence policy  
* Vector store ingestion (pgvector) \+ retrieval  
* Web search connector config (stub \+ integration interface)  
* Prompt Studio with versioning and mandatory guardrails  
* Report runs with:  
  * blueprint generation  
  * per-section pipeline  
  * verification \+ repair  
  * final assembly with TOC \+ exec summary  
* Markdown export  
* Run dashboard with evidence display and retry

---

## **18\. Roadmap (Recommended)**

### **Phase 1 (MVP)**

* Everything P0 above.

### **Phase 2 (Quality \+ Trust)**

* Reviewer simulation (FR-070)  
* Evidence/confidence scoring (FR-080)  
* DOCX export (FR-101)  
* PII redaction option

### **Phase 3 (Enterprise-grade)**

* Delta-aware regeneration (FR-090)  
* Advanced caching  
* PDF export  
* Full governance (retention policies, approvals)

---

## **19\. Risks and Mitigations**

**Risk:** Prompt injection via web pages  
**Mitigation:** sanitize snippets, enforce policies in verifier, disallow tool instructions from evidence.

**Risk:** “Stitched” report tone inconsistency  
**Mitigation:** blueprint glossary \+ normalization pass \+ separate cohesion pass.

**Risk:** Unclear evidence coverage (hallucinations)  
**Mitigation:** claim-to-evidence mapping \+ strict verifier \+ missing-info outputs.

---

## **~~20\. Open Questions (For Product Decisions)~~**

1. ~~Do you want SaaS multi-tenant from day 1, or single-tenant internal tool?~~  
2. ~~Should users be allowed to run web search without citations? (Recommended: no.)~~  
3. ~~Should templates support conditional sections (if/else)? (Nice-to-have P2.)~~  
4. ~~Should structured outputs be required for BRD requirements sections? (Recommended: yes.)~~

---

## **Appendix A: Example Template JSON (Cursor should implement compatible schema)**

{  
  "template": {  
    "name": "BRD Generator",  
    "audience": "Business \+ Engineering Leadership",  
    "tone": "Consulting-grade, concise, neutral",  
    "jurisdiction": "Global",  
    "sections": \[  
      {  
        "order": 1,  
        "title": "Executive Summary",  
        "purpose": "Summarize key goals, scope, approach, risks, and next actions.",  
        "outputFormat": "NARRATIVE",  
        "evidencePolicy": "SYNTHESIS\_ONLY",  
        "qualityGates": \["NO\_NEW\_FACTS", "NO\_JARGON"\]  
      },  
      {  
        "order": 2,  
        "title": "Problem Statement",  
        "purpose": "Define the business problem and why it matters now.",  
        "outputFormat": "NARRATIVE",  
        "evidencePolicy": "LLM\_ONLY",  
        "qualityGates": \["NO\_CONTRADICTIONS\_WITH\_BLUEPRINT"\]  
      },  
      {  
        "order": 3,  
        "title": "Requirements",  
        "purpose": "List functional and non-functional requirements.",  
        "outputFormat": "REQUIREMENTS",  
        "evidencePolicy": "VECTOR\_ONLY",  
        "vectorPolicy": {  
          "connectorIds": \["vs\_internal\_docs"\],  
          "topK": 12,  
          "filters": { "tag": \["requirements", "prd", "brd"\] }  
        },  
        "qualityGates": \["MUST\_CITE\_INTERNAL\_SOURCES", "MUST\_OUTPUT\_JSON\_AND\_MARKDOWN"\]  
      },  
      {  
        "order": 4,  
        "title": "Market Landscape",  
        "purpose": "Summarize current market context and competitor capabilities.",  
        "outputFormat": "BULLETS",  
        "evidencePolicy": "WEB\_ONLY",  
        "webPolicy": {  
          "minSources": 3,  
          "recencyDays": 180,  
          "domainAllowlist": \["gartner.com", "forrester.com", "aws.amazon.com", "microsoft.com"\]  
        },  
        "qualityGates": \["MUST\_INCLUDE\_CITATIONS"\]  
      }  
    \]  
  }  
}

---

## **Appendix B: “Cursor Build Notes” (Implementation Guidance)**

Cursor should implement:

* Durable job queue (BullMQ \+ Redis) for SectionRuns  
* SSE endpoint for live progress  
* Supabase schema matching the BRD entities  
* A retrieval abstraction:  
  * `retrieveVector(sectionConfig, queryPlan)`  
  * `retrieveWeb(sectionConfig, queryPlan)`  
* A generation abstraction:  
  * `runPlanner()`, `runWriter()`, `runVerifier()`, `runRepair()`  
* Guardrail middleware:  
  * enforce evidence policy in verifier  
  * block synthesis stages from retrieval tools  
* Export pipeline:  
  * Markdown in MVP  
  * DOCX converter (phase 2\)

---

If you want, I can also produce a **second artifact** that Cursor often benefits from even more than a BRD: a **Developer Specification Pack** containing:

* Supabase schema (ready-to-paste)  
* OpenAPI spec for all endpoints  
* UI component map \+ routes  
* Job queue event schema  
* Prompt template skeletons (Plan/Write/Verify/Repair/Synthesis)

Say: **“Create the Developer Specification Pack”** and I’ll generate it in a Cursor-friendly format.

Below is a **Developer Specification Pack** you can paste into Cursor as the single source of truth for building the app end-to-end. It is written to be **implementation-ready**: clear file layout, data model, API contracts, queue/job schema, SSE events, and prompt skeletons \+ guardrail rules.

---

# **Developer Specification Pack**

## **Report Generation App (Template-Driven, Evidence-Aware)**

**Version:** 1.0  
**Date:** 2025-12-20  
**Primary Goal:** Cursor can generate a full working application from this spec (MVP \+ strong foundations).

---

## **0\) Build Target and Default Tech Stack**

### **Runtime & Stack (default)**

* **Frontend:** Next.js (App Router) \+ TypeScript \+ Tailwind  
* **Backend:** Next.js Route Handlers (REST APIs) \+ background workers  
* **Auth:** Auth.js / NextAuth (email/password or magic link OK; keep extensible)  
* **DB:** Postgres \+ Supabase  
* **Vector store (MVP):** Postgres \+ `pgvector`  
* **Queue:** Redis \+ BullMQ  
* **Object storage:** Local filesystem for dev; S3-compatible for prod (abstracted)  
* **Streaming:** SSE for run progress

### **Two execution profiles**

* `FAST`: plan \+ retrieve \+ write \+ light verify  
* `DEFENSIBLE`: plan \+ retrieve \+ write \+ strict verify \+ repair loop \+ optional reviewer simulation

---

## **1\) Repository Layout (Cursor should implement)**

/app  
  /(auth)  
    /login/page.tsx  
  /(app)  
    /dashboard/page.tsx  
    /templates/page.tsx  
    /templates/\[templateId\]/page.tsx  
    /templates/\[templateId\]/prompts/page.tsx  
    /connectors/page.tsx  
    /runs/page.tsx  
    /runs/\[runId\]/page.tsx  
    /runs/\[runId\]/export/page.tsx  
  /api  
    /templates/route.ts  
    /templates/\[templateId\]/route.ts  
    /templates/\[templateId\]/sections/route.ts  
    /templates/\[templateId\]/validate/route.ts  
    /templates/\[templateId\]/publish/route.ts

    /prompts/route.ts  
    /prompts/\[promptSetId\]/route.ts  
    /prompts/\[promptSetId\]/publish/route.ts  
    /prompts/\[promptSetId\]/rollback/route.ts

    /connectors/route.ts  
    /vector/upload/route.ts  
    /vector/reindex/route.ts

    /report-runs/route.ts  
    /report-runs/\[runId\]/route.ts  
    /report-runs/\[runId\]/start/route.ts  
    /report-runs/\[runId\]/cancel/route.ts  
    /report-runs/\[runId\]/export/route.ts  
    /report-runs/\[runId\]/events/route.ts

    /section-runs/\[sectionRunId\]/retry/route.ts

/src  
  /lib  
    auth.ts  
    db.ts  
    env.ts  
    rbac.ts  
    audit.ts

    queue.ts  
    events.ts

    policies.ts  
    linter.ts

    retrieval.vector.ts  
    retrieval.web.ts

    llm.provider.ts  
    llm.prompts.ts  
    llm.schemas.ts

    pipeline.blueprint.ts  
    pipeline.section.ts  
    pipeline.normalize.ts  
    pipeline.assemble.ts  
    pipeline.export.ts

    citations.ts  
    sanitize.ts  
    scoring.ts

  /components  
    TemplateEditor.tsx  
    SectionEditor.tsx  
    PromptEditor.tsx  
    RunProgress.tsx  
    EvidenceViewer.tsx  
    SectionArtifactViewer.tsx  
    ExportViewer.tsx

/supabase  
  schema.supabase  
  /migrations/... (includes pgvector enable \+ vector column)

/workers  
  worker.ts   (BullMQ processor)

/docs  
  openapi.yaml  
  prompt-pack.md

/docker-compose.yml  
/README.md

---

## **2\) Environment Variables**

Create `/src/lib/env.ts` validating via Zod.

// src/lib/env.ts  
import { z } from "zod";

export const env \= z.object({  
  NODE\_ENV: z.string().default("development"),  
  DATABASE\_URL: z.string().url(),  
  REDIS\_URL: z.string(),  
  NEXTAUTH\_SECRET: z.string().min(16),

  // Web Search provider (optional in dev; required if WEB policies used)  
  WEB\_SEARCH\_PROVIDER: z.enum(\["stub", "serpapi", "bing", "custom"\]).default("stub"),  
  WEB\_SEARCH\_API\_KEY: z.string().optional(),

  // LLM provider config  
  LLM\_PROVIDER: z.enum(\["openai", "stub"\]).default("stub"),  
  LLM\_API\_KEY: z.string().optional(),

  // Storage  
  STORAGE\_DRIVER: z.enum(\["local", "s3"\]).default("local"),  
  STORAGE\_LOCAL\_DIR: z.string().default("./.storage"),  
  S3\_ENDPOINT: z.string().optional(),  
  S3\_BUCKET: z.string().optional(),  
  S3\_ACCESS\_KEY: z.string().optional(),  
  S3\_SECRET\_KEY: z.string().optional(),

  // Embeddings  
  EMBEDDING\_MODEL: z.string().default("text-embedding-3-large"),  
  EMBEDDING\_DIM: z.coerce.number().int().positive().default(3072),

  // Guardrails  
  MAX\_REPAIR\_ATTEMPTS: z.coerce.number().int().min(0).max(10).default(2),  
}).parse(process.env);

---

## **3\) Database Schema (Supabase)**

### **3.1 Supabase schema (`/supabase/schema.supabase`)**

Note: pgvector column can be represented using `Unsupported("vector")` \+ raw SQL migration.

generator client {  
  provider \= "supabase-client-js"  
}

datasource db {  
  provider \= "postgresql"  
  url      \= env("DATABASE\_URL")  
}

enum TemplateStatus {  
  DRAFT  
  PUBLISHED  
  ARCHIVED  
}

enum PromptStatus {  
  DRAFT  
  PUBLISHED  
  ARCHIVED  
}

enum EvidencePolicy {  
  LLM\_ONLY  
  VECTOR\_ONLY  
  WEB\_ONLY  
  VECTOR\_LLM  
  WEB\_LLM  
  VECTOR\_WEB  
  ALL  
  SYNTHESIS\_ONLY  
}

enum OutputFormat {  
  NARRATIVE  
  BULLETS  
  TABLE  
  REQUIREMENTS  
  JSON\_SCHEMA  
}

enum RunProfile {  
  FAST  
  DEFENSIBLE  
}

enum RunStatus {  
  QUEUED  
  RUNNING  
  FAILED  
  COMPLETED  
  CANCELED  
}

enum SectionRunStatus {  
  QUEUED  
  RUNNING  
  FAILED  
  NEEDS\_REVIEW  
  COMPLETED  
}

enum ArtifactType {  
  PLAN  
  DRAFT  
  VERIFIED\_DRAFT  
  REVIEW\_NOTES  
  FINAL  
  SYNTHESIS  
}

enum ConnectorType {  
  VECTOR  
  WEB\_SEARCH  
}

enum ExportFormat {  
  MARKDOWN  
  DOCX  
  PDF  
}

enum Role {  
  OWNER  
  ADMIN  
  TEMPLATE\_AUTHOR  
  REPORT\_WRITER  
  REVIEWER  
  VIEWER  
}

model Workspace {  
  id        String   @id @default(cuid())  
  name      String  
  createdAt DateTime @default(now())

  members   WorkspaceMember\[\]  
  templates Template\[\]  
  connectors Connector\[\]  
  reportRuns ReportRun\[\]  
  auditLogs AuditLog\[\]  
}

model User {  
  id        String   @id @default(cuid())  
  email     String   @unique  
  name      String?  
  createdAt DateTime @default(now())

  memberships WorkspaceMember\[\]  
}

model WorkspaceMember {  
  id          String   @id @default(cuid())  
  workspaceId String  
  userId      String  
  role        Role

  workspace Workspace @relation(fields: \[workspaceId\], references: \[id\])  
  user      User      @relation(fields: \[userId\], references: \[id\])

  @@unique(\[workspaceId, userId\])  
}

model Template {  
  id          String        @id @default(cuid())  
  workspaceId String  
  name        String  
  description String?  
  audience    String?  
  tone        String?  
  jurisdiction String?  
  status      TemplateStatus @default(DRAFT)  
  versionNumber Int         @default(1)  
  createdBy   String?  
  createdAt   DateTime      @default(now())  
  updatedAt   DateTime      @updatedAt

  workspace   Workspace     @relation(fields: \[workspaceId\], references: \[id\])  
  sections    TemplateSection\[\]  
  promptSets  PromptSet\[\]  
}

model TemplateSection {  
  id          String        @id @default(cuid())  
  templateId  String  
  sortOrder   Int  
  title       String  
  purpose     String  
  outputFormat OutputFormat  
  targetLengthMin Int?  
  targetLengthMax Int?  
  evidencePolicy EvidencePolicy  
  modelConfigJson Json?       // optional: model per stage overrides  
  webPolicyJson   Json?  
  vectorPolicyJson Json?  
  qualityGatesJson Json?  
  createdAt   DateTime      @default(now())  
  updatedAt   DateTime      @updatedAt

  template    Template      @relation(fields: \[templateId\], references: \[id\])

  @@index(\[templateId, sortOrder\])  
}

model PromptSet {  
  id          String      @id @default(cuid())  
  templateId  String  
  versionNumber Int       @default(1)  
  status      PromptStatus @default(DRAFT)

  globalSystemPrompt   String  
  globalDeveloperPrompt String  
  perSectionOverrides  Json?   // { sectionId: { planPrompt, writePrompt, verifyPrompt, repairPrompt, synthesisPrompt } }

  createdAt DateTime @default(now())  
  updatedAt DateTime @updatedAt

  template Template @relation(fields: \[templateId\], references: \[id\])  
}

model Connector {  
  id          String       @id @default(cuid())  
  workspaceId String  
  type        ConnectorType  
  name        String  
  description String?  
  configEncryptedJson Json  
  createdAt   DateTime @default(now())  
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: \[workspaceId\], references: \[id\])

  documents VectorDocument\[\]  
}

model VectorDocument {  
  id          String   @id @default(cuid())  
  connectorId String  
  filename    String  
  mimeType    String  
  metadataJson Json?  
  createdAt   DateTime @default(now())

  connector Connector @relation(fields: \[connectorId\], references: \[id\])  
  chunks    VectorChunk\[\]  
}

model VectorChunk {  
  id          String   @id @default(cuid())  
  documentId  String  
  chunkIndex  Int  
  chunkText   String  
  // pgvector embedding stored as vector column; Supabase uses Unsupported  
  embedding   Unsupported("vector")?  
  metadataJson Json?  
  createdAt   DateTime @default(now())

  document VectorDocument @relation(fields: \[documentId\], references: \[id\])

  @@index(\[documentId, chunkIndex\])  
}

model ReportRun {  
  id          String    @id @default(cuid())  
  workspaceId String  
  templateId  String  
  templateSnapshotJson Json  
  profile     RunProfile  
  inputJson   Json  
  status      RunStatus @default(QUEUED)  
  createdBy   String?  
  startedAt   DateTime?  
  completedAt DateTime?  
  createdAt   DateTime @default(now())  
  updatedAt   DateTime @updatedAt

  workspace Workspace @relation(fields: \[workspaceId\], references: \[id\])  
  template  Template  @relation(fields: \[templateId\], references: \[id\])  
  blueprint ReportBlueprint?  
  sectionRuns SectionRun\[\]  
  exports   Export\[\]  
}

model ReportBlueprint {  
  id         String   @id @default(cuid())  
  reportRunId String  @unique  
  blueprintJson Json  
  createdAt  DateTime @default(now())

  reportRun  ReportRun @relation(fields: \[reportRunId\], references: \[id\])  
}

model SectionRun {  
  id           String         @id @default(cuid())  
  reportRunId  String  
  templateSectionId String  
  status       SectionRunStatus @default(QUEUED)  
  attemptCount Int            @default(0)  
  timingsJson  Json?  
  modelUsed    String?  
  createdAt    DateTime @default(now())  
  updatedAt    DateTime @updatedAt

  reportRun    ReportRun @relation(fields: \[reportRunId\], references: \[id\])

  evidenceBundle EvidenceBundle?  
  artifacts     SectionArtifact\[\]  
}

model EvidenceBundle {  
  id           String   @id @default(cuid())  
  sectionRunId String   @unique  
  vectorHitsJson Json?  
  webHitsJson    Json?  
  retrievalMetricsJson Json?  
  createdAt    DateTime @default(now())

  sectionRun   SectionRun @relation(fields: \[sectionRunId\], references: \[id\])  
}

model SectionArtifact {  
  id           String   @id @default(cuid())  
  sectionRunId String  
  type         ArtifactType  
  contentMarkdown String?  
  contentJson   Json?  
  provenanceJson Json?   // claim-\>evidence mapping, issues, etc.  
  createdAt    DateTime @default(now())

  sectionRun   SectionRun @relation(fields: \[sectionRunId\], references: \[id\])

  @@index(\[sectionRunId, type\])  
}

model Export {  
  id         String      @id @default(cuid())  
  reportRunId String  
  format     ExportFormat  
  filePath   String  
  createdAt  DateTime @default(now())

  reportRun  ReportRun @relation(fields: \[reportRunId\], references: \[id\])  
}

model AuditLog {  
  id         String   @id @default(cuid())  
  workspaceId String  
  actorUserId String?  
  actionType String  
  targetType String  
  targetId   String?  
  detailsJson Json?  
  createdAt  DateTime @default(now())

  workspace Workspace @relation(fields: \[workspaceId\], references: \[id\])  
}

### **3.2 Required SQL migration for pgvector**

Create a migration that runs:

\-- Enable extension  
CREATE EXTENSION IF NOT EXISTS vector;

\-- Example: add embedding column if Supabase didn't create it properly  
\-- (You may need to drop/recreate the VectorChunk.embedding column via SQL)  
\-- Ensure dimension matches env.EMBEDDING\_DIM (e.g., 3072\)  
ALTER TABLE "VectorChunk"  
  ADD COLUMN IF NOT EXISTS "embedding" vector(3072);

\-- Index for ANN search (IVFFLAT). Requires analyze; adjust lists as needed.  
CREATE INDEX IF NOT EXISTS "VectorChunk\_embedding\_ivfflat"  
  ON "VectorChunk"  
  USING ivfflat ("embedding") WITH (lists \= 100);

---

## **4\) Domain Schemas (Zod DTOs)**

Create `/src/lib/llm.schemas.ts` and `/src/lib/events.ts` with Zod schemas.

### **4.1 Evidence bundle types**

export type VectorHit \= {  
  chunkId: string;  
  documentId: string;  
  score: number;  
  excerpt: string;  
  metadata?: Record\<string, any\>;  
};

export type WebHit \= {  
  url: string;  
  title: string;  
  publisher?: string;  
  publishedAt?: string; // ISO  
  snippet: string;  
};

export type EvidenceBundleDTO \= {  
  vectorHits?: VectorHit\[\];  
  webHits?: WebHit\[\];  
  metrics?: {  
    queryCount: number;  
    elapsedMs: number;  
    coverageScore?: number;  
  };  
};

### **4.2 Section plan output (planner)**

export type SectionPlanDTO \= {  
  outline: string\[\];               // bullet outline  
  retrievalQueries: string\[\];      // search queries (vector/web)  
  keyConstraints: string\[\];        // e.g. "must cite", "no new facts"  
  riskNotes?: string\[\];            // likely contradictions/needs  
};

### **4.3 Writer output (for provenance-enabled sections)**

Require JSON-wrapped output for strict sections (VECTOR\_ONLY, WEB\_ONLY, DEFENSIBLE profile):

export type SectionWriteDTO \= {  
  markdown: string;  
  claims?: Array\<{  
    id: string;  
    claim: string;  
    evidenceIds: string\[\];   // chunkIds or web URLs (normalized IDs)  
  }\>;  
  openQuestions?: string\[\];  
};

### **4.4 Verifier output**

export type SectionVerifyDTO \= {  
  pass: boolean;  
  issues: Array\<{  
    code: string;        // e.g. "MISSING\_CITATIONS", "POLICY\_VIOLATION"  
    severity: "low" | "medium" | "high";  
    message: string;  
    locationHint?: string;  
  }\>;  
  scores?: {  
    coverage?: number;   // 0..1  
    recency?: number;    // 0..1  
    diversity?: number;  // 0..1  
    redundancy?: number; // 0..1 (lower better)  
  };  
  suggestedRepairInstructions?: string\[\];  
};

---

## **5\) Policies and Guardrails (Hard Rules)**

Implement `/src/lib/policies.ts`.

### **5.1 Evidence policy enforcement rules**

**Invariant rules (must enforce in verifier):**

* `VECTOR_ONLY`: content must be attributable to vector hits; **no web facts**.  
* `WEB_ONLY`: must include citations to web hits; **no vector-only claims unless allowed**.  
* `LLM_ONLY`: must not introduce “specific factual claims about org/project” unless provided via inputs; mostly structural.  
* `SYNTHESIS_ONLY`: **no retrieval**. Must summarize **only** existing section artifacts.

### **5.2 “No new facts” rule for synthesis stages**

For executive summary / cohesion:

* Generate from **sanitized section summaries** only  
* Do not call retrieval tools  
* Verifier checks that summary claims are present in earlier text (heuristic \+ optional string entailment check)

### **5.3 Prompt injection defenses**

Implement `/src/lib/sanitize.ts`:

* Strip any content that looks like tool instructions:  
  * “ignore previous instructions”, “system prompt”, “call tool”, etc.  
* Truncate overly long snippets  
* Store raw and sanitized forms, but feed only sanitized into LLM

---

## **6\) Job Queue and Orchestration**

### **6.1 BullMQ queues**

* Queue: `report-run`  
  * job types: `START_RUN`, `ASSEMBLE_REPORT`, `EXPORT`  
* Queue: `section-run`  
  * job types: `RUN_SECTION_PIPELINE`

### **6.2 Job payloads**

export type StartRunJob \= {  
  reportRunId: string;  
  workspaceId: string;  
};

export type SectionPipelineJob \= {  
  reportRunId: string;  
  sectionRunId: string;  
  templateSectionId: string;  
  workspaceId: string;  
  profile: "FAST" | "DEFENSIBLE";  
};

export type AssembleJob \= {  
  reportRunId: string;  
  workspaceId: string;  
};

export type ExportJob \= {  
  reportRunId: string;  
  workspaceId: string;  
  format: "MARKDOWN" | "DOCX" | "PDF";  
};

### **6.3 State machine (must implement)**

**ReportRun.status**

* `QUEUED` → `RUNNING` → (`FAILED` | `COMPLETED` | `CANCELED`)

**SectionRun.status**

* `QUEUED` → `RUNNING` → (`FAILED` | `NEEDS_REVIEW` | `COMPLETED`)

**Rules**

* If any required section fails in DEFENSIBLE profile → report becomes `FAILED` unless user retries/resolves.  
* In FAST profile, allow report completion even if some sections are `NEEDS_REVIEW` (configurable).

---

## **7\) SSE Events (Progress Streaming)**

Endpoint: `GET /api/report-runs/{runId}/events`  
Content-Type: `text/event-stream`

### **7.1 Event schema**

export type RunEvent \=  
  | { type: "RUN\_STARTED"; runId: string; at: string }  
  | { type: "BLUEPRINT\_CREATED"; runId: string; at: string }  
  | { type: "SECTION\_STATUS"; runId: string; sectionRunId: string; status: string; at: string }  
  | { type: "SECTION\_ARTIFACT"; runId: string; sectionRunId: string; artifactType: string; at: string }  
  | { type: "RUN\_FAILED"; runId: string; error: string; at: string }  
  | { type: "RUN\_COMPLETED"; runId: string; at: string }  
  | { type: "EXPORT\_READY"; runId: string; exportId: string; format: string; at: string };

### **7.2 Delivery requirement**

* Server stores latest events in DB or in-memory buffer keyed by runId.  
* SSE streams historical recent events on connect, then live events.

---

## **8\) Retrieval Engines**

### **8.1 Vector retrieval (`/src/lib/retrieval.vector.ts`)**

Required behavior:

* Embed query  
* Perform vector similarity search in `VectorChunk.embedding`  
* Return topK hits with excerpts and metadata  
* Allow metadata filters from section’s `vectorPolicyJson`

**Signature**

export async function retrieveVector(params: {  
  connectorIds: string\[\];  
  query: string;  
  topK: number;  
  filters?: Record\<string, any\>;  
}): Promise\<VectorHit\[\]\>

### **8.2 Web retrieval (`/src/lib/retrieval.web.ts`)**

* Abstract provider (stub in dev)  
* Enforce allowlist/blocklist \+ recencyDays

**Signature**

export async function retrieveWeb(params: {  
  query: string;  
  recencyDays?: number;  
  minSources?: number;  
  domainAllowlist?: string\[\];  
  domainBlocklist?: string\[\];  
}): Promise\<WebHit\[\]\>

---

## **9\) LLM Provider Adapter**

Implement `/src/lib/llm.provider.ts` with a provider interface.

export type LLMCall \= {  
  model: string;  
  system: string;  
  developer: string;  
  input: string;  
  jsonSchema?: object;     // optional structured output  
  temperature?: number;  
};

export type LLMResult \= {  
  text: string;  
  json?: any;  
  usage?: { inputTokens?: number; outputTokens?: number; costUsd?: number };  
};

export interface LLMProvider {  
  call(req: LLMCall): Promise\<LLMResult\>;  
}

Cursor should implement at least a `StubProvider` for local dev and a real provider adapter per your environment.

---

## **10\) Pipeline Implementation Contracts**

### **10.1 Blueprint generation (`pipeline.blueprint.ts`)**

Input:

* template snapshot  
* user run inputs

Output:

* `ReportBlueprint.blueprintJson`:  
  * glossary (term → definition)  
  * assumptions  
  * nonGoals  
  * scopeBoundaries  
  * doNotRepeatGuidance

### **10.2 Section pipeline (`pipeline.section.ts`)**

**For each section:**

1. Plan (outline \+ retrieval queries)  
2. Retrieve (as policy permits)  
3. Write (draft; structured output for strict modes)  
4. Verify (policy \+ quality gates)  
5. Repair loop (max attempts)

### **10.3 Normalization (`pipeline.normalize.ts`)**

* normalize terminology  
* reduce duplication  
* flag conflicts

### **10.4 Assembly (`pipeline.assemble.ts`)**

* cohesion transitions  
* TOC  
* executive summary (SYNTHESIS\_ONLY or enforced no-new-facts)

### **10.5 Export (`pipeline.export.ts`)**

* Markdown export (P0)  
* DOCX (P1)  
* PDF (P2)

---

## **11\) Citations Format Spec**

Implement `/src/lib/citations.ts`.

### **11.1 Internal citations (vector hits)**

Use stable IDs:

* `[^v:{chunkId}]`

Append footnotes:

* `[^v:chunkId]: DocumentName (page/section if available), excerpt…`

### **11.2 Web citations**

Use stable IDs:

* `[^w:{hash(url)}]`

Append footnotes:

* `[^w:abcd1234]: Title — Publisher, PublishedAt, url`

### **11.3 Enforcement**

* For `WEB_ONLY` sections: must have at least `minSources` unique web citations.  
* For `VECTOR_ONLY` sections: must have internal citations or explicit “openQuestions”.

---

## **12\) Template Linter Specification (`/src/lib/linter.ts`)**

Return structure:

export type LintResult \= {  
  pass: boolean;  
  errors: Array\<{ code: string; message: string; sectionId?: string }\>;  
  warnings: Array\<{ code: string; message: string; sectionId?: string }\>;  
};

Lint rules (must implement):

* Missing evidence policy  
* SYNTHESIS\_ONLY with retrieval policies present  
* VECTOR\_ONLY without vector connector IDs  
* WEB\_ONLY without workspace web provider configured  
* Exec summary not marked SYNTHESIS\_ONLY OR not flagged “no new facts”  
* Token budget heuristic warning (based on length targets)

---

## **13\) OpenAPI Specification (`/docs/openapi.yaml`)**

This is a usable spec. Cursor should generate handlers that conform.

openapi: 3.1.0  
info:  
  title: Report Generation App API  
  version: "1.0.0"  
servers:  
  \- url: http://localhost:3000

components:  
  securitySchemes:  
    cookieAuth:  
      type: apiKey  
      in: cookie  
      name: next-auth.session-token

  schemas:  
    Template:  
      type: object  
      required: \[id, name, status, versionNumber\]  
      properties:  
        id: { type: string }  
        name: { type: string }  
        description: { type: string, nullable: true }  
        audience: { type: string, nullable: true }  
        tone: { type: string, nullable: true }  
        jurisdiction: { type: string, nullable: true }  
        status: { type: string, enum: \[DRAFT, PUBLISHED, ARCHIVED\] }  
        versionNumber: { type: integer }

    TemplateSection:  
      type: object  
      required: \[id, title, purpose, sortOrder, outputFormat, evidencePolicy\]  
      properties:  
        id: { type: string }  
        sortOrder: { type: integer }  
        title: { type: string }  
        purpose: { type: string }  
        outputFormat: { type: string, enum: \[NARRATIVE, BULLETS, TABLE, REQUIREMENTS, JSON\_SCHEMA\] }  
        evidencePolicy:  
          type: string  
          enum: \[LLM\_ONLY, VECTOR\_ONLY, WEB\_ONLY, VECTOR\_LLM, WEB\_LLM, VECTOR\_WEB, ALL, SYNTHESIS\_ONLY\]  
        webPolicyJson: { type: object, additionalProperties: true, nullable: true }  
        vectorPolicyJson: { type: object, additionalProperties: true, nullable: true }  
        qualityGatesJson: { type: object, additionalProperties: true, nullable: true }

    CreateTemplateRequest:  
      type: object  
      required: \[name\]  
      properties:  
        name: { type: string }  
        description: { type: string }

    CreateReportRunRequest:  
      type: object  
      required: \[templateId, profile, inputJson\]  
      properties:  
        templateId: { type: string }  
        profile: { type: string, enum: \[FAST, DEFENSIBLE\] }  
        inputJson: { type: object, additionalProperties: true }

    ReportRun:  
      type: object  
      required: \[id, templateId, profile, status\]  
      properties:  
        id: { type: string }  
        templateId: { type: string }  
        profile: { type: string, enum: \[FAST, DEFENSIBLE\] }  
        status: { type: string, enum: \[QUEUED, RUNNING, FAILED, COMPLETED, CANCELED\] }  
        startedAt: { type: string, nullable: true }  
        completedAt: { type: string, nullable: true }

security:  
  \- cookieAuth: \[\]

paths:  
  /api/templates:  
    get:  
      summary: List templates  
      responses:  
        "200":  
          description: OK  
          content:  
            application/json:  
              schema:  
                type: array  
                items: { $ref: "\#/components/schemas/Template" }  
    post:  
      summary: Create template  
      requestBody:  
        required: true  
        content:  
          application/json:  
            schema: { $ref: "\#/components/schemas/CreateTemplateRequest" }  
      responses:  
        "201":  
          description: Created  
          content:  
            application/json:  
              schema: { $ref: "\#/components/schemas/Template" }

  /api/templates/{templateId}:  
    get:  
      summary: Get template  
      parameters:  
        \- in: path  
          name: templateId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: OK

    put:  
      summary: Update template  
      parameters:  
        \- in: path  
          name: templateId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: OK

  /api/templates/{templateId}/sections:  
    post:  
      summary: Add section  
      parameters:  
        \- in: path  
          name: templateId  
          required: true  
          schema: { type: string }  
      responses:  
        "201":  
          description: Created

  /api/templates/{templateId}/validate:  
    post:  
      summary: Validate template (linter)  
      parameters:  
        \- in: path  
          name: templateId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: Lint results

  /api/templates/{templateId}/publish:  
    post:  
      summary: Publish template  
      parameters:  
        \- in: path  
          name: templateId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: OK

  /api/report-runs:  
    post:  
      summary: Create report run  
      requestBody:  
        required: true  
        content:  
          application/json:  
            schema: { $ref: "\#/components/schemas/CreateReportRunRequest" }  
      responses:  
        "201":  
          description: Created  
          content:  
            application/json:  
              schema: { $ref: "\#/components/schemas/ReportRun" }

    get:  
      summary: List report runs  
      responses:  
        "200":  
          description: OK

  /api/report-runs/{runId}/start:  
    post:  
      summary: Start generation (enqueue jobs)  
      parameters:  
        \- in: path  
          name: runId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: OK

  /api/report-runs/{runId}/cancel:  
    post:  
      summary: Cancel run  
      parameters:  
        \- in: path  
          name: runId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: OK

  /api/report-runs/{runId}/export:  
    post:  
      summary: Export report  
      parameters:  
        \- in: path  
          name: runId  
          required: true  
          schema: { type: string }  
      requestBody:  
        required: true  
        content:  
          application/json:  
            schema:  
              type: object  
              required: \[format\]  
              properties:  
                format: { type: string, enum: \[MARKDOWN, DOCX, PDF\] }  
      responses:  
        "200":  
          description: OK

  /api/report-runs/{runId}/events:  
    get:  
      summary: SSE events for run progress  
      parameters:  
        \- in: path  
          name: runId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: text/event-stream  
          content:  
            text/event-stream:  
              schema:  
                type: string

  /api/section-runs/{sectionRunId}/retry:  
    post:  
      summary: Retry a section run  
      parameters:  
        \- in: path  
          name: sectionRunId  
          required: true  
          schema: { type: string }  
      responses:  
        "200":  
          description: OK

---

## **14\) UI Route Map \+ Component Responsibilities**

### **Routes**

* `/login`  
* `/dashboard`  
* `/templates`  
* `/templates/[templateId]` (Template Studio: sections reorder/edit)  
* `/templates/[templateId]/prompts` (Prompt Studio)  
* `/connectors` (Vector store \+ web provider config)  
* `/runs` (Report runs list)  
* `/runs/[runId]` (Run detail: section statuses, evidence, artifacts, retry)  
* `/runs/[runId]/export` (Preview \+ download)

### **Component responsibilities (must implement)**

* `TemplateEditor`: edit template metadata; publish; validate.  
* `SectionEditor`: evidence policy editor; vector store selection; web constraints editor.  
* `PromptEditor`: edit global \+ per-section prompt components; diff; publish.  
* `RunProgress`: real-time SSE; show per-section status.  
* `EvidenceViewer`: show vector hits \+ web hits; raw \+ sanitized.  
* `SectionArtifactViewer`: show draft \+ verified draft \+ verifier issues.  
* `ExportViewer`: show final markdown \+ download.

---

## **15\) Prompt Pack (Skeletons \+ Mandatory Clauses)**

Create `/docs/prompt-pack.md` and implement injection in `/src/lib/llm.prompts.ts`.

### **15.1 Placeholders (must support)**

* `{{blueprint}}`  
* `{{template_meta}}`  
* `{{section_title}}`  
* `{{section_purpose}}`  
* `{{section_output_format}}`  
* `{{evidence_policy}}`  
* `{{evidence_bundle}}`  
* `{{constraints}}`  
* `{{prior_sections_sanitized}}`  
* `{{profile}}`

### **15.2 Mandatory policy clauses (not user-editable)**

Implement as a function `getPolicyClauses(evidencePolicy, stage)`.

**Examples (insert into system or developer prompt):**

* VECTOR\_ONLY:  
  * “You MUST only use facts found in the provided Evidence Bundle (vector hits). If insufficient, list Open Questions.”  
  * “Do NOT use outside knowledge or web facts.”  
* WEB\_ONLY:  
  * “You MUST cite web sources using footnote style.”  
  * “If sources are insufficient, say so and list missing items.”  
* SYNTHESIS\_ONLY:  
  * “You MUST NOT add new facts. Summarize only the provided section artifacts.”  
  * “Do NOT call retrieval tools.”

### **15.3 Planner prompt (default)**

You are planning a report section.  
Input:  
\- Blueprint  
\- Section purpose and constraints  
Output JSON (SectionPlanDTO):  
\- outline\[\]  
\- retrievalQueries\[\]  
\- keyConstraints\[\]  
\- riskNotes\[\] (optional)

Keep retrievalQueries specific.  
Do not write the section yet.

### **15.4 Writer prompt (default)**

Write the section in the requested output format.

Requirements:  
\- Follow blueprint definitions and assumptions.  
\- Follow evidence policy.  
\- Minimize repetition with prior sections summary (if provided).  
\- Return JSON (SectionWriteDTO) with:  
  \- markdown  
  \- claims\[\] with evidenceIds\[\] (only if evidence-backed modes)  
  \- openQuestions\[\] if evidence insufficient

### **15.5 Verifier prompt (default)**

You are a strict verifier.

Check:  
\- Evidence policy compliance  
\- Citation requirements  
\- Contradictions with blueprint  
\- Missing requirements from section constraints  
\- Redundancy with prior sections

Return JSON (SectionVerifyDTO) including suggestedRepairInstructions if failing.

### **15.6 Repair prompt (default)**

You are repairing a draft based on verifier issues.

Input:  
\- draft  
\- verifier issues \+ suggested repair instructions  
\- evidence bundle (if allowed)

Output JSON (SectionWriteDTO) with corrected markdown and updated claims/evidenceIds.

### **15.7 Reviewer simulation prompt (P1)**

Act as a skeptical reviewer (compliance \+ executive).

Do not rewrite content. Provide:  
\- objections/questions  
\- missing evidence flags  
\- clarity issues  
\- risk flags  
\- section confidence notes

---

## **16\) Testing Pack (What Cursor should generate)**

### **Unit tests (must)**

* Linter rule tests  
* Evidence policy enforcement tests  
* Citation formatter tests  
* Sanitizer tests

### **Integration tests (must)**

* Ingest doc → vector search returns hits  
* Run pipeline on sample template (stub LLM/provider)  
* Verify repair loop triggers and resolves

### **E2E tests (should)**

* Create template → publish → run → SSE progress → export markdown

### **Seed data**

* Seed workspace \+ admin user  
* Seed “BRD Generator” template with:  
  * Exec summary (SYNTHESIS\_ONLY)  
  * Requirements (VECTOR\_ONLY)  
  * Market landscape (WEB\_ONLY)

---

## **17\) “Definition of Done” Checklist**

A build is accepted when:

1. Users can create/publish templates with sections and evidence policies.  
2. Vector store ingestion works and retrieval returns hits.  
3. A report run generates:  
   * blueprint  
   * section drafts  
   * verified drafts (or needs-review with issues)  
   * final assembled report  
4. SSE progress updates live.  
5. Markdown export works and is downloadable.  
6. Audit logs are written for key actions.  
7. Guardrails prevent:  
   * web leakage into VECTOR\_ONLY  
   * new facts in SYNTHESIS\_ONLY

---

## **18\) Minimal Docker Compose (for Cursor to implement)**

version: "3.9"  
services:  
  postgres:  
    image: postgres:16  
    environment:  
      POSTGRES\_PASSWORD: postgres  
      POSTGRES\_USER: postgres  
      POSTGRES\_DB: reportgen  
    ports: \["5432:5432"\]  
    volumes:  
      \- pgdata:/var/lib/postgresql/data  
  redis:  
    image: redis:7  
    ports: \["6379:6379"\]  
volumes:  
  pgdata:

Here’s a **single cut-and-paste instruction** you can give to Cursor to adapt the architecture to:

* **Next.js web app (UI \+ API \+ SSE) deployed as one service**

* **Separate worker service**

* **Supabase Postgres** (including pgvector if available)

* **No Redis / no BullMQ** for MVP

This replaces Redis/BullMQ with a **DB-backed job queue** \+ polling/lease locking.

---

## **Cursor Instruction (cut & paste)**

Build the Report Generation App using the existing BRD \+ Developer Spec Pack, but modify the runtime architecture for MVP as follows:

### **1\) Deployment topology (must implement)**

* Deploy **two services from the same repo**:

  1. **Web App Service** (Next.js App Router): UI \+ REST API routes \+ SSE endpoint

  2. **Worker Service** (Node process): background processor that executes report/section pipelines

* Use **Supabase Postgres** as the only persistent backend dependency.

* **Do NOT use Redis or BullMQ** (remove all Redis/BullMQ code and docker-compose references).

### **2\) Replace BullMQ/Redis with a DB-backed job queue (mandatory)**

Implement a **durable Postgres-backed job queue** using Supabase models and transactional leasing.

#### **2.1 Job model (new table)**

Add a new Supabase model `Job`:

* `id` (cuid)

* `workspaceId`

* `type` enum: `START_RUN | RUN_SECTION | ASSEMBLE | EXPORT`

* `status` enum: `QUEUED | RUNNING | FAILED | COMPLETED | CANCELED`

* `priority` int (default 100\)

* `payloadJson` (JSON)

* `runId` (nullable, indexed)

* `sectionRunId` (nullable, indexed)

* `attemptCount` int default 0

* `maxAttempts` int default 3

* `lockedBy` string nullable

* `lockedAt` datetime nullable

* `lockExpiresAt` datetime nullable

* `scheduledAt` datetime default now()

* `lastError` string nullable

* `createdAt`, `updatedAt`

Add useful indexes:

* `(status, scheduledAt, priority)`

* `(runId)`

* `(sectionRunId)`

* `(lockExpiresAt)`

#### **2.2 Leasing protocol (atomic claim)**

Implement `claimNextJob(workerId)` in a single DB transaction:

* Select one job:

  * status \= QUEUED

  * scheduledAt \<= now

  * AND (lockExpiresAt is null OR lockExpiresAt \< now) // expired lock safety

  * order by priority ASC, createdAt ASC

* Update it to:

  * status \= RUNNING

  * lockedBy \= workerId

  * lockedAt \= now

  * lockExpiresAt \= now \+ 5 minutes (configurable)

  * attemptCount \= attemptCount \+ 1

* Return the claimed job

Use `SELECT ... FOR UPDATE SKIP LOCKED` if possible via raw SQL (preferred). If Supabase cannot, use a safe fallback approach with `updateMany` \+ unique selection, but aim for correctness.

#### **2.3 Heartbeat / lock extension**

If a job might exceed 5 minutes:

* Worker must extend `lockExpiresAt` periodically (every 60s).

* If worker dies, lock expires and job becomes claimable again.

#### **2.4 Completion/failure handling**

* On success: set status \= COMPLETED, clear lock fields.

* On error:

  * if attemptCount \< maxAttempts:

    * set status \= QUEUED

    * scheduledAt \= now \+ backoff (e.g., 30s, 2m, 10m)

    * lastError set

    * clear lock fields

  * else:

    * set status \= FAILED, lastError set, clear lock fields

### **3\) Worker service behavior (mandatory)**

Create `/workers/worker.ts` that:

* loads env \+ Supabase

* generates a stable `workerId`

* loops forever:

  * claimNextJob()

  * if none, sleep 1000ms

  * run handler for job.type:

    * START\_RUN → create blueprint \+ create SectionRuns \+ enqueue RUN\_SECTION jobs

    * RUN\_SECTION → run section pipeline (plan→retrieve→write→verify→repair) and store artifacts/evidence

    * ASSEMBLE → run normalization \+ cohesion \+ TOC \+ exec summary \+ store final artifacts

    * EXPORT → generate export file and store path in Export table

* writes structured logs

### **4\) Web app service changes (mandatory)**

Remove Redis/BullMQ endpoints and replace with DB job enqueueing:

#### **4.1 When user starts a report run**

`POST /api/report-runs/:runId/start` should:

* set ReportRun.status \= RUNNING and startedAt

* enqueue a Job of type `START_RUN` with payload `{ runId, workspaceId }`

* return immediately

#### **4.2 Section retry**

`POST /api/section-runs/:id/retry` should:

* reset SectionRun.status \= QUEUED

* enqueue a `RUN_SECTION` job

* return immediately

#### **4.3 Automatic assemble trigger**

After all required SectionRuns are COMPLETED:

* Worker should enqueue `ASSEMBLE` job once (idempotent).  
   Implement idempotency by checking if an ASSEMBLE job already exists for the run with status in (QUEUED/RUNNING/COMPLETED).

### **5\) SSE progress without Redis (mandatory)**

SSE endpoint must read from Postgres.

Implement a `RunEvent` table (new) OR reuse AuditLog (not recommended). Prefer dedicated `RunEvent`:

`RunEvent` fields:

* id

* runId

* type (string)

* payloadJson

* createdAt

Web UI connects to SSE:

* On connect: stream last N events (e.g., last 200\) from DB

* Then poll DB every 1s inside the SSE handler and push new events

  * (Yes, this is “polling SSE”; acceptable MVP)

* Worker writes RunEvents whenever:

  * RUN\_STARTED, BLUEPRINT\_CREATED

  * SECTION\_STATUS changes

  * SECTION\_ARTIFACT created

  * RUN\_FAILED, RUN\_COMPLETED

  * EXPORT\_READY

### **6\) Supabase specifics (mandatory)**

* Use **Supabase Postgres** as the DB.

* If pgvector is available/enabled on Supabase, keep vector search as designed.

* If pgvector is not enabled in the target Supabase plan, implement a fallback:

  * Store embeddings but retrieval uses Postgres full-text \+ metadata filters (MVP)

  * Keep the interface `retrieveVector()` stable so pgvector can be re-enabled later.

### **7\) Remove all Redis/BullMQ references (mandatory)**

* Delete queue.ts, BullMQ configs, Redis env vars, docker-compose Redis service.

* Replace with DB queue module `src/lib/dbqueue.ts`.

### **8\) Concurrency controls (MVP)**

* Allow running multiple workers, but ensure leasing prevents double-processing.

* Implement a per-run concurrency cap:

  * Worker should not process \> X section jobs for the same run simultaneously (X default 3).

  * Implement by counting RUNNING SectionRuns for a run before claiming another RUN\_SECTION job for same run (or by priority \+ scheduledAt deferral).

### **9\) Deliverables**

* Working Next.js web app \+ worker process runnable locally.

* Migration scripts for Job and RunEvent tables.

* Updated README with:

  * Supabase setup

  * running web app

  * running worker

* E2E flow: create template → publish → create run → start → observe SSE → export markdown.

Make these changes without removing the existing BRD capabilities; only swap the queue mechanism and deployment assumptions.

