# Search, Filter, Sort - Quick Visual Guide

## 🎯 At a Glance

### The Control Panel

```
╔════════════════════════════════════════════════════════════════════╗
║  Search                    Status      Sort By        Order        ║
║  ┌─────────────────────┐  ┌───────┐  ┌──────────┐  ┌──────────┐  ║
║  │ Search by template, │  │ All ▼ │  │ Created▼ │  │ Newest ▼ │  ║
║  │ topic, or ID...     │  └───────┘  └──────────┘  └──────────┘  ║
║  └─────────────────────┘                                           ║
╚════════════════════════════════════════════════════════════════════╝
```

---

## 📊 Use Cases

### 1️⃣ Find a Specific Report
```
┌─────────────────────────────────────┐
│ Search: "renewable energy"          │
└─────────────────────────────────────┘
        ↓
Shows only reports mentioning "renewable energy"
```

### 2️⃣ Show Only Completed Reports
```
┌─────────┐
│ Status: │
│ ✓ COMPLETED │
└─────────┘
        ↓
Shows only finished reports ready for download
```

### 3️⃣ Sort by Most Recent
```
┌──────────┐  ┌────────────┐
│ Sort By: │  │ Order:     │
│ Created  │  │ Newest First │
└──────────┘  └────────────┘
        ↓
Latest reports appear at the top
```

### 4️⃣ Combine for Power Search
```
Search: "financial"  +  Status: COMPLETED  +  Sort: Created (Newest)
                              ↓
        Recent completed financial reports
```

---

## 🎨 Visual States

### Normal State
```
┌─────────────────────────────────────────────┐
│ 📊 AI-Powered Financial Insights            │
│ Topic: Renewable Energy Investment          │
│ [Download .md] [Download .pdf] [View]       │
└─────────────────────────────────────────────┘
```

### Filtered (3 of 10)
```
Showing 3 of 10 runs
        ↓
┌─────────────────────────────────────────────┐
│ 📊 Financial Report Template                │
│ Topic: Renewable Energy                     │
│ [Download .md] [Download .pdf] [View]       │
└─────────────────────────────────────────────┘
(only matching results shown)
```

### No Results
```
┌─────────────────────────────────────────────┐
│           🔍 No Matching Runs               │
│   Try adjusting your search or filters      │
│                                              │
│          [Clear Filters]                     │
└─────────────────────────────────────────────┘
```

---

## ⚡ Quick Actions

### Clear Everything
```
Click [Clear Filters] button
        ↓
Search: ""
Status: ALL
(Sort preferences preserved)
```

### Refresh Data
```
Click [🔄 Refresh Status]
        ↓
Fetches latest from server
Filters remain active
```

---

## 🎯 Filter Combinations Cheat Sheet

| Goal | Search | Status | Sort By | Order |
|------|--------|--------|---------|-------|
| **Latest reports** | — | ALL | Created | Newest |
| **Find failures** | — | FAILED | Created | Newest |
| **Topic research** | "climate" | ALL | Topic | Oldest |
| **Template audit** | — | ALL | Template | Oldest |
| **Download ready** | — | COMPLETED | Completed | Newest |
| **Monitor active** | — | RUNNING | Created | Newest |
| **Old drafts** | — | DRAFT | Created | Oldest |
| **Specific report** | "03c98021" | ALL | Created | Newest |

---

## 📱 Responsive Layout

### Desktop (Wide)
```
[Search.....................] [Status▼] [Sort▼] [Order▼]
                  ↓
      All controls in one row
```

### Tablet (Medium)
```
[Search.....................] [Status▼]
[Sort▼]                       [Order▼]
                  ↓
         2x2 grid layout
```

### Mobile (Narrow)
```
[Search...................]
[Status▼]
[Sort▼]
[Order▼]
                  ↓
      Single column stack
```

---

## 🎨 Color Coding

### Status Badges
```
DRAFT      → Blue
QUEUED     → Yellow
RUNNING    → Orange
COMPLETED  → Green
FAILED     → Red
```

### Results Counter
```
Showing 10 of 10 runs  → Normal (gray)
Showing 3 of 10 runs   → Filtered (accent color)
Showing 0 of 10 runs   → No results (empty state)
```

---

## ⌨️ Interaction Flow

```
1. User opens "Generated Reports" tab
        ↓
2. Sees all runs (default: newest first)
        ↓
3. Types in search box
        ↓
4. Results filter in real-time
        ↓
5. Adjusts status filter
        ↓
6. Results update immediately
        ↓
7. Changes sort order
        ↓
8. List reorders
        ↓
9. Clicks "Download .md" on desired run
        ↓
10. File downloads ✅
```

---

## 💡 Pro Tips

### Tip 1: Narrow Then Sort
```
1. Filter by status first
2. Then sort by what matters
→ Faster to find what you need
```

### Tip 2: Search by ID Fragment
```
Search: "03c98"
→ Unique enough to find specific run
→ Don't need full UUID
```

### Tip 3: Monitor Active Jobs
```
Status: RUNNING
Auto-refresh: ON
→ Watch progress in real-time
```

### Tip 4: Clean Up Drafts
```
Status: DRAFT
Sort: Created (Oldest First)
→ Find abandoned drafts to delete
```

### Tip 5: Review Failures
```
Status: FAILED
Sort: Created (Newest First)
→ Most recent issues first
```

---

## 🎯 Before vs After

### Before (No Filters)
```
Problem: 50 reports, all in one long list
Action: Scroll... scroll... scroll...
Time: 2-3 minutes to find what you need
```

### After (With Filters)
```
Problem: 50 reports, need to find "renewable energy" completed ones
Action: 
  1. Type "renewable" → 8 results
  2. Select "COMPLETED" → 3 results
  3. Click "Download .md" → Done!
Time: 10 seconds ✅
```

---

## 🎉 Summary

**3 Core Features**:
1. 🔍 **Search** → Find by name, topic, or ID
2. 🎛️ **Filter** → Show only specific statuses
3. 📊 **Sort** → Order by date, template, or topic

**Result**: Transform from scrolling through lists to **instant targeted access**!

---

**The Generated Reports page is now a powerful dashboard!** 🚀

