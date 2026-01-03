import { useState, useCallback, useEffect, useRef } from 'react';
import { formatDiffForClipboard, hasChanges, getChangeSummary } from '../utils/diffUtils';

/**
 * Hook to manage suggest mode state and annotations
 */
export function useSuggestMode(filename, editor) {
  const [mode, setMode] = useState('edit');
  const [originalMarkdown, setOriginalMarkdown] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Load annotations when filename changes
  useEffect(() => {
    if (!filename) {
      setOriginalMarkdown(null);
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
        setMode(data.suggestModeOriginal ? 'suggest' : 'edit');
      })
      .catch(() => {
        setComments([]);
        setOriginalMarkdown(null);
        setMode('edit');
      })
      .finally(() => setLoading(false));
  }, [filename]);

  // Save annotations (debounced)
  const saveAnnotations = useCallback(async (newComments, newOriginal) => {
    if (!filename) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      await fetch(`/api/files/${encodeURIComponent(filename)}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comments: newComments,
          suggestModeOriginal: newOriginal,
        }),
      });
    }, 300);
  }, [filename]);

  // Enter suggest mode - snapshot current markdown as original
  const enterSuggestMode = useCallback(async () => {
    if (!editor) return;
    const currentMarkdown = await editor.blocksToMarkdownLossy(editor.document);
    setOriginalMarkdown(currentMarkdown);
    setMode('suggest');
    saveAnnotations(comments, currentMarkdown);
  }, [editor, comments, saveAnnotations]);

  // Exit suggest mode (back to edit, keeps changes)
  const exitSuggestMode = useCallback(() => {
    setOriginalMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null);
  }, [comments, saveAnnotations]);

  // Accept all suggestions - clear original, keep current
  const acceptAll = useCallback(() => {
    setOriginalMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null);
  }, [comments, saveAnnotations]);

  // Reject all suggestions - restore original
  const rejectAll = useCallback(async () => {
    if (!editor || !originalMarkdown) return;
    const blocks = await editor.tryParseMarkdownToBlocks(originalMarkdown);
    editor.replaceBlocks(editor.document, blocks);
    setOriginalMarkdown(null);
    setMode('edit');
    saveAnnotations(comments, null);
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
    saveAnnotations(newComments, originalMarkdown);
  }, [comments, originalMarkdown, saveAnnotations]);

  // Remove comment
  const removeComment = useCallback((id) => {
    const newComments = comments.filter(c => c.id !== id);
    setComments(newComments);
    saveAnnotations(newComments, originalMarkdown);
  }, [comments, originalMarkdown, saveAnnotations]);

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
    comments,
    loading,
    toggleMode,
    enterSuggestMode,
    exitSuggestMode,
    acceptAll,
    rejectAll,
    addComment,
    removeComment,
    copyDiffToClipboard,
    getChanges,
    hasSuggestions: !!originalMarkdown,
  };
}
