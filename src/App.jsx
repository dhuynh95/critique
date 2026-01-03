import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import ImportZone from './components/ImportZone';
import Editor from './components/Editor';
import TopBar from './components/TopBar';
import { useSuggestMode } from './hooks/useSuggestMode';
import { DiffHighlightExtension } from './extensions/DiffHighlightExtension';

export default function App() {
  const [activeFile, setActiveFile] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveTimeoutRef = useRef(null);
  const pendingLoadedRef = useRef(false);

  // Memoize editor options to prevent recreation
  const editorOptions = useMemo(() => ({
    _tiptapOptions: {
      extensions: [DiffHighlightExtension],
    },
  }), []);

  const editor = useCreateBlockNote(editorOptions);
  const normalizerEditor = useCreateBlockNote();

  const {
    mode,
    toggleMode,
    acceptAll,
    rejectAll,
    addComment,
    copyDiffToClipboard,
    hasSuggestions,
    enterSuggestMode,
    exitSuggestMode,
    savePendingChanges,
    pendingMarkdown,
    blockDiffs,
  } = useSuggestMode(activeFile, editor);

  // Save to server
  const saveToServer = useCallback(async () => {
    if (!activeFile || !editor) return;
    try {
      const markdown = await editor.blocksToMarkdownLossy(editor.document);
      await fetch(`/api/files/${encodeURIComponent(activeFile)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: markdown,
      });
    } catch (e) {
      console.error('Save failed:', e);
    }
  }, [activeFile, editor]);

  // Debounced save on change - mode aware
  const handleEditorChange = useCallback(async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (mode === 'edit') {
      // Edit mode: save to .md file
      saveTimeoutRef.current = setTimeout(saveToServer, 500);
    } else {
      // Suggest mode: save to .comments.json only (pending changes)
      saveTimeoutRef.current = setTimeout(async () => {
        if (!editor) return;
        const markdown = await editor.blocksToMarkdownLossy(editor.document);
        savePendingChanges(markdown);
      }, 500);
    }
  }, [mode, saveToServer, editor, savePendingChanges]);

  // Load file content into editor
  const loadContent = useCallback(async (markdown) => {
    if (!editor) return;
    const blocks = await editor.tryParseMarkdownToBlocks(markdown);
    editor.replaceBlocks(editor.document, blocks);
  }, [editor]);

  // Handle import (from ImportZone or URL param)
  const handleImport = useCallback(async (rawMarkdown, filename) => {
    if (!normalizerEditor) return;
    const blocks = await normalizerEditor.tryParseMarkdownToBlocks(rawMarkdown);
    const normalized = await normalizerEditor.blocksToMarkdownLossy(blocks);
    setOriginal(normalized);
    setActiveFile(filename);
    await loadContent(normalized);
    setError(null);
  }, [normalizerEditor, loadContent]);

  // Handle mode change
  const handleModeChange = useCallback((newMode) => {
    if (newMode === 'suggest' && mode === 'edit') {
      enterSuggestMode();
    } else if (newMode === 'edit' && mode === 'suggest') {
      exitSuggestMode();
    }
  }, [mode, enterSuggestMode, exitSuggestMode]);

  // URL param loading on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file');

    if (filename && normalizerEditor) {
      setLoading(true);
      fetch(`/api/files/${encodeURIComponent(filename)}`)
        .then(res => {
          if (!res.ok) throw new Error('File not found');
          return res.text();
        })
        .then(content => handleImport(content, filename))
        .catch(err => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [normalizerEditor, handleImport]);

  // Load pending markdown into editor on refresh (if in suggest mode) - only once
  useEffect(() => {
    if (pendingMarkdown && editor && original !== null && !pendingLoadedRef.current) {
      pendingLoadedRef.current = true;
      loadContent(pendingMarkdown);
    }
  }, [pendingMarkdown, editor, original, loadContent]);

  if (loading) {
    return (
      <div className="app loading-state">
        <span className="loading-text">Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error-state">
        <span className="error-text">{error}</span>
        <button className="error-button" onClick={() => setError(null)}>
          Upload manually
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      {original === null ? (
        <ImportZone />
      ) : (
        <>
          <TopBar
            filename={activeFile}
            mode={mode}
            onModeChange={handleModeChange}
            onCopyDiff={copyDiffToClipboard}
            onAcceptAll={acceptAll}
            onRejectAll={rejectAll}
            hasSuggestions={hasSuggestions}
          />
          <Editor
            editor={editor}
            onChange={handleEditorChange}
            mode={mode}
            onAddComment={addComment}
            onCopyDiff={copyDiffToClipboard}
            blockDiffs={blockDiffs}
          />
        </>
      )}
    </div>
  );
}
