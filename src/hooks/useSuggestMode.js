import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { formatDiffForClipboard, hasChanges, getChangeSummary } from '../utils/diffUtils';
import { computeBlockDiffs } from '../utils/blockDiffUtils';

/**
 * Hook to manage suggest mode state and annotations
 */
export function useSuggestMode(filename, editor) {
  const [mode, setMode] = useState('edit');
  const [originalMarkdown, setOriginalMarkdown] = useState(null);
  const [originalBlocks, setOriginalBlocks] = useState(null);
  const [pendingMarkdown, setPendingMarkdown] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const saveTimeoutRef = useRef(null);

  // State to track document changes and trigger re-computation
  const [docVersion, setDocVersion] = useState(0);

  // Compute block diffs when in suggest mode
  const blockDiffs = useMemo(() => {
    if (!originalBlocks || !editor?.document) return [];
    return computeBlockDiffs(originalBlocks, editor.document);
  }, [originalBlocks, editor, docVersion]); // docVersion triggers recompute

  // Increment doc version when document changes (called from savePendingChanges)
  const incrementDocVersion = useCallback(() => {
    setDocVersion(v => v + 1);
  }, []);

  // Load annotations when filename changes
  useEffect(() => {
    if (!filename) {
      setOriginalMarkdown(null);
      setOriginalBlocks(null);
      setPendingMarkdown(null);
      setComments([]);
      setMode('edit');
      return;
    }

    setLoading(true);
    fetch(`/api/files/${encodeURIComponent(filename)}/annotations`)
      .then(res => res.json())
      .then(data => {
        setComments(data.comments || []);
        setOriginalMarkdown(data.suggestModeOriginal || null);
        setOriginalBlocks(data.suggestModeOriginalBlocks || null);
        setPendingMarkdown(data.suggestModePending || null);
        setMode(data.suggestModeOriginal ? 'suggest' : 'edit');
        if (data.suggestModeOriginalBlocks) {
          setDocVersion(v => v + 1); // Trigger initial diff computation
        }
      })
      .catch(() => {
        setComments([]);
        setOriginalMarkdown(null);
        setOriginalBlocks(null);
        setPendingMarkdown(null);
        setMode('edit');
      })
      .finally(() => setLoading(false));
  }, [filename]);

  // Save annotations (debounced)
  const saveAnnotations = useCallback(async (newComments, newOriginal, newOriginalBlocks, newPending) => {
    if (!filename) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await fetch(`/api/files/${encodeURIComponent(filename)}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: newComments,
          suggestModeOriginal: newOriginal,
          suggestModeOriginalBlocks: newOriginalBlocks,
          suggestModePending: newPending,
        }),
      });
    }, 300);
  }, [filename]);

  // Enter suggest mode - snapshot current markdown and blocks as original
  const enterSuggestMode = useCallback(async () => {
    if (!editor) return;
    const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    const currentBlocks = JSON.parse(JSON.stringify(editor.document)); // Deep clone
    setOriginalMarkdown(currentMarkdown);
    setOriginalBlocks(currentBlocks);
    setPendingMarkdown(currentMarkdown);
    setMode('suggest');
    saveAnnotations(comments, currentMarkdown, currentBlocks, currentMarkdown);
  }, [editor, comments, saveAnnotations]);

  // Exit suggest mode (back to edit, keeps changes but they're not saved to file yet)
  const exitSuggestMode = useCallback(() => {
    setOriginalMarkdown(null);
    setOriginalBlocks(null);
    setPendingMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null, null, null);
  }, [comments, saveAnnotations]);

  // Save pending changes (called on each edit in suggest mode)
  const savePendingChanges = useCallback((markdown) => {
    setPendingMarkdown(markdown);
    incrementDocVersion(); // Trigger blockDiffs recomputation
    saveAnnotations(comments, originalMarkdown, originalBlocks, markdown);
  }, [comments, originalMarkdown, originalBlocks, saveAnnotations, incrementDocVersion]);

  // Accept all suggestions - save pending to file, clear state
  const acceptAll = useCallback(async () => {
    if (!filename || !pendingMarkdown) return;
    // Save pending content to the actual .md file
    await fetch(`/api/files/${encodeURIComponent(filename)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: pendingMarkdown,
    });
    setOriginalMarkdown(null);
    setOriginalBlocks(null);
    setPendingMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null, null, null);
  }, [filename, pendingMarkdown, comments, saveAnnotations]);

  // Reject all suggestions - restore original to editor, clear state (file unchanged)
  const rejectAll = useCallback(async () => {
    if (!editor || !originalMarkdown) return;
    const blocks = await editor.tryParseMarkdownToBlocks(originalMarkdown);
    editor.replaceBlocks(editor.document, blocks);
    setOriginalMarkdown(null);
    setOriginalBlocks(null);
    setPendingMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null, null, null);
  }, [editor, originalMarkdown, comments, saveAnnotations]);

  // Toggle mode
  const toggleMode = useCallback(() => {
    if (mode === 'edit') {
      enterSuggestMode();
    } else {
      exitSuggestMode();
    }
  }, [mode, enterSuggestMode, exitSuggestMode]);

  // Add comment
  const addComment = useCallback((blockId, originalText, comment) => {
    const newComment = {
      id: crypto.randomUUID(),
      blockId,
      originalText,
      comment,
      createdAt: Date.now(),
    };
    const newComments = [...comments, newComment];
    setComments(newComments);
    saveAnnotations(newComments, originalMarkdown, originalBlocks, pendingMarkdown);
  }, [comments, originalMarkdown, originalBlocks, pendingMarkdown, saveAnnotations]);

  // Remove comment
  const removeComment = useCallback((id) => {
    const newComments = comments.filter(c => c.id !== id);
    setComments(newComments);
    saveAnnotations(newComments, originalMarkdown, originalBlocks, pendingMarkdown);
  }, [comments, originalMarkdown, originalBlocks, pendingMarkdown, saveAnnotations]);

  // Copy diff to clipboard
  const copyDiffToClipboard = useCallback(async () => {
    if (!editor) return;
    const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    const diffText = formatDiffForClipboard(originalMarkdown, currentMarkdown, comments);
    await navigator.clipboard.writeText(diffText);
  }, [editor, originalMarkdown, comments]);

  // Get current change summary
  const getChanges = useCallback(async () => {
    if (!editor || !originalMarkdown) return { additions: 0, deletions: 0, modified: false };
    const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    return getChangeSummary(originalMarkdown, currentMarkdown);
  }, [editor, originalMarkdown]);

  return {
    mode,
    originalMarkdown,
    originalBlocks,
    blockDiffs,
    pendingMarkdown,
    comments,
    loading,
    toggleMode,
    enterSuggestMode,
    exitSuggestMode,
    acceptAll,
    rejectAll,
    addComment,
    removeComment,
    savePendingChanges,
    copyDiffToClipboard,
    getChanges,
    hasSuggestions: !!originalMarkdown,
  };
}
