import { useState, useCallback, useEffect, useRef } from 'react';
import { formatDiffForClipboard, hasChanges, getChangeSummary } from '../utils/diffUtils';

/**
 * Hook to manage suggest mode state and annotations
 */
export function useSuggestMode(filename, editor) {
  const [mode, setMode] = useState('edit');
  const [originalMarkdown, setOriginalMarkdown] = useState(null);
  const [pendingMarkdown, setPendingMarkdown] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Load annotations when filename changes
  useEffect(() => {
    if (!filename) {
      setOriginalMarkdown(null);
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
        setPendingMarkdown(data.suggestModePending || null);
        setMode(data.suggestModeOriginal ? 'suggest' : 'edit');
      })
      .catch(() => {
        setComments([]);
        setOriginalMarkdown(null);
        setPendingMarkdown(null);
        setMode('edit');
      })
      .finally(() => setLoading(false));
  }, [filename]);

  // Save annotations (debounced)
  const saveAnnotations = useCallback(async (newComments, newOriginal, newPending) => {
    if (!filename) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await fetch(`/api/files/${encodeURIComponent(filename)}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: newComments,
          suggestModeOriginal: newOriginal,
          suggestModePending: newPending,
        }),
      });
    }, 300);
  }, [filename]);

  // Enter suggest mode - snapshot current markdown as original and pending
  const enterSuggestMode = useCallback(async () => {
    if (!editor) return;
    const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    setOriginalMarkdown(currentMarkdown);
    setPendingMarkdown(currentMarkdown);
    setMode('suggest');
    saveAnnotations(comments, currentMarkdown, currentMarkdown);
  }, [editor, comments, saveAnnotations]);

  // Exit suggest mode (back to edit, keeps changes but they're not saved to file yet)
  const exitSuggestMode = useCallback(() => {
    setOriginalMarkdown(null);
    setPendingMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null, null);
  }, [comments, saveAnnotations]);

  // Save pending changes (called on each edit in suggest mode)
  const savePendingChanges = useCallback((markdown) => {
    setPendingMarkdown(markdown);
    saveAnnotations(comments, originalMarkdown, markdown);
  }, [comments, originalMarkdown, saveAnnotations]);

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
    setPendingMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null, null);
  }, [filename, pendingMarkdown, comments, saveAnnotations]);

  // Reject all suggestions - restore original to editor, clear state (file unchanged)
  const rejectAll = useCallback(async () => {
    if (!editor || !originalMarkdown) return;
    const blocks = await editor.tryParseMarkdownToBlocks(originalMarkdown);
    editor.replaceBlocks(editor.document, blocks);
    setOriginalMarkdown(null);
    setPendingMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null, null);
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
    saveAnnotations(newComments, originalMarkdown, pendingMarkdown);
  }, [comments, originalMarkdown, pendingMarkdown, saveAnnotations]);

  // Remove comment
  const removeComment = useCallback((id) => {
    const newComments = comments.filter(c => c.id !== id);
    setComments(newComments);
    saveAnnotations(newComments, originalMarkdown, pendingMarkdown);
  }, [comments, originalMarkdown, pendingMarkdown, saveAnnotations]);

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
