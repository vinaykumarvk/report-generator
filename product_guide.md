# Product Guide

## Overview
Report Generator is a workflow tool for creating report templates, generating report runs, and downloading outputs. It supports template-driven report creation, configurable sources, and run monitoring.

## Primary Workflow
1. Create or edit a template in Reports Studio.
2. Configure sources (vector stores and/or web search).
3. Define sections with length, writing style, and optional per-section source overrides.
4. Start a run from the Generate Reports page.
5. Monitor run status and download outputs.

## Reports Studio
Reports Studio is the template authoring area. It provides:
- Template list with search and quick actions.
- Create new template form with Objectives, Sources, Sections.
- Edit existing templates with inline editing and save/save-as options.
- Section management (add, delete, reorder).

### Create a Template
1. Click `+ New Report`.
2. Fill in Objectives: name, description, audience, tone, domain, jurisdiction, formats.
3. Choose Sources:
   - Vector stores (select up to the allowed limit).
   - Web search (toggle on/off).
4. Add Sections:
   - Title and purpose.
   - Min/max words and source mode.
   - Writing style.
5. Click `Create Report Template`.

### Edit a Template
1. Select a template and click the edit icon.
2. Update Objectives, Sources, and Sections as needed.
3. Use section controls to add, delete, or reorder sections.
4. Click `Save` to update the template, or `Save As` to create a new copy.

### Section Management
- Add Section: creates a new section with default values.
- Delete Section: removes the section.
- Reorder Sections: use up/down controls to adjust sequence.

## Generate Reports (Runs)
Runs are report instances created from a template.

### Create a Run
1. Open `Generate Reports`.
2. Select a template.
3. Enter the topic and any run variables JSON.
4. Optionally override sources per section.
5. Start the run.

### View and Refresh Runs
- Generated reports list displays run status and timestamps.
- Use `Refresh Status` to fetch the latest status.
- Open a run to view details and progress.

## Download Outputs
- Download outputs from the run list or run details page.
- Available formats: Markdown and PDF.

## Status and Troubleshooting
- Long-running runs may be waiting on external model requests.
- Use `Refresh Status` to update run status.
- If runs remain stuck, inspect worker logs for timeouts or errors.

## Light and Dark Modes
- Use the theme toggle to switch modes.
- Pages are styled to support both light and dark themes.

## Quick Tips
- Keep sections concise and well-scoped for best generation quality.
- Use writing styles to standardize tone and structure.
- If source data is missing, confirm connectors are configured.

