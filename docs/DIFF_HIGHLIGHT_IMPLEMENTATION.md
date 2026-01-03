# Diff Highlight Implementation Notes

## What Was Implemented

Inline diff visualization for suggest mode, Google Docs style:

* Block-level indicators (gold left border on modified blocks)

* Inline word-level highlighting (teal underline on inserted text)

* TipTap/ProseMirror extension for decorations

### Files Created

* `src/utils/blockDiffUtils.js` - Block diff computation utilities

* `src/extensions/DiffHighlightExtension.js` - TipTap extension

### Files Modified

* `src/hooks/useSuggestMode.js` - Added originalBlocks state, blockDiffs computation

* `src/components/Editor.jsx` - Syncs diff data to extension storage

* `src/App.jsx` - Registers extension, passes blockDiffs

* `src/index.css` - Diff styling classes

***

## Issues Encountered During Development

### Issue 1: Block ID Mismatch After Page Reload ✅ RESOLVED

**Scenario:**

1. User enters suggest mode (blocks are snapshotted with their IDs)

2. User makes edits

3. User reloads the page

4. The pending markdown is loaded from annotations file

5. BlockNote parses the markdown, generating NEW block IDs

**Original Error:**

All blocks were classified as "added" instead of "modified" because the original block IDs did not match the current block IDs.

**Solution:**

Replaced position+type fallback with LCS (Longest Common Subsequence) algorithm:

1. First pass: Match blocks by ID (works within same session)

2. Second pass: For unmatched blocks, use LCS on content signatures (`type:text`)

3. LCS correctly handles insertions/deletions mid-document

**Implementation:** `computeBlockDiffs()` in `src/utils/blockDiffUtils.js:77-193`

***

### Issue 2: useMemo Not Recomputing blockDiffs

**Scenario:**

1. User is in suggest mode

2. User makes an edit to the document

3. The `blockDiffs` useMemo should recompute

**Error:**\
\
`editor.document` is a getter that returns the current state, but it's not a reactive value that triggers React's useMemo to recompute. The blockDiffs remained stale after edits.

**Observed behavior:**

* After page reload with position-based matching fix, still showed 0 modified blocks

* The decorations weren't being applied because blockDiffs was empty or stale

***

### Issue 3: Inline Word Diff Position Mapping

**Scenario:**

1. Block is identified as modified

2. `computeWordDiff` returns the correct diff chunks

3. Extension tries to apply inline decorations at specific character positions

**Error (partially addressed):**\
\
BlockNote's block structure is nested (block → content → text nodes). The `buildInlineDecorations` function needed to correctly traverse the ProseMirror document structure to find text node positions.

**Current state:**

* Works for simple paragraph and heading blocks

* May have edge cases with complex nested content (lists, code blocks with multiple lines)

***

### Issue 4: Deleted Text Not Shown Inline ✅ RESOLVED

**Scenario:**

1. User deletes some text from a paragraph in suggest mode

2. Expected: Deleted text shown with strikethrough inline

**Solution:**

* Used ProseMirror widget decorations to inject deleted text back into the view

* Added `collectTextNodes()` to handle blocks with multiple text nodes (formatted text)

* Added `createDeletedWidget()` to create strikethrough spans

* Added `findDocPosition()` to map text indices to document positions

**Status:** Implemented

***

### Issue 5: Deleted Blocks Not Visualized ✅ RESOLVED

**Scenario:**

1. User deletes an entire block (paragraph, heading, list item) in suggest mode

2. Expected: Deleted block shown with strikethrough styling

**Original Error:**

`buildDecorations()` only handled `modified` and `added` block types. Deleted blocks existed in `blockDiffs` with `type: 'deleted'` but were never rendered.

**Solution:**

* Added `createDeletedBlockWidget()` to create styled widget elements for deleted blocks

* Modified `buildDecorations()` to track block positions and insert deleted block widgets

* Added `afterBlockId` field to deleted diffs to determine widget placement

* Added CSS classes `.diff-block-deleted` and `.diff-block-deleted-content`

**Implementation:** `src/extensions/DiffHighlightExtension.js:68-156`, `src/index.css:445-461`

***

## Current Working State

The feature is functional with these capabilities:

* Modified blocks get gold left border

* Added blocks get teal left border

* Inserted text gets teal underline highlight

* **Deleted text shown inline with strikethrough** (red, dimmed)

* **Deleted blocks shown as red-bordered strikethrough widgets**

* Multi-text-node blocks supported (bold, italic, links)

* Updates live as user types

* Survives page reload (LCS-based content matching)

Limitations:

* No per-block accept/reject

* Complex nested blocks may have edge cases (code blocks with multiple lines)
