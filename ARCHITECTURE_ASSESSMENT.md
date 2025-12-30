# ARCHITECTURE ASSESSMENT & ACTION PLAN
**Date:** December 30, 2025  
**Status:** Critical issues identified requiring immediate remediation

---

## EXECUTIVE SUMMARY

The codebase has **6 architectural issues** ranging from Critical to Low severity:
- **1 Critical** (duplicate API implementations)
- **3 High** (workspace isolation, mocked retrieval/search, worker bottleneck)
- **2 Medium** (legacy UI/runtime, input validation)

**Recommended approach:** Phased remediation over 3 sprints, addressing Critical/High issues first.

---

## DETAILED ASSESSMENT

### 🔴 CRITICAL #1: Duplicate API Implementations
**Issue:** API routes exist in both `app/api/*` and `src/app/api/*` with divergent behavior.

**Evidence:**
- `app/api/templates/route.ts` - Maps `sources_json` → `connectors` ✅
- `src/app/api/templates/route.ts` - Does NOT map sources ❌
- Next.js routing is nondeterministic; behavior depends on which directory is prioritized

**Impact:**
- Silent data inconsistencies
- Unpredictable API responses
- Maintenance nightmare (changes must be duplicated)
- Risk of production bugs

**Root Cause:**
- Historical migration from `src/app` to `app` was incomplete
- Both directories coexist, causing routing conflicts

**Action Plan:**
1. **IMMEDIATE:** Audit all API routes in both directories
2. **IMMEDIATE:** Identify canonical version for each route
3. **IMMEDIATE:** Delete duplicate routes from `src/app/api/*`
4. **IMMEDIATE:** Verify routing behavior post-deletion
5. **SHORT-TERM:** Add CI check to prevent future duplicates

**Effort:** 4-6 hours  
**Priority:** P0 - Must fix before next deployment

---

### 🟠 HIGH #1: Workspace Isolation Absent
**Issue:** Queries read all records without workspace filtering.

**Evidence:**
- `app/api/templates/route.ts:9` - `select("*")` with no workspace filter
- `src/lib/workerStore.ts:242` - Fetches all runs globally
- `src/lib/workspace.ts:6` - Returns hardcoded default workspace

**Impact:**
- Multi-tenant data leakage risk
- Scalability issues (queries scan entire database)
- Compliance/security violations (GDPR, SOC2)

**Action Plan:**
1. **SHORT-TERM:** Add `workspace_id` filter to ALL queries
2. **SHORT-TERM:** Implement workspace context middleware
3. **SHORT-TERM:** Add workspace validation to API routes
4. **MEDIUM-TERM:** Implement proper workspace authentication
5. **MEDIUM-TERM:** Add workspace-scoped indexes for performance

**Effort:** 8-12 hours  
**Priority:** P0 - Security/compliance risk

---

### 🟠 HIGH #2: Retrieval & Web Search Mocked
**Issue:** Non-OpenAI vector connectors return placeholder evidence; web search defaults to mock results.

**Evidence:**
- `src/lib/retrieval.ts:41` - Returns mock evidence for non-OpenAI connectors
- `src/lib/webSearch.ts:147` - Falls back to mock search results

**Impact:**
- Undermines provenance and defensibility
- Reports contain fake/placeholder data
- Cannot be used in production with real data

**Action Plan:**
1. **MEDIUM-TERM:** Implement real vector store integrations:
   - Pinecone
   - Weaviate
   - Chroma
   - Qdrant
2. **MEDIUM-TERM:** Remove mock fallbacks from web search
3. **MEDIUM-TERM:** Add proper error handling (fail fast, don't mock)
4. **MEDIUM-TERM:** Add integration tests with real connectors

**Effort:** 16-24 hours  
**Priority:** P1 - Blocks production use with real data

---

### 🟠 HIGH #3: Worker Bottleneck
**Issue:** Worker is a single infinite loop with no concurrency, graceful shutdown, or throttling.

**Evidence:**
- `workers/worker.js:242` - Single-threaded loop
- No concurrency controls
- No graceful shutdown handling
- No per-run throttling

**Impact:**
- Bottleneck under load (processes one run at a time)
- Cannot scale horizontally
- Risk of data corruption on forced shutdown
- No backpressure mechanism

**Action Plan:**
1. **MEDIUM-TERM:** Implement job queue (BullMQ, Celery, or similar)
2. **MEDIUM-TERM:** Add concurrency controls (configurable worker pool)
3. **MEDIUM-TERM:** Implement graceful shutdown (SIGTERM handling)
4. **MEDIUM-TERM:** Add per-run throttling and rate limiting
5. **LONG-TERM:** Implement horizontal scaling (multiple workers)

**Effort:** 12-16 hours  
**Priority:** P1 - Blocks scalability

---

### 🟡 MEDIUM #1: Legacy Static UI/Runtime
**Issue:** Legacy static UI (`index.html`, `app.js`) coexists with Next.js app.

**Evidence:**
- `index.html:5` - Root HTML file
- `app.js:1` - Legacy Express server
- `public/index.html` - Duplicate static UI
- `public/app.js` - Client-side JS runtime

**Impact:**
- Confusion about which UI to use
- Conflicting UX expectations
- Increased maintenance burden
- Larger deployment bundle

**Action Plan:**
1. **MEDIUM-TERM:** Audit legacy UI usage (check if still needed)
2. **MEDIUM-TERM:** Migrate any missing features to Next.js
3. **MEDIUM-TERM:** Remove legacy files:
   - `index.html`
   - `app.js`
   - `public/index.html`
   - `public/app.js`
4. **MEDIUM-TERM:** Update documentation

**Effort:** 6-8 hours  
**Priority:** P2 - Technical debt

---

### 🟡 MEDIUM #2: Minimal Input Validation
**Issue:** API input validation is minimal (presence checks only); no centralized schema validation.

**Evidence:**
- `app/api/templates/route.ts:31` - Only checks `if (!body?.name)`
- No schema validation framework
- No type validation beyond TypeScript compile-time

**Impact:**
- Risk of malformed data in database
- Poor error messages for clients
- Security vulnerabilities (injection attacks)
- Difficult to maintain validation logic

**Action Plan:**
1. **MEDIUM-TERM:** Implement centralized validation:
   - Use Zod for runtime schema validation
   - Create reusable validation middleware
2. **MEDIUM-TERM:** Add validation to all API routes:
   - Request body validation
   - Query parameter validation
   - Path parameter validation
3. **MEDIUM-TERM:** Add comprehensive error responses
4. **LONG-TERM:** Generate OpenAPI schema from Zod schemas

**Effort:** 8-12 hours  
**Priority:** P2 - Security/quality improvement

---

## PHASED REMEDIATION PLAN

### 🚨 SPRINT 1 (Week 1): Critical & High Priority
**Goal:** Eliminate critical issues and security risks

**Tasks:**
1. ✅ **Deduplicate API routes** (Critical #1)
   - Audit both `app/api` and `src/app/api`
   - Delete duplicates from `src/app/api`
   - Test all API endpoints
   - **Effort:** 4-6 hours

2. ✅ **Implement workspace isolation** (High #1)
   - Add workspace context middleware
   - Add `workspace_id` filters to all queries
   - Add workspace validation
   - **Effort:** 8-12 hours

**Total Effort:** 12-18 hours  
**Deliverable:** Stable, secure API layer

---

### 🔧 SPRINT 2 (Week 2-3): High Priority Features
**Goal:** Enable production use with real data

**Tasks:**
1. ✅ **Implement real vector store integrations** (High #2)
   - Pinecone integration
   - Remove mock fallbacks
   - Add error handling
   - **Effort:** 16-24 hours

2. ✅ **Refactor worker for scalability** (High #3)
   - Implement job queue
   - Add concurrency controls
   - Implement graceful shutdown
   - **Effort:** 12-16 hours

**Total Effort:** 28-40 hours  
**Deliverable:** Production-ready data pipeline

---

### 🧹 SPRINT 3 (Week 4): Technical Debt & Quality
**Goal:** Clean up legacy code and improve robustness

**Tasks:**
1. ✅ **Remove legacy UI/runtime** (Medium #1)
   - Audit usage
   - Migrate features
   - Delete legacy files
   - **Effort:** 6-8 hours

2. ✅ **Implement centralized validation** (Medium #2)
   - Add Zod schemas
   - Create validation middleware
   - Apply to all routes
   - **Effort:** 8-12 hours

**Total Effort:** 14-20 hours  
**Deliverable:** Clean, maintainable codebase

---

## RISK MITIGATION

### Risks During Remediation:
1. **Breaking changes** → Comprehensive testing after each sprint
2. **Downtime** → Deploy during low-traffic windows
3. **Data loss** → Database backups before each deployment
4. **Regression** → Maintain test coverage > 80%

### Rollback Strategy:
- Git tags for each sprint deployment
- Database migration rollback scripts
- Feature flags for new implementations

---

## SUCCESS METRICS

### Sprint 1:
- ✅ Zero duplicate API routes
- ✅ All queries workspace-scoped
- ✅ Zero security vulnerabilities (workspace leakage)

### Sprint 2:
- ✅ Real vector store integrations working
- ✅ Worker processes 10+ concurrent runs
- ✅ Zero mock data in production reports

### Sprint 3:
- ✅ Legacy code removed (0 files)
- ✅ 100% API routes validated
- ✅ Test coverage > 80%

---

## RECOMMENDATION

**Proceed with phased remediation:**
1. **Sprint 1 (Critical/High)** - Start immediately
2. **Sprint 2 (High features)** - Start after Sprint 1 completion
3. **Sprint 3 (Technical debt)** - Start after Sprint 2 completion

**Total estimated effort:** 54-78 hours (7-10 days)

**Alternative (if time-constrained):**
- Focus on Sprint 1 only (12-18 hours)
- Address Critical #1 and High #1 immediately
- Defer other issues to future sprints

---

## NEXT STEPS

1. **Review this assessment** with stakeholders
2. **Approve phased plan** or propose alternative
3. **Begin Sprint 1** immediately if approved
4. **Set up monitoring** for success metrics

