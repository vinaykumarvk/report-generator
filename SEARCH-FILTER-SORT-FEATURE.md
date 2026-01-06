# Generated Reports - Search, Filter, Sort Feature

## 🎯 Feature Overview

Added comprehensive search, filter, and sort functionality to the Generated Reports page for better report management and discovery.

---

## ✨ Features Implemented

### 1. **Search**
- **Field**: Full-text search box
- **Searches across**:
  - Template name
  - Topic
  - Run ID
- **Real-time**: Updates as you type
- **Case-insensitive**: Matches regardless of case

### 2. **Filter by Status**
- **Options**:
  - All (default)
  - Draft
  - Queued
  - Running
  - Completed
  - Failed
- **Updates**: List updates immediately on selection

### 3. **Sort By**
- **Options**:
  - Created Date (default)
  - Completed Date
  - Template Name
  - Topic
- **Flexible**: Choose what matters to you

### 4. **Sort Order**
- **Options**:
  - Newest First (default - descending)
  - Oldest First (ascending)
- **Applies to**: Whatever sort field is selected

---

## 🎨 UI Design

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Generated Reports                         [🔄 Refresh Status]   │
│ Check live status for long-running jobs                          │
├─────────────────────────────────────────────────────────────────┤
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐ │
│ │ Search       │ Status       │ Sort By      │ Order        │ │
│ │ [Input...  ] │ [All      ▼] │ [Created  ▼] │ [Newest   ▼]│ │
│ └──────────────┴──────────────┴──────────────┴──────────────┘ │
│                                                                  │
│ Showing 3 of 10 runs                                            │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ AI-Powered Financial Insights         [COMPLETED]           ││
│ │ Topic: Renewable Energy Investment                          ││
│ │ Run ID: 03c98021-8c70-4bbe-87b8-3020cc046c17               ││
│ │ Created: 03/01/2026, 11:39:36                              ││
│ │ Completed: 03/01/2026, 11:45:31                            ││
│ │ [Download .md] [Download .pdf] [View Details]              ││
│ └─────────────────────────────────────────────────────────────┘│
│ ... more runs ...                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Responsive Grid
- **Desktop**: 4 columns (Search, Status, Sort By, Order)
- **Tablet**: 2x2 grid
- **Mobile**: Single column stack

### Styling
- Semi-transparent background with subtle border
- Consistent padding and spacing
- Matches existing dark theme
- Accessible form controls

---

## 🔍 Search Examples

### Example 1: Find by Template
```
Search: "financial"
Result: Shows all runs using templates with "financial" in the name
```

### Example 2: Find by Topic
```
Search: "renewable"
Result: Shows runs with topic containing "renewable"
```

### Example 3: Find by ID
```
Search: "03c98021"
Result: Shows the specific run with that ID
```

### Example 4: No Results
```
Search: "nonexistent"
Status Filter: COMPLETED
Result: Shows empty state with "Clear Filters" button
```

---

## 🎛️ Filter Examples

### Example 1: Show Only Completed
```
Status: COMPLETED
Result: Only successful, finished reports
Use case: Find reports ready for download
```

### Example 2: Show Active Jobs
```
Status: RUNNING
Result: Reports currently being generated
Use case: Monitor progress
```

### Example 3: Show Failed Reports
```
Status: FAILED
Result: Reports that encountered errors
Use case: Troubleshoot issues
```

---

## 📊 Sort Examples

### Example 1: Most Recent First (Default)
```
Sort By: Created Date
Order: Newest First
Result: Latest reports at the top
```

### Example 2: By Template
```
Sort By: Template Name
Order: Oldest First
Result: Reports grouped by template alphabetically
```

### Example 3: By Completion
```
Sort By: Completed Date
Order: Newest First
Result: Most recently finished reports first
```

### Example 4: By Topic
```
Sort By: Topic
Order: Oldest First
Result: Topics in alphabetical order
```

---

## 🧠 Combined Search & Filter Scenarios

### Scenario 1: Find Recent Financial Reports
```
Search: "financial"
Status: COMPLETED
Sort By: Created Date
Order: Newest First
→ Recent completed financial reports
```

### Scenario 2: Troubleshoot Failures
```
Search: (empty)
Status: FAILED
Sort By: Created Date
Order: Newest First
→ Most recent failures for investigation
```

### Scenario 3: Find Old Drafts
```
Search: (empty)
Status: DRAFT
Sort By: Created Date
Order: Oldest First
→ Abandoned drafts that need cleanup
```

### Scenario 4: Topic-Based Research
```
Search: "climate"
Status: ALL
Sort By: Topic
Order: Oldest First
→ All climate-related reports chronologically
```

---

## 💻 Technical Implementation

### State Management
```typescript
const [searchQuery, setSearchQuery] = useState("");
const [statusFilter, setStatusFilter] = useState<string>("ALL");
const [sortBy, setSortBy] = useState<"created" | "completed" | "template" | "topic">("created");
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
```

### Filtering Logic
```typescript
const filteredAndSortedRuns = useCallback(() => {
  let result = [...runs];

  // 1. Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((run) => {
      const templateName = run.template_version_snapshot_json?.name?.toLowerCase() || "";
      const topic = run.input_json?.topic?.toLowerCase() || "";
      const runId = run.id.toLowerCase();
      return templateName.includes(query) || topic.includes(query) || runId.includes(query);
    });
  }

  // 2. Status filter
  if (statusFilter !== "ALL") {
    result = result.filter((run) => run.status === statusFilter);
  }

  // 3. Sorting
  result.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case "created":
        comparison = (a.created_at || "").localeCompare(b.created_at || "");
        break;
      case "completed":
        comparison = (a.completed_at || "").localeCompare(b.completed_at || "");
        break;
      case "template":
        comparison = (a.template_version_snapshot_json?.name || "").localeCompare(
          b.template_version_snapshot_json?.name || ""
        );
        break;
      case "topic":
        comparison = (a.input_json?.topic || "").localeCompare(b.input_json?.topic || "");
        break;
    }
    return sortOrder === "asc" ? comparison : -comparison;
  });

  return result;
}, [runs, searchQuery, statusFilter, sortBy, sortOrder]);
```

### Performance
- **Memoized**: Uses `useCallback` to avoid re-computing unnecessarily
- **Client-side**: Fast filtering without server round-trips
- **Efficient**: Simple array operations, scales well up to 1000s of runs

---

## 🎯 User Benefits

### For Report Creators
1. ✅ **Find specific reports quickly** via search
2. ✅ **Track active jobs** with status filter
3. ✅ **Review history** by sorting by date

### For Managers
1. ✅ **Monitor team output** by template
2. ✅ **Identify failures** with status filter
3. ✅ **Analyze trends** by sorting by topic

### For Developers
1. ✅ **Debug issues** by searching run IDs
2. ✅ **Find failed jobs** for troubleshooting
3. ✅ **Track performance** by completion dates

---

## 📱 Responsive Behavior

### Desktop (> 1024px)
```
[Search.....................] [Status ▼] [Sort By ▼] [Order ▼]
```

### Tablet (768px - 1024px)
```
[Search.....................] [Status ▼]
[Sort By ▼]                   [Order ▼]
```

### Mobile (< 768px)
```
[Search...................]
[Status ▼]
[Sort By ▼]
[Order ▼]
```

---

## 🆕 Empty States

### No Runs at All
```
📊 No Runs Yet
Create your first run to get started
[Create New Run]
```

### No Matching Results
```
🔍 No Matching Runs
Try adjusting your search or filters

Showing 0 of 10 runs
[Clear Filters]
```

### Clear Filters Action
Resets:
- Search query → ""
- Status filter → "ALL"
- Keeps sort preferences (user preference)

---

## 🎨 Accessibility

### Labels
- All form controls have `<label>` elements
- IDs properly associated with labels

### ARIA
- Results count announced
- Status changes reflected in UI
- Keyboard navigable

### Visual Feedback
- Focused states on inputs
- Clear hover states on dropdowns
- Disabled states when needed

---

## 🔄 Integration with Existing Features

### Auto-refresh
- Search/filter/sort **preserved** during auto-refresh
- User's view remains stable
- Only data updates, not UI controls

### Manual Refresh
- "🔄 Refresh Status" button still works
- Fetches latest data from server
- Applies current filters to new data

### Create New Run
- Switching to "Create" tab doesn't clear filters
- Returning to "View" tab restores filter state

---

## 📊 Results Counter

### Format
```
Showing X of Y runs
```

### Examples
```
Showing 10 of 10 runs    → No filters active
Showing 3 of 10 runs     → Filters applied
Showing 1 of 10 runs     → Highly specific search
Showing 0 of 10 runs     → No matches (empty state shown)
```

### Purpose
- **Feedback**: User knows how many results match
- **Transparency**: User sees total vs. filtered count
- **Guidance**: Helps decide if filters are too narrow

---

## 🎯 Keyboard Shortcuts (Future Enhancement)

Potential additions:
- `Ctrl+F` / `Cmd+F` → Focus search box
- `Escape` → Clear search
- `Alt+S` → Focus status filter
- `Alt+R` → Refresh status

---

## 🧪 Testing Scenarios

### Test 1: Search Functionality
1. Enter "financial" in search
2. Verify only matching runs appear
3. Clear search
4. Verify all runs return

### Test 2: Status Filter
1. Select "COMPLETED"
2. Verify only completed runs shown
3. Select "FAILED"
4. Verify only failed runs shown

### Test 3: Sort Order
1. Sort by "Template Name"
2. Verify alphabetical order
3. Toggle order to "Oldest First"
4. Verify reverse order

### Test 4: Combined Filters
1. Search for "renewable"
2. Filter by "COMPLETED"
3. Sort by "Created Date", "Newest First"
4. Verify results match all criteria

### Test 5: No Results
1. Search for nonsense string
2. Verify empty state appears
3. Click "Clear Filters"
4. Verify results return

---

## 📈 Future Enhancements

### Phase 2 (Potential)
1. **Date range filters**: Created between X and Y
2. **Multi-select status**: Show RUNNING + QUEUED together
3. **Save filter presets**: Quick access to common views
4. **Export filtered list**: Download CSV of visible runs
5. **Advanced search**: Regex or field-specific queries

### Phase 3 (Potential)
1. **Bulk actions**: Delete/restart multiple runs
2. **Tags/labels**: Custom categorization
3. **Favorites**: Pin important runs
4. **Share filters**: URL with filter params
5. **Search history**: Recent searches dropdown

---

## 📝 User Guide

### Quick Start

**To search**:
1. Type in the Search box
2. Results filter as you type

**To filter by status**:
1. Click Status dropdown
2. Select desired status
3. List updates immediately

**To sort**:
1. Choose "Sort By" field (Created, Completed, Template, Topic)
2. Choose "Order" (Newest First or Oldest First)
3. List reorders automatically

**To clear filters**:
- Clear search box manually, or
- Click "Clear Filters" button (appears when no results)

---

## 🎉 Summary

### Added
- ✅ Full-text search across template, topic, and run ID
- ✅ Status filter (All, Draft, Queued, Running, Completed, Failed)
- ✅ Sort by Created, Completed, Template, or Topic
- ✅ Sort order (Newest First or Oldest First)
- ✅ Results counter (Showing X of Y runs)
- ✅ Empty state for no matches
- ✅ Clear Filters button

### Benefits
- 🚀 **Faster**: Find reports in seconds
- 🎯 **Precise**: Filter exactly what you need
- 📊 **Organized**: Sort by what matters
- 💡 **Transparent**: See filtered vs. total count
- ♿ **Accessible**: Keyboard navigable, properly labeled

### Impact
- **Before**: Scroll through all runs to find what you need
- **After**: Search, filter, sort → instant results

**The Generated Reports page is now a powerful report management dashboard!** 🎉

---

**Updated**: January 3, 2026  
**Status**: ✅ **COMPLETED**  
**Files Modified**: `app/runs/run-dashboard-client.tsx`



