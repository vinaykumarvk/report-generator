# Navigation Restructuring Plan

## New Structure

### Top Navigation
1. **Report Studio** → `/reports-studio` (Template management - unchanged)
2. **Generate New** → `/generate` (Create new reports - formerly "New Report" tab)
3. **Reports Library** → `/library` (View existing reports - formerly "Generated Reports" tab)

### Implementation Strategy

Since the existing `run-dashboard-client.tsx` has both tabs embedded, we have two options:

**Option A: Keep existing `/runs` and create redirects**
- `/generate` → redirects to `/runs` with tab=create query param
- `/library` → redirects to `/runs` with tab=view query param
- Modify `run-dashboard-client.tsx` to read query params

**Option B: Split into separate components** (more work)
- Extract "create" logic → `generate-new-client.tsx`
- Extract "view" logic → `reports-library-client.tsx`
- Remove tabs from both components

**Recommendation**: Start with Option A for faster implementation, can refactor to Option B later.

## Option A Implementation (Quick Win)

1. Update `app/components/top-tabs.tsx` ✅
2. Create `/generate/page.tsx` that redirects or embeds with tab parameter
3. Create `/library/page.tsx` that redirects or embeds with tab parameter  
4. Update `run-dashboard-client.tsx` to:
   - Read `searchParams` for initial tab
   - Update URL when tab changes (for proper navigation)
   
This maintains all existing functionality while giving users direct navigation links.



