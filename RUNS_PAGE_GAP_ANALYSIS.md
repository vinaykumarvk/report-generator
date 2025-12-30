# 🔍 RUNS PAGE - GAP ANALYSIS & ROADMAP
**Date:** December 30, 2025  
**Scope:** Requirements vs. Current Implementation

---

## 📋 YOUR REQUIREMENTS CHECKLIST

### ✅ IMPLEMENTED (Working Now)
- [x] Select a template from created templates
- [x] Change topic/company name (dedicated input field)
- [x] Provide additional variables via JSON
- [x] Change sources per section (vector stores + web search)
- [x] Run the report (Create + Create & Start)
- [x] View final output (new "Final Output" section)
- [x] Select and preview any run's output

### ⚠️ PARTIALLY IMPLEMENTED (Needs Enhancement)
- [~] View output for each section individually
  - Status: API endpoint exists, but UI only shows in details page
  - Missing: Inline section output view in main page
  
- [~] Regenerate section output
  - Status: "Rerun" exists but regenerates ALL sections
  - Missing: Per-section regeneration capability

### ❌ NOT IMPLEMENTED (Needs Building)
- [ ] Comprehensive combined report view (all sections merged)
- [ ] Per-section output display in main dashboard
- [ ] Individual section regeneration UI
- [ ] Section-by-section review workflow
- [ ] Smart variable detection based on template type

---

## 🎯 CURRENT IMPLEMENTATION STRENGTHS

### ✅ What's Working Well:

1. **Template Selection** ✓
   - Dropdown with all available templates
   - Clear template name display
   - Auto-selects first template

2. **Topic/Variable Management** ✓ (Your Recent Changes)
   - Dedicated "Topic" field (cleaner UX!)
   - Separate JSON for additional variables
   - Validation: requires topic before run
   - Smart placeholder examples

3. **Source Overrides** ✓
   - Per-section checkbox to enable override
   - Vector store selector (up to 4 stores)
   - File selection within vector stores
   - Web search toggle
   - Inherits template defaults if not overridden

4. **Run Execution** ✓
   - Create run (saves without starting)
   - Create & Start (queues job immediately)
   - Status feedback during creation

5. **Output Preview** ✓ (Your Recent Addition)
   - New "Final Output" section
   - Dropdown to select any run
   - Shows final_report_json
   - Link to detailed view

---

## 🔴 CRITICAL GAPS TO ADDRESS

### GAP #1: Combined Report View ❌ HIGH PRIORITY

**Requirement:**
> "I should be able to see the comprehensive report which will combine all sections in one go"

**Current State:**
- Shows `final_report_json` (raw JSON)
- Not formatted as readable report
- Sections not combined/merged

**What's Needed:**
1. **Backend:** Endpoint to assemble sections into formatted report
   - GET `/api/report-runs/[runId]/combined-output`
   - Combines all section outputs in correct order
   - Formats as Markdown or HTML
   - Includes section titles, content, sources

2. **Frontend:** Formatted report viewer
   - Rich text display (not raw JSON)
   - Section headings
   - Collapsible sections
   - Export options (PDF, DOCX, Markdown)

**Estimated Effort:** 2-3 hours

---

### GAP #2: Individual Section Outputs ❌ MEDIUM PRIORITY

**Requirement:**
> "I would also like to see the output for each section"

**Current State:**
- Section outputs only visible in `/runs/[runId]` details page
- Not accessible from main dashboard
- Requires navigation away from creation flow

**What's Needed:**
1. **UI Enhancement:** Expandable section cards in main page
   - Show section status badges
   - Click to expand and view output
   - Display section artifacts inline
   - Show evidence/sources used

2. **API Integration:**
   - Already exists: `/api/section-runs/[sectionRunId]/artifacts`
   - Need to fetch and display per section

**Estimated Effort:** 1-2 hours

---

### GAP #3: Per-Section Regeneration ❌ HIGH PRIORITY

**Requirement:**
> "regenerate the output if I want" (per section)

**Current State:**
- "Rerun" button regenerates ALL sections
- No way to regenerate just one section
- Loses other section outputs on rerun

**What's Needed:**
1. **Backend:** Per-section rerun endpoint
   - POST `/api/section-runs/[sectionRunId]/regenerate`
   - Keeps other sections intact
   - Preserves run history

2. **Frontend:** Section-level actions
   - "Regenerate" button per section
   - Confirmation dialog
   - Loading state per section
   - Auto-refresh after regeneration

**Estimated Effort:** 2 hours

---

### GAP #4: Smart Variable Detection ⚠️ NICE-TO-HAVE

**Requirement:**
> "think about the other variables which would be relevant for me to change from report to report"

**Current State:**
- Generic JSON input for all templates
- No context-specific fields
- User must know variable names

**What's Needed:**
1. **Template Metadata:** Define expected variables
   - Store in `templates` table: `input_schema_json`
   - Example: `{"company_name": "string", "timeframe": "string"}`

2. **Dynamic Form Generation:**
   - Parse schema and render fields
   - Text inputs for strings
   - Date pickers for dates
   - Dropdowns for enums
   - Tooltips with descriptions

3. **Examples:**
   - **Company Research:** company_name, industry, region
   - **RFP Response:** rfp_id, client_name, deadline, requirements
   - **BRD:** project_name, stakeholders, budget, timeline
   - **Test Cases:** feature_name, test_type, environment

**Estimated Effort:** 4-6 hours

---

## 🎨 PROPOSED REDESIGN

### Option A: Two-Pane Layout (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│ RUN DASHBOARD                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ LEFT PANE (40%)          │  RIGHT PANE (60%)               │
│ ─────────────────────    │  ─────────────────────          │
│                          │                                  │
│ 📝 CREATE RUN            │  📊 CURRENT RUN OUTPUT          │
│                          │                                  │
│ ┌─────────────────────┐  │  Template: Company Research     │
│ │ Select Template     │  │  Status: ✅ COMPLETED           │
│ │ ▼ Company Research  │  │  Topic: Microsoft               │
│ └─────────────────────┘  │                                  │
│                          │  ▼ Combined Report               │
│ ┌─────────────────────┐  │  ┌──────────────────────────┐  │
│ │ Topic               │  │  │ # Executive Summary      │  │
│ │ Microsoft           │  │  │ Microsoft Corporation... │  │
│ └─────────────────────┘  │  │                          │  │
│                          │  │ # Financial Analysis     │  │
│ ┌─────────────────────┐  │  │ Revenue for FY2023...    │  │
│ │ Variables (JSON)    │  │  │                          │  │
│ │ {"region": "US"}    │  │  │ # Market Position        │  │
│ └─────────────────────┘  │  │ Microsoft holds...       │  │
│                          │  └──────────────────────────┘  │
│ ⚙️ SECTION SOURCES       │                                  │
│                          │  ▼ Section Outputs               │
│ ☑ Override: Exec Sum.    │  ┌──────────────────────────┐  │
│   📚 Vector: US_Tech     │  │ Executive Summary        │  │
│   📚 Files: 10 selected  │  │ ─────────────────────    │  │
│                          │  │ [Output text...]         │  │
│ [Create & Start Run]     │  │ [🔄 Regenerate]          │  │
│                          │  └──────────────────────────┘  │
│                          │                                  │
│                          │  [Export Markdown]  [Export PDF]│
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Create and view in same screen
- Immediate feedback on output
- Section-by-section review
- Clear workflow: Configure → Run → Review → Regenerate

---

### Option B: Tabbed Interface

```
┌─────────────────────────────────────────────────────────────┐
│ [📝 Create] [📊 Output] [📋 Sections] [📈 History]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TAB: Output                                                │
│                                                             │
│  ┌─ Combined Report ──────────────────────────────────┐    │
│  │ # Microsoft - Company Research Report              │    │
│  │ Generated: 2025-12-30 15:30                        │    │
│  │                                                     │    │
│  │ ## Executive Summary                               │    │
│  │ Microsoft Corporation is a leading...              │    │
│  │                                                     │    │
│  │ ## Financial Analysis                              │    │
│  │ Revenue for FY2023 was $211B...                   │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Export Markdown]  [Export PDF]  [Export DOCX]            │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ [📝 Create] [📊 Output] [📋 Sections] [📈 History]          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TAB: Sections                                              │
│                                                             │
│  ┌─ Executive Summary ─────────────────────────────────┐   │
│  │ Status: ✅ COMPLETED                                 │   │
│  │ Length: 450 words (target: 300-500)                 │   │
│  │                                                      │   │
│  │ [Show Output ▼]                                      │   │
│  │   Microsoft Corporation is a leading technology...  │   │
│  │                                                      │   │
│  │ Sources: US_Tech vectorstore, web search            │   │
│  │ [🔄 Regenerate Section]  [📝 Edit Prompt]          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─ Financial Analysis ────────────────────────────────┐   │
│  │ Status: ⏳ IN_PROGRESS                               │   │
│  │ [Show Output ▼]                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Clear separation of concerns
- More space per view
- Easier to focus on one task

---

## 🛠️ IMPLEMENTATION ROADMAP

### Phase 1: Core Viewing (2-3 hours) - HIGH PRIORITY

**Goal:** Enable viewing combined + per-section outputs

**Tasks:**
1. ✅ Backend: Create combined report endpoint
   - `/api/report-runs/[runId]/combined-output`
   - Fetch all section outputs
   - Combine in order with headers
   - Format as Markdown

2. ✅ Frontend: Replace raw JSON with formatted view
   - Markdown renderer component
   - Section collapsing
   - Copy/export buttons

3. ✅ Frontend: Add per-section output view
   - Expandable section cards
   - Show artifacts inline
   - Status badges per section

**Deliverable:** User can view complete report + drill into sections

---

### Phase 2: Per-Section Regeneration (2 hours) - HIGH PRIORITY

**Goal:** Enable regenerating individual sections

**Tasks:**
1. ✅ Backend: Section regeneration endpoint
   - `/api/section-runs/[sectionRunId]/regenerate`
   - Queue new job for section only
   - Preserve other sections
   - Update section status

2. ✅ Frontend: Add regenerate button per section
   - In expandable section view
   - Confirmation dialog
   - Loading state
   - Auto-refresh on completion

**Deliverable:** User can regenerate any section without losing others

---

### Phase 3: Smart Variables (4-6 hours) - MEDIUM PRIORITY

**Goal:** Context-aware variable inputs

**Tasks:**
1. ✅ Schema: Add `input_schema_json` to templates
   - Migration to add column
   - Seed with example schemas

2. ✅ Backend: Update template creation to accept schema
   - Validate schema format
   - Store in database

3. ✅ Frontend: Dynamic form generator
   - Parse schema → render fields
   - Type-specific inputs
   - Validation

4. ✅ Seed: Add schemas to existing templates
   - Company Research: company_name, industry, region
   - RFP Response: rfp_id, client, requirements
   - BRD: project, stakeholders, timeline
   - Test Cases: feature, test_type, environment

**Deliverable:** User sees relevant fields based on template type

---

### Phase 4: UI Polish (2-3 hours) - LOW PRIORITY

**Goal:** Professional UX refinement

**Tasks:**
1. ✅ Implement chosen layout (Option A or B)
2. ✅ Add progress indicators
3. ✅ Add keyboard shortcuts
4. ✅ Add "Quick Actions" menu
5. ✅ Improve mobile responsiveness

**Deliverable:** Production-ready UX

---

## 📊 EFFORT ESTIMATION

| Phase | Priority | Effort | Dependencies |
|-------|----------|--------|--------------|
| Phase 1: Core Viewing | HIGH | 2-3h | None |
| Phase 2: Regeneration | HIGH | 2h | Phase 1 |
| Phase 3: Smart Variables | MEDIUM | 4-6h | None |
| Phase 4: UI Polish | LOW | 2-3h | Phase 1+2 |

**Total Effort:** 10-14 hours  
**Critical Path:** Phase 1 → Phase 2 (4-5 hours)

---

## 🎯 RECOMMENDED APPROACH

### Immediate (Today):
✅ **Phase 1: Core Viewing**
- This unblocks your main workflow
- Enables seeing full reports
- Provides section drill-down

### Tomorrow:
✅ **Phase 2: Per-Section Regeneration**
- Critical for iterative refinement
- Saves time (no full reruns)
- Preserves good sections

### Next Week:
⏳ **Phase 3: Smart Variables**
- Nice-to-have enhancement
- Significantly improves UX
- Reduces user errors

### Future:
⏳ **Phase 4: UI Polish**
- Can iterate over time
- Based on user feedback
- Not blocking functionality

---

## 💡 QUICK WINS (Can Do Now)

While planning bigger changes, these can be done immediately:

1. **Better Final Output Display** (15 min)
   - Parse JSON and format nicely
   - Add line breaks, indentation
   - Syntax highlighting

2. **Section Status Summary** (30 min)
   - Show section completion %
   - Color-coded status pills
   - Estimated time remaining

3. **Template Filtering** (30 min)
   - Search box for templates
   - Filter by category/tag
   - Recently used templates

4. **Run History Quick View** (30 min)
   - Last 5 runs in sidebar
   - Quick compare feature
   - Favorite runs

---

## 🚦 DECISION MATRIX

| Requirement | Priority | Complexity | Current Gap | Recommendation |
|-------------|----------|------------|-------------|----------------|
| View combined report | ⭐⭐⭐ HIGH | MEDIUM | ❌ 80% | DO NOW |
| View per-section output | ⭐⭐⭐ HIGH | LOW | ⚠️ 50% | DO NOW |
| Regenerate section | ⭐⭐⭐ HIGH | MEDIUM | ❌ 90% | DO NEXT |
| Smart variables | ⭐⭐ MEDIUM | HIGH | ❌ 100% | DO LATER |
| Better formatting | ⭐⭐ MEDIUM | LOW | ❌ 70% | QUICK WIN |

---

## 📝 SUMMARY

### ✅ What's Working:
Your recent changes are excellent! The dedicated Topic field and Final Output section significantly improve UX.

### ❌ What's Missing:
1. **Combined report view** (formatted, not JSON)
2. **Per-section output display** (inline in main page)
3. **Per-section regeneration** (without losing others)

### 🎯 Recommendation:
**Start with Phase 1 (Core Viewing)** - 2-3 hours of work that will:
- Show formatted combined reports
- Enable section-by-section review
- Provide foundation for regeneration

**This will immediately meet 80% of your requirements!**

Would you like me to proceed with Phase 1 implementation?

