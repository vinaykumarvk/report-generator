# Supabase Security Configuration

## 🔐 Overview

This application uses TWO different Supabase keys for different purposes:

1. **ANON KEY** (Public) - Safe to expose in browser
2. **SERVICE ROLE KEY** (Secret) - NEVER expose to browser

## 🔑 Key Types

### NEXT_PUBLIC_SUPABASE_ANON_KEY (Public - Client-Side)

**Purpose:** Client-side operations with Row Level Security (RLS) enforcement

**Where to use:**
- ✅ Browser/client components
- ✅ Public-facing pages
- ✅ User authentication flows

**Security:**
- ✅ Safe to expose in browser
- ✅ RLS policies enforce access control
- ✅ Users can only access their own data

**How to get:**
```
Supabase Dashboard → Settings → API → Project API keys → `anon` `public`
```

**Example:**
```env
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### SUPABASE_SERVICE_ROLE_KEY (Secret - Server-Side ONLY)

**Purpose:** Server-side operations with full database access (bypasses RLS)

**Where to use:**
- ✅ API routes (`app/api/**`)
- ✅ Server components
- ✅ Worker processes
- ✅ Background jobs

**Security:**
- ❌ **NEVER** expose to browser
- ❌ **NEVER** use in client components
- ❌ **NEVER** commit to version control
- ✅ Only use in server-side code

**How to get:**
```
Supabase Dashboard → Settings → API → Project API keys → `service_role` `secret`
```

**Example:**
```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🛡️ Current Implementation

### Client-Side (Browser)

```typescript
// src/lib/supabase.ts
export function getSupabaseClientPublic() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return createClient<Database>(supabaseUrl, supabaseAnonKey);
}
```

**Usage in React components:**
```typescript
'use client';

import { getSupabaseClientPublic } from '@/lib/supabase';

export default function MyComponent() {
  const supabase = getSupabaseClientPublic();
  
  // This query respects RLS policies
  const { data } = await supabase
    .from('report_runs')
    .select('*')
    .eq('workspace_id', userWorkspaceId); // ✅ User can only see their own workspace
}
```

### Server-Side (API Routes)

```typescript
// src/lib/supabase.ts
export function getSupabaseClient() {
  // ✅ Throws error if called in browser
  if (typeof window !== 'undefined') {
    throw new Error('Cannot use service role key in browser!');
  }
  
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return createClient<Database>(supabaseUrl, supabaseKey);
}
```

**Usage in API routes:**
```typescript
// app/api/report-runs/route.ts
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request: Request) {
  const supabase = getSupabaseClient(); // ✅ Server-side only
  
  // This query bypasses RLS (full access)
  const { data } = await supabase
    .from('report_runs')
    .select('*');
    
  return NextResponse.json(data);
}
```

---

## ⚠️ Security Checks

### 1. Service Role Key Protection

The `getSupabaseClient()` function includes a runtime check:

```typescript
if (typeof window !== 'undefined') {
  throw new Error(
    'getSupabaseClient() can only be called on the server. ' +
    'Use getSupabaseClientPublic() for client-side operations.'
  );
}
```

This prevents accidental use of service role key in browser.

### 2. Environment Variable Naming Convention

```
NEXT_PUBLIC_*  →  Exposed to browser (safe)
Other          →  Server-only (secret)
```

Next.js automatically:
- ✅ Exposes `NEXT_PUBLIC_*` vars to browser
- ✅ Keeps other vars server-only

### 3. Row Level Security (RLS)

**Status:** 🔴 NOT YET ENABLED (TODO)

Once RLS is enabled:
```sql
-- Example RLS policy
ALTER TABLE report_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only view own workspace runs"
  ON report_runs
  FOR SELECT
  USING (workspace_id = auth.jwt() ->> 'workspace_id');
```

Then anon key queries automatically respect these policies.

---

## 🚀 Production Deployment

### Google Cloud Run

**Option 1: Environment Variables**
```bash
gcloud run deploy report-generator-web \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..." \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=eyJ..."
```

**Option 2: Google Secret Manager (Recommended)**
```bash
# Create secrets
echo -n "your-service-key" | gcloud secrets create SUPABASE_SERVICE_ROLE_KEY --data-file=-

# Deploy with secrets
gcloud run deploy report-generator-web \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co" \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ..." \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest"
```

---

## 🧪 Testing Security

### Test 1: Verify Service Key is NOT in Browser

```bash
# Build for production
npm run build

# Check browser bundle
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static/

# Should return NO results
```

### Test 2: Verify Client Function Throws Error in Browser

```typescript
// This should throw an error in browser console
import { getSupabaseClient } from '@/lib/supabase';

// ❌ Error: Cannot use service role key in browser!
const supabase = getSupabaseClient();
```

### Test 3: Verify RLS Works (Once Enabled)

```typescript
// Login as User A, try to query User B's data
const { data } = await supabase
  .from('report_runs')
  .select('*')
  .eq('workspace_id', 'user-b-workspace-id');

// Should return empty array (RLS blocks access)
console.log(data); // []
```

---

## 📋 Migration Checklist

### Current State (❌ INSECURE)
- [ ] Service role key used everywhere
- [ ] No RLS enabled
- [ ] No client/server separation
- [ ] Keys in plain environment variables

### Target State (✅ SECURE)
- [x] Client uses anon key
- [x] Server uses service role key
- [x] Runtime check prevents browser exposure
- [ ] RLS enabled on all tables
- [ ] Google Secret Manager for production
- [ ] Key rotation policy

---

## 🔄 Key Rotation

**Frequency:** Every 90 days

**Process:**
1. Generate new service role key in Supabase Dashboard
2. Update Google Secret Manager
3. Redeploy services
4. Revoke old key

**Automation:**
```bash
# scripts/rotate-keys.sh
# TODO: Automate with gcloud CLI
```

---

## 📚 Additional Resources

- [Supabase Row Level Security Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Google Secret Manager](https://cloud.google.com/secret-manager/docs)

---

**Updated:** January 3, 2026  
**Status:** ✅ Client/Server Separation Implemented  
**Next Steps:** Enable RLS policies, migrate to Secret Manager

