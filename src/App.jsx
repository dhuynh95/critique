import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import ImportZone from './components/ImportZone';
import Editor from './components/Editor';

export default function App() {
  const [activeFile, setActiveFile] = useState(null);
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveTimeoutRef = useRef(null);

  const editor = useCreateBlockNote();
  const normalizerEditor = useCreateBlockNote();

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

  // Debounced save on change
  const handleEditorChange = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveToServer, 500);
  }, [saveToServer]);

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
        <Editor editor={editor} onChange={handleEditorChange} />
      )}
    </div>
  );
}
