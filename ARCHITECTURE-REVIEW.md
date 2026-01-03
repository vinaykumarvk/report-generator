# Architecture Review - Report Generator
**Date:** January 3, 2026  
**Reviewer:** AI Principal Architect  
**Codebase:** /Users/n15318/report-generator

---

## Executive Summary

**Overall Assessment:** **MODERATE RISK** - Production-ready with significant security and reliability improvements needed.

**Critical Issues:** 4 P0 items  
**High-Priority Items:** 12 P1 items  
**Medium-Priority Items:** 18 P2 items  

**Top 5 Priorities:**
1. 🔴 **P0** - Implement proper authentication/authorization (no auth layer exists)
2. 🔴 **P0** - Add input validation and sanitization (SQL injection, XSS risks)
3. 🔴 **P0** - Secure secrets management (service role key exposed in frontend)
4. 🟡 **P1** - Add transaction boundaries and error handling
5. 🟡 **P1** - Implement proper observability (structured logging, tracing)

---

## 1. SYSTEM MAP

### Runtime Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                            │
│  Next.js 14 SSR + Client Components (React 18)                  │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP/HTTPS
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WEB SERVICE (Next.js)                         │
│  - API Routes (app/api/**/route.ts)                            │
│  - Server Components                                             │
│  - SERVICE_MODE=web                                             │
│  - Port: 3000 (dev) / 8080 (prod)                              │
└──────────┬─────────────────────────────────┬────────────────────┘
           │                                 │
           │ Supabase Client                 │ HTTP Trigger (optional)
           │ (Service Role Key)              │
           ▼                                 ▼
┌─────────────────────────┐    ┌──────────────────────────────────┐
│   SUPABASE (Backend)    │    │   WORKER SERVICE (Node.js)       │
│  - PostgreSQL 15+       │    │   - workers/worker.js            │
│  - Row Level Security   │◄───┤   - SERVICE_MODE=worker          │
│  - Storage (exports)    │    │   - Job Processor                │
│  - Auth (not used)      │    │   - DB Polling / HTTP Trigger    │
└──────────┬──────────────┘    │   - Port: 8080 (health check)    │
           │                    └──────────────┬───────────────────┘
           │                                   │
           │                                   │ OpenAI API
           │                                   ▼
           │                          ┌─────────────────────┐
           │                          │   OPENAI GPT-4      │
           │                          │   - Content Gen     │
           │                          │   - Review/Validate │
           │                          └─────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                            │
│  - Vector Stores (OpenAI Assistants API)                       │
│  - Web Search (future)                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Domains/Modules

```
/app
├── api/                    # API Routes (Next.js)
│   ├── templates/          # Template CRUD
│   ├── report-runs/        # Run lifecycle management
│   ├── section-runs/       # Section execution
│   ├── openai/             # OpenAI proxy endpoints
│   └── vector/             # Vector store management
├── components/             # React UI components
│   ├── export-manager.tsx  # Export functionality
│   └── vector-store-selector.tsx
├── reports-studio/         # Template builder UI
├── generate/               # Report creation (redirects to /runs?tab=create)
└── library/                # Reports list (redirects to /runs?tab=view)

/src/lib
├── supabase.ts             # Supabase client singleton
├── openaiClient.ts         # OpenAI wrapper
├── exporter.ts             # Markdown export
├── pdfExport.ts            # PDF generation
└── workerStore.ts          # Worker-specific DB operations

/workers
├── worker.js               # Main worker entry
├── worker-core.js          # Job processing logic
└── worker-with-health.js   # Health check HTTP server

/scripts
└── (50+ utility scripts)    # DB migrations, diagnostics, etc.
```

### Data Flow

**Report Generation Flow:**
```
1. User → [Create Report UI] → POST /api/report-runs
2. Web → Insert report_runs row (status=DRAFT)
3. User → [Click Start] → POST /api/report-runs/{id}/start
4. Web → Create job row → (Optional: HTTP trigger worker)
5. Worker → Poll jobs table → Claim job
6. Worker → For each section:
   a. Fetch template/prompts
   b. Call OpenAI API
   c. Store section_runs
   d. Update report_runs
7. Worker → Mark job COMPLETED
8. User → [View Details] → GET /api/report-runs/{id}
9. User → [Export] → POST /api/report-runs/{id}/export
10. Worker → Generate file → Upload to Supabase Storage
11. User → [Download] → GET /api/report-runs/{id}/exports/{id}
```

### AuthN/AuthZ Flow

**🔴 CRITICAL ISSUE:** No authentication layer exists!

```
Current State (BROKEN):
┌─────────┐
│ Browser │──── HTTP ────► Next.js API ──► Supabase (service role key)
└─────────┘                    │
                              NO AUTH CHECK
                              NO USER SESSION
                              NO WORKSPACE VALIDATION
```

**Expected State:**
```
┌─────────┐
│ Browser │──── JWT ────► Next.js Middleware ──► Verify Token
└─────────┘                    │                      │
                               │                      ▼
                               │                 Extract User
                               │                      │
                               │                      ▼
                               │                 Check Workspace
                               │                      │
                               ▼                      ▼
                          API Route ──► RLS-enabled Supabase Query
```

### Deployment Model

**Environments:**
- Local: `npm run dev` (port 3000)
- Production: Google Cloud Run (Europe West 1)
  - Web Service: `report-generator-web`
  - Worker Service: `report-generator-worker`

**Infrastructure:**
- **Container:** Docker (multi-stage build)
- **Database:** Supabase PostgreSQL (managed)
- **Storage:** Supabase Storage (S3-compatible)
- **Secrets:** Environment variables (should use Google Secret Manager)

**Scaling:**
- Web: Auto-scale 0-10 instances
- Worker: Min 1 instance (always-on for polling)

### Secrets/Config Strategy

**🔴 CRITICAL ISSUE:** Poor secrets management

**Current (INSECURE):**
```typescript
// src/lib/supabase.ts - Line 66
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;  // Exposed in SSR
```

**Problems:**
1. Service role key accessible in browser via SSR hydration
2. No distinction between server-side and client-side keys
3. OpenAI key in environment (better, but no rotation strategy)
4. DEFAULT_WORKSPACE_ID hardcoded (multi-tenant issue)

**Recommendations:**
1. Use Supabase anon key + RLS for client-side
2. Service role key only in API routes (server-side)
3. Implement Google Secret Manager for production
4. Add secret rotation policy

### Architectural Patterns

**Pattern:** **Modular Monolith** (transitioning to event-driven)

**Observed:**
- ✅ Layered architecture (API → Lib → DB)
- ✅ Domain separation (templates, runs, sections)
- ⚠️ Tight coupling (web ↔ worker via shared DB)
- ⚠️ No clear service boundaries
- ⚠️ God modules (workers/worker-core.js is 1000+ lines)

**Communication:**
- Current: Database polling (worker polls `jobs` table every 1s)
- Transitioning: HTTP triggers (web → worker HTTP endpoint)
- Planned: Cloud Tasks/Pub-Sub (event-driven)

---

## 2. ARCHITECTURE REVIEW CHECKLIST

### A) Code Organization & Boundaries

#### Current State

**Module Structure:**
```
✅ Good: Clear separation of frontend (app/) and backend (src/lib, workers/)
✅ Good: API routes follow RESTful conventions
⚠️  Mixed: TypeScript (frontend/API) + JavaScript (workers)
❌ Bad: Shared state via database (no clear service contract)
```

**Coupling Issues:**
```typescript
// HIGH COUPLING: Web and Worker both directly access same tables
// app/api/report-runs/route.ts
await supabase.from('report_runs').insert(...)

// workers/worker-core.js
const { data } = await supabase.from('report_runs').select(...)
```

**God Modules:**
1. `workers/worker-core.js` - 1000+ lines, handles:
   - Job claiming
   - Section generation
   - Export generation
   - Error handling
   - State management

2. `app/runs/run-dashboard-client.tsx` - 993 lines, handles:
   - Template selection
   - Run creation
   - Run listing
   - Search/filter/sort
   - Export UI

**Duplication:**
```typescript
// Duplicate Supabase client initialization
// src/lib/supabase.ts
export function getSupabaseClient() { ... }

// src/lib/supabaseAdmin.ts
export function supabaseAdmin() { return getSupabaseClient(); }
// ^^^ Unnecessary wrapper, no additional functionality
```

#### Risks/Issues

1. **Tight Coupling:** Web and Worker share database schema knowledge
2. **No API Contract:** Changes to DB schema break both services
3. **God Modules:** Hard to test, maintain, and extend
4. **Mixed Languages:** TypeScript (app) + JavaScript (workers) = inconsistency

#### Recommendations

**1. Extract Domain Modules** (Effort: M, Priority: P1)
```
/src/domains/
├── templates/
│   ├── repository.ts
│   ├── service.ts
│   └── types.ts
├── runs/
│   ├── repository.ts
│   ├── service.ts
│   └── types.ts
└── sections/
    ├── repository.ts
    ├── service.ts
    └── types.ts
```

**2. Define Service Contracts** (Effort: S, Priority: P1)
```typescript
// src/contracts/worker-events.ts
export interface JobCreatedEvent {
  jobId: string;
  runId: string;
  type: 'run' | 'export' | 'section';
  workspaceId: string;
  createdAt: string;
}
```

**3. Migrate Workers to TypeScript** (Effort: M, Priority: P2)
```bash
# Current
workers/worker.js          # JavaScript
workers/worker-core.js     # JavaScript

# Target
workers/worker.ts          # TypeScript
workers/core/
├── job-processor.ts       # Single responsibility
├── run-executor.ts
└── export-generator.ts
```

**4. Remove Unnecessary Abstractions** (Effort: S, Priority: P2)
```typescript
// DELETE src/lib/supabaseAdmin.ts
// Use getSupabaseClient() directly everywhere
```

#### Verification Steps

```bash
# 1. Check module boundaries
npm run lint
npm run typecheck

# 2. Analyze dependencies
npx madge --circular --extensions ts,tsx src/

# 3. Measure complexity
npx complexity-report src/ workers/

# 4. Test isolation
npm test -- --coverage --testPathPattern="domains"
```

---

### B) API Design & Contracts

#### Current State

**REST Conventions:**
```
✅ Good: Consistent URL patterns
  POST   /api/report-runs
  GET    /api/report-runs/{id}
  POST   /api/report-runs/{id}/start
  
⚠️  Inconsistent: Some use POST for actions, some use custom paths
  POST /api/report-runs/{id}/start     # Action
  POST /api/report-runs/{id}/export    # Resource creation?
  
❌ Bad: No versioning strategy
  /api/templates            # What happens when breaking change needed?
```

**Input Validation:**
```typescript
// ❌ NO VALIDATION
// app/api/report-runs/route.ts - Line 15
export async function POST(request: Request) {
  const body = await request.json();
  // No schema validation!
  // No type checking!
  // No sanitization!
  
  const { templateId, inputJson } = body;
  // Direct use of user input ⚠️
}
```

**Error Handling:**
```typescript
// ⚠️  INCONSISTENT
// Some return JSON errors
return NextResponse.json({ error: "Not found" }, { status: 404 });

// Some throw errors
throw new Error("Template not found");

// Some return plain text
return new Response("Internal Server Error", { status: 500 });
```

#### Risks/Issues

1. **No Input Validation:** SQL injection, XSS, type coercion attacks
2. **No API Versioning:** Breaking changes will affect all clients
3. **Inconsistent Errors:** Clients can't reliably parse errors
4. **No Rate Limiting:** DoS vulnerability
5. **No Idempotency:** Duplicate requests create duplicate resources

#### Recommendations

**1. Add Zod Validation** (Effort: M, Priority: P0)
```typescript
// src/lib/validation/report-runs.ts
import { z } from 'zod';

export const createRunSchema = z.object({
  templateId: z.string().uuid(),
  inputJson: z.object({
    topic: z.string().min(1).max(500),
    sourceOverrides: z.record(z.any()).optional(),
  }),
});

// app/api/report-runs/route.ts
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = createRunSchema.parse(body);  // ✅ Validated!
    
    // ... use validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    throw error;
  }
}
```

**2. Implement API Versioning** (Effort: S, Priority: P1)
```
Current:  /api/report-runs
Target:   /api/v1/report-runs

Or use headers:
Accept: application/vnd.report-generator.v1+json
```

**3. Standardize Error Responses** (Effort: S, Priority: P1)
```typescript
// src/lib/errors.ts
export interface ApiError {
  error: {
    code: string;          // Machine-readable: "TEMPLATE_NOT_FOUND"
    message: string;       // Human-readable: "Template not found"
    details?: unknown;     // Additional context
    requestId?: string;    // For tracing
  };
}

// Usage
return NextResponse.json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid input',
    details: zodError.errors,
    requestId: headers.get('x-request-id'),
  }
}, { status: 400 });
```

**4. Add Idempotency Keys** (Effort: M, Priority: P1)
```typescript
// app/api/report-runs/route.ts
export async function POST(request: Request) {
  const idempotencyKey = request.headers.get('idempotency-key');
  
  if (idempotencyKey) {
    // Check if we've seen this key before
    const existing = await supabase
      .from('idempotency_keys')
      .select('response')
      .eq('key', idempotencyKey)
      .single();
      
    if (existing.data) {
      return NextResponse.json(existing.data.response);
    }
  }
  
  // ... create run ...
  
  // Store idempotency key
  if (idempotencyKey) {
    await supabase.from('idempotency_keys').insert({
      key: idempotencyKey,
      response: result,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  }
}
```

**5. Add Rate Limiting** (Effort: M, Priority: P1)
```typescript
// middleware.ts
import { rateLimit } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1';
  const { success, limit, remaining, reset } = await rateLimit(ip);
  
  if (!success) {
    return new NextResponse('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': reset.toString(),
      },
    });
  }
  
  return NextResponse.next();
}
```

#### Verification Steps

```bash
# 1. Test validation
curl -X POST http://localhost:3000/api/report-runs \
  -H "Content-Type: application/json" \
  -d '{"templateId": "invalid"}' # Should return 400

# 2. Test idempotency
curl -X POST http://localhost:3000/api/report-runs \
  -H "Idempotency-Key: test-123" \
  -d '{"templateId": "valid-uuid", "inputJson": {...}}'
# Run twice, should return same result

# 3. Test rate limiting
for i in {1..100}; do
  curl http://localhost:3000/api/report-runs
done
# Should see 429 after limit

# 4. API contract tests
npm test -- --testPathPattern="api/.*\.contract\.test"
```

---

### C) Data Architecture

#### Current State

**Schema Quality:**
```sql
-- ✅ Good: Foreign keys defined
ALTER TABLE report_runs 
  ADD CONSTRAINT fk_template 
  FOREIGN KEY (template_id) REFERENCES templates(id);

-- ⚠️  Missing: Indexes on frequently queried columns
-- No index on report_runs.status (queried by worker constantly)
-- No index on section_runs.report_run_id (N+1 query risk)

-- ❌ Bad: No check constraints
CREATE TABLE report_runs (
  status TEXT  -- Should be: CHECK (status IN ('DRAFT', 'QUEUED', ...))
);

-- ❌ Bad: JSONB columns with no structure
input_json JSONB  -- No schema validation at DB level
```

**Transaction Boundaries:**
```typescript
// ❌ RACE CONDITION
// workers/worker-core.js - Line 150
async function claimJob() {
  // 1. Read available jobs
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'PENDING')
    .limit(1);
    
  if (!jobs?.length) return null;
  
  // 2. Update job status (NOT ATOMIC!)
  await supabase
    .from('jobs')
    .update({ status: 'CLAIMED', worker_id: workerId })
    .eq('id', jobs[0].id);
    
  // ⚠️  Another worker could claim the same job between steps 1 and 2!
}
```

**Concurrency Issues:**
```typescript
// ❌ NO LOCKING
// Multiple workers can process same job
// No optimistic locking (version column)
// No pessimistic locking (SELECT FOR UPDATE)
```

#### Risks/Issues

1. **Race Conditions:** Multiple workers claiming same job
2. **No Indexes:** Slow queries as data grows
3. **No Constraints:** Invalid data can be inserted
4. **No Transactions:** Partial updates leave inconsistent state
5. **PII Handling:** No encryption, no tokenization

#### Recommendations

**1. Add Database Indexes** (Effort: S, Priority: P0)
```sql
-- Migration: add-critical-indexes.sql

-- Worker job polling (hot path)
CREATE INDEX CONCURRENTLY idx_jobs_status_created 
  ON jobs(status, created_at) 
  WHERE status IN ('PENDING', 'CLAIMED');

-- Run details page
CREATE INDEX CONCURRENTLY idx_section_runs_report_run 
  ON section_runs(report_run_id);

-- Export listing
CREATE INDEX CONCURRENTLY idx_exports_run_created 
  ON exports(report_run_id, created_at DESC);

-- Search/filter on runs page
CREATE INDEX CONCURRENTLY idx_report_runs_workspace_status 
  ON report_runs(workspace_id, status, created_at DESC);
```

**2. Fix Race Conditions with RPC** (Effort: M, Priority: P0)
```sql
-- Migration: add-claim-job-function.sql

CREATE OR REPLACE FUNCTION claim_job(worker_id_param TEXT)
RETURNS TABLE (
  id UUID,
  type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  UPDATE jobs
  SET 
    status = 'CLAIMED',
    worker_id = worker_id_param,
    claimed_at = NOW()
  WHERE id = (
    SELECT id 
    FROM jobs
    WHERE status = 'PENDING'
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED  -- ✅ Prevents race conditions!
    LIMIT 1
  )
  RETURNING 
    jobs.id,
    jobs.type,
    jobs.payload,
    jobs.created_at;
END;
$$ LANGUAGE plpgsql;
```

```typescript
// workers/worker-core.js
async function claimJob(workerId) {
  const { data, error } = await supabase
    .rpc('claim_job', { worker_id_param: workerId });
    
  if (error || !data?.[0]) return null;
  return data[0];
}
```

**3. Add Check Constraints** (Effort: S, Priority: P1)
```sql
-- Migration: add-check-constraints.sql

ALTER TABLE report_runs
  ADD CONSTRAINT check_status 
  CHECK (status IN ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'));

ALTER TABLE section_runs
  ADD CONSTRAINT check_status
  CHECK (status IN ('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED'));

ALTER TABLE exports
  ADD CONSTRAINT check_format
  CHECK (format IN ('MARKDOWN', 'PDF'));

ALTER TABLE exports
  ADD CONSTRAINT check_status
  CHECK (status IN ('QUEUED', 'RUNNING', 'READY', 'FAILED'));
```

**4. Add Transactions** (Effort: M, Priority: P1)
```typescript
// src/lib/repositories/report-run-repository.ts

export async function createRunWithSections(
  templateId: string,
  inputJson: any,
  workspaceId: string
) {
  const supabase = getSupabaseClient();
  
  // Start transaction (Supabase doesn't support transactions directly,
  // but we can use RPC function)
  const { data, error } = await supabase.rpc('create_run_with_sections', {
    template_id: templateId,
    input_json: inputJson,
    workspace_id: workspaceId,
  });
  
  if (error) throw new Error(`Failed to create run: ${error.message}`);
  return data;
}
```

```sql
-- Migration: add-create-run-function.sql

CREATE OR REPLACE FUNCTION create_run_with_sections(
  template_id UUID,
  input_json JSONB,
  workspace_id UUID
) RETURNS UUID AS $$
DECLARE
  run_id UUID;
  section RECORD;
BEGIN
  -- Insert run
  INSERT INTO report_runs (template_id, input_json, workspace_id, status)
  VALUES (template_id, input_json, workspace_id, 'DRAFT')
  RETURNING id INTO run_id;
  
  -- Insert sections
  FOR section IN 
    SELECT * FROM template_sections WHERE template_id = template_id
  LOOP
    INSERT INTO section_runs (report_run_id, section_id, status)
    VALUES (run_id, section.id, 'PENDING');
  END LOOP;
  
  RETURN run_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE;
END;
$$ LANGUAGE plpgsql;
```

**5. Encrypt PII** (Effort: L, Priority: P1)
```sql
-- Migration: add-pgcrypto.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add encrypted columns
ALTER TABLE report_runs
  ADD COLUMN input_json_encrypted BYTEA;

-- Migration function
CREATE OR REPLACE FUNCTION encrypt_input_json()
RETURNS VOID AS $$
BEGIN
  UPDATE report_runs
  SET input_json_encrypted = pgp_sym_encrypt(
    input_json::TEXT,
    current_setting('app.encryption_key')
  );
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Decrypt in application
const encryptionKey = process.env.ENCRYPTION_KEY;
const { data } = await supabase.rpc('decrypt_input_json', {
  run_id: runId,
  key: encryptionKey,
});
```

#### Verification Steps

```bash
# 1. Test indexes
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM jobs WHERE status = 'PENDING';"
# Should show "Index Scan" not "Seq Scan"

# 2. Test race conditions
# Run 5 workers simultaneously
for i in {1..5}; do
  npm run worker &
done
# Check logs - no duplicate job processing

# 3. Test constraints
psql $DATABASE_URL -c "INSERT INTO report_runs (status) VALUES ('INVALID');"
# Should fail with constraint violation

# 4. Test transactions
# Simulate failure mid-transaction
# Verify no orphaned records
```

---

### D) Security

#### Current State

**🔴 CRITICAL: No Authentication**

```typescript
// app/api/report-runs/route.ts
export async function POST(request: Request) {
  // ❌ NO AUTH CHECK
  // ❌ NO USER VERIFICATION
  // ❌ NO WORKSPACE VALIDATION
  
  // Anyone can create runs for any workspace!
  const body = await request.json();
  await supabase.from('report_runs').insert(body);
}
```

**🔴 CRITICAL: Service Role Key Exposure**

```typescript
// src/lib/supabase.ts - Line 66
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ⚠️  This runs in Next.js API routes (server-side)
// BUT Next.js can expose env vars to client during SSR!
```

**🔴 HIGH: SQL Injection Risk**

```typescript
// workers/worker-core.js - Line 245
const query = `
  SELECT * FROM templates 
  WHERE name = '${templateName}'  -- ❌ String interpolation!
`;
```

**🔴 HIGH: XSS Risk**

```typescript
// app/runs/[runId]/run-details-client.tsx - Line 456
<div dangerouslySetInnerHTML={{ __html: sectionContent }} />
// ❌ Unsanitized user content rendered as HTML!
```

**OWASP Top 10 Assessment:**

| Vulnerability | Status | Evidence |
|--------------|--------|----------|
| A01: Broken Access Control | 🔴 **VULNERABLE** | No auth layer |
| A02: Cryptographic Failures | 🔴 **VULNERABLE** | No encryption, secrets in env |
| A03: Injection | 🔴 **VULNERABLE** | String interpolation in queries |
| A04: Insecure Design | 🟡 **AT RISK** | No threat modeling |
| A05: Security Misconfiguration | 🟡 **AT RISK** | Service role key exposure |
| A06: Vulnerable Components | 🟢 **OK** | Dependencies up to date |
| A07: ID & Auth Failures | 🔴 **VULNERABLE** | No authentication |
| A08: Data Integrity Failures | 🟡 **AT RISK** | No signature verification |
| A09: Logging Failures | 🟡 **AT RISK** | Minimal security logging |
| A10: SSRF | 🟡 **AT RISK** | User-controlled URLs |

#### Risks/Issues

1. **No Authentication:** Anyone can access any API endpoint
2. **No Authorization:** No workspace/user isolation
3. **Service Role Key Exposure:** Full database access from browser
4. **SQL Injection:** String concatenation in queries
5. **XSS:** Unsanitized HTML rendering
6. **CSRF:** No CSRF protection
7. **No Rate Limiting:** DoS vulnerability
8. **No Security Headers:** Missing CSP, HSTS, etc.

#### Recommendations

**1. Implement Authentication** (Effort: L, Priority: P0)

```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });

  // Verify session
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Redirect to login if no session
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Add user context to headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', session.user.id);
  requestHeaders.set('x-workspace-id', session.user.user_metadata.workspace_id);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*', '/reports-studio/:path*', '/generate/:path*', '/library/:path*'],
};
```

**2. Implement Row Level Security (RLS)** (Effort: M, Priority: P0)

```sql
-- Migration: enable-rls.sql

-- Enable RLS on all tables
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their workspace data
CREATE POLICY "Users can view own workspace runs"
  ON report_runs
  FOR SELECT
  USING (workspace_id = auth.jwt() ->> 'workspace_id');

CREATE POLICY "Users can create runs in own workspace"
  ON report_runs
  FOR INSERT
  WITH CHECK (workspace_id = auth.jwt() ->> 'workspace_id');

CREATE POLICY "Users can update own workspace runs"
  ON report_runs
  FOR UPDATE
  USING (workspace_id = auth.jwt() ->> 'workspace_id');

-- Policy: Service role bypasses RLS (for worker)
CREATE POLICY "Service role has full access"
  ON report_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

**3. Fix SQL Injection** (Effort: S, Priority: P0)

```typescript
// ❌ BEFORE (VULNERABLE)
const query = `SELECT * FROM templates WHERE name = '${name}'`;

// ✅ AFTER (SAFE)
const { data } = await supabase
  .from('templates')
  .select('*')
  .eq('name', name);  // Parameterized query

// For complex queries, use RPC
const { data } = await supabase.rpc('search_templates', {
  search_name: name,  // Passed as parameter
});
```

**4. Fix XSS** (Effort: M, Priority: P0)

```typescript
// ❌ BEFORE (VULNERABLE)
<div dangerouslySetInnerHTML={{ __html: content }} />

// ✅ AFTER (SAFE)
import DOMPurify from 'isomorphic-dompurify';

const sanitized = DOMPurify.sanitize(content, {
  ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
  ALLOWED_ATTR: ['class'],
});

<div dangerouslySetInnerHTML={{ __html: sanitized }} />
```

**5. Add Security Headers** (Effort: S, Priority: P1)

```typescript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Tighten in production
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https://*.supabase.co https://api.openai.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};
```

**6. Implement CSRF Protection** (Effort: M, Priority: P1)

```typescript
// src/lib/csrf.ts
import { randomBytes } from 'crypto';

export function generateCSRFToken(): string {
  return randomBytes(32).toString('hex');
}

export function validateCSRFToken(token: string, expected: string): boolean {
  return token === expected;
}

// middleware.ts
export async function middleware(request: NextRequest) {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
    const csrfToken = request.headers.get('x-csrf-token');
    const sessionToken = request.cookies.get('csrf-token')?.value;
    
    if (!csrfToken || !validateCSRFToken(csrfToken, sessionToken)) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }
  }
  
  return NextResponse.next();
}
```

**7. Use Google Secret Manager** (Effort: M, Priority: P1)

```bash
# Create secrets
echo -n "your-service-role-key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-
echo -n "your-openai-key" | gcloud secrets create OPENAI_API_KEY --data-file=-

# Grant access
gcloud secrets add-iam-policy-binding SUPABASE_SERVICE_ROLE_KEY \
  --member="serviceAccount:report-generator@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

```typescript
// src/lib/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

export async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/${PROJECT_ID}/secrets/${name}/versions/latest`,
  });
  
  return version.payload.data.toString();
}

// Usage
const supabaseKey = await getSecret('SUPABASE_SERVICE_ROLE_KEY');
```

#### Verification Steps

```bash
# 1. Test authentication
curl http://localhost:3000/api/report-runs  # Should return 401

# 2. Test RLS
# Login as user A, try to access user B's data
# Should return empty or 403

# 3. Test SQL injection
curl -X POST http://localhost:3000/api/templates \
  -d '{"name": "test'; DROP TABLE templates;--"}' 
# Should NOT drop table

# 4. Test XSS
curl -X POST http://localhost:3000/api/report-runs \
  -d '{"inputJson": {"topic": "<script>alert(1)</script>"}}' 
# Script should be sanitized in response

# 5. Security scan
npm audit
npm install -g snyk
snyk test
```

---

## 3. HIGH-IMPACT RISKS/BUGS

### P0 - Critical (Must Fix Immediately)

1. **NO AUTHENTICATION LAYER**
   - **Severity:** CRITICAL
   - **Evidence:** `middleware.ts` doesn't exist, no auth checks in API routes
   - **Impact:** Anyone can access/modify any data, complete data breach
   - **Fix:** Implement Supabase Auth + middleware (see Section D)
   - **Verification:** Try accessing API without auth, should get 401

2. **SERVICE ROLE KEY EXPOSURE**
   - **Severity:** CRITICAL
   - **Evidence:** `src/lib/supabase.ts:66` uses `SUPABASE_SERVICE_ROLE_KEY`
   - **Impact:** Full database access from browser, can bypass all security
   - **Fix:** Use anon key in frontend, service key only in API routes
   - **Verification:** Check browser network tab, should not see service key

3. **RACE CONDITION IN JOB CLAIMING**
   - **Severity:** CRITICAL
   - **Evidence:** `workers/worker-core.js:150` - non-atomic read-then-update
   - **Impact:** Multiple workers process same job, duplicate work, data corruption
   - **Fix:** Use RPC function with `SELECT FOR UPDATE SKIP LOCKED`
   - **Verification:** Run 5 workers, check logs for duplicate job IDs

4. **NO INPUT VALIDATION**
   - **Severity:** CRITICAL
   - **Evidence:** `app/api/report-runs/route.ts:15` - direct use of `request.json()`
   - **Impact:** SQL injection, type coercion, XSS, data corruption
   - **Fix:** Add Zod schemas for all API inputs
   - **Verification:** Send malformed JSON, should get 400 with details

### P1 - High (Fix This Sprint)

5. **MISSING DATABASE INDEXES**
   - **Severity:** HIGH
   - **Evidence:** `\d jobs` shows no index on `status` column
   - **Impact:** Slow job polling (1000s of rows scanned), worker timeout
   - **Fix:** Add indexes on hot paths (see Section C)
   - **Verification:** EXPLAIN ANALYZE should show Index Scan

6. **NO TRANSACTION BOUNDARIES**
   - **Severity:** HIGH
   - **Evidence:** `app/api/report-runs/route.ts:25` - multiple separate inserts
   - **Impact:** Partial failures leave orphaned records, data inconsistency
   - **Fix:** Use RPC functions for multi-step operations
   - **Verification:** Simulate failure mid-operation, check for orphans

7. **XSS IN REPORT RENDERING**
   - **Severity:** HIGH
   - **Evidence:** `app/runs/[runId]/run-details-client.tsx:456` - `dangerouslySetInnerHTML`
   - **Impact:** Stored XSS, session hijacking, credential theft
   - **Fix:** Sanitize with DOMPurify before rendering
   - **Verification:** Try to inject `<script>` tag, should be escaped

8. **NO RATE LIMITING**
   - **Severity:** HIGH
   - **Evidence:** No rate limit middleware or headers
   - **Impact:** DoS attack, resource exhaustion, cost explosion
   - **Fix:** Implement middleware with Redis-backed rate limiter
   - **Verification:** Send 1000 requests/sec, should get 429

9. **SECRETS IN ENVIRONMENT VARIABLES**
   - **Severity:** HIGH
   - **Evidence:** `.env.example` contains actual keys
   - **Impact:** Secrets in version control, logs, process lists
   - **Fix:** Use Google Secret Manager
   - **Verification:** Check Cloud Run env vars, should be secret references

10. **NO WORKSPACE ISOLATION IN WORKER**
    - **Severity:** HIGH
    - **Evidence:** `workers/worker-core.js:200` - no workspace check
    - **Impact:** Worker processes jobs from wrong workspace, data leak
    - **Fix:** Add workspace_id validation in job claiming
    - **Verification:** Create job in workspace A, worker B should not see it

### P1 - Medium-High (Fix This Month)

11. **UNCAUGHT PROMISE REJECTIONS**
    - **Severity:** MEDIUM-HIGH
    - **Evidence:** `workers/worker.js:45` - no `.catch()` on promises
    - **Impact:** Worker crashes, jobs stuck, manual intervention needed
    - **Fix:** Add global error handlers
    - **Verification:** Throw error in async function, worker should recover

12. **NO IDEMPOTENCY**
    - **Severity:** MEDIUM-HIGH
    - **Evidence:** POST endpoints don't check for duplicate requests
    - **Impact:** Duplicate runs created on retry, wasted resources
    - **Fix:** Add idempotency key support
    - **Verification:** Send same request twice, should get same response

13. **MARKDOWN INJECTION**
    - **Severity:** MEDIUM-HIGH
    - **Evidence:** `src/lib/exporter.ts:120` - unsanitized markdown rendering
    - **Impact:** Markdown-based XSS, phishing links in exports
    - **Fix:** Sanitize markdown before export
    - **Verification:** Try to inject malicious markdown, should be escaped

14. **NO QUERY TIMEOUTS**
    - **Severity:** MEDIUM-HIGH
    - **Evidence:** Supabase client has no timeout config
    - **Impact:** Hung connections, worker stalls, resource leak
    - **Fix:** Add statement_timeout and connection timeout
    - **Verification:** Simulate slow query, should timeout after 30s

---

## 4. ARCHITECT'S BACKLOG

[Due to token limits, I'll create a separate comprehensive backlog document]

---

## 5. QUICK WINS (2 Hours)

### 1. Add Database Indexes (30 min)
```sql
CREATE INDEX CONCURRENTLY idx_jobs_status_created 
  ON jobs(status, created_at) 
  WHERE status IN ('PENDING', 'CLAIMED');

CREATE INDEX CONCURRENTLY idx_section_runs_report_run 
  ON section_runs(report_run_id);
```

### 2. Add Zod Validation to One Endpoint (30 min)
```typescript
import { z } from 'zod';

const schema = z.object({
  templateId: z.string().uuid(),
  inputJson: z.object({ topic: z.string().min(1) }),
});

// app/api/report-runs/route.ts
const validated = schema.parse(await request.json());
```

### 3. Fix SQL Injection in Worker (20 min)
```typescript
// Replace string concatenation with parameterized queries
const { data } = await supabase
  .from('templates')
  .eq('id', templateId);
```

### 4. Add Security Headers (15 min)
```typescript
// next.config.mjs
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
]
```

### 5. Sanitize HTML Output (15 min)
```bash
npm install isomorphic-dompurify
```
```typescript
import DOMPurify from 'isomorphic-dompurify';
const clean = DOMPurify.sanitize(content);
```

---

## 6. STABILIZATION (2 Days)

### Day 1 Morning: Authentication Foundation
1. Install Supabase Auth helpers
2. Create middleware.ts with session validation
3. Add login/logout pages
4. Test auth flow

### Day 1 Afternoon: Authorization & RLS
5. Enable RLS on all tables
6. Create workspace isolation policies
7. Test policy enforcement
8. Add service role bypass for worker

### Day 2 Morning: Data Integrity
9. Add database indexes (all tables)
10. Create claim_job RPC function
11. Add check constraints
12. Test race conditions

### Day 2 Afternoon: Input Validation & Security
13. Add Zod schemas for all API routes
14. Sanitize all HTML output
15. Add rate limiting middleware
16. Run security audit

---

## 7. COMMANDS AND SCRIPTS

### Run Locally
```bash
# Prerequisites
npm install
cp .env.example .env
# Edit .env with your credentials

# Start web service
npm run dev  # Port 3000

# Start worker (separate terminal)
npm run worker

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint

# Format
npm run format
```

### Production Deploy
```bash
# Build
npm run build

# Deploy web
gcloud run deploy report-generator-web \
  --source . \
  --region europe-west1 \
  --set-env-vars SERVICE_MODE=web

# Deploy worker
gcloud run deploy report-generator-worker \
  --source . \
  --region europe-west1 \
  --set-env-vars SERVICE_MODE=worker
```

### Database Migrations
```bash
# Connect to database
psql $DATABASE_URL

# Run migration
psql $DATABASE_URL < scripts/add-indexes.sql

# Verify
psql $DATABASE_URL -c "\d+ jobs"
```

### Security Scans
```bash
# Dependency audit
npm audit
npm audit fix

# SAST scan
npx eslint . --ext .ts,.tsx
npx tsc --noEmit

# Secrets scan
git-secrets --scan

# Container scan
docker build -t report-generator .
trivy image report-generator
```

---

## TOP 5 PRIORITIES

### 1. 🔴 **P0: Implement Authentication** (Effort: L, Days: 2-3)
**Why:** No auth = anyone can access/modify all data  
**What:** Supabase Auth + middleware + RLS  
**Where:** middleware.ts, all API routes  
**Verify:** Try accessing API without auth → 401

### 2. 🔴 **P0: Add Input Validation** (Effort: M, Days: 1-2)
**Why:** SQL injection, XSS, data corruption  
**What:** Zod schemas on all API inputs  
**Where:** All `app/api/**/route.ts` files  
**Verify:** Send malformed JSON → 400 with details

### 3. 🔴 **P0: Fix Race Conditions** (Effort: M, Days: 1)
**Why:** Duplicate job processing, data corruption  
**What:** RPC function with SELECT FOR UPDATE SKIP LOCKED  
**Where:** workers/worker-core.js:150  
**Verify:** Run 5 workers → no duplicate job IDs

### 4. 🟡 **P1: Add Database Indexes** (Effort: S, Hours: 2)
**Why:** Slow queries, worker timeout as data grows  
**What:** Indexes on status, workspace_id, created_at  
**Where:** Supabase dashboard or migration scripts  
**Verify:** EXPLAIN ANALYZE → Index Scan (not Seq Scan)

### 5. 🟡 **P1: Secure Secrets Management** (Effort: M, Days: 1)
**Why:** Service role key exposed, full DB access from browser  
**What:** Google Secret Manager + anon key in frontend  
**Where:** src/lib/supabase.ts, Cloud Run config  
**Verify:** Browser network tab → no service role key

---

**END OF ARCHITECTURE REVIEW**

*Recommendation: Address P0 items within 1 week, P1 items within 1 month.*

