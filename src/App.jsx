import React, { useState, useCallback, useEffect } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import ImportZone from './components/ImportZone';
import Editor from './components/Editor';

export default function App() {
  const [original, setOriginal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const normalizerEditor = useCreateBlockNote();

  const handleImport = useCallback(async (rawMarkdown) => {
    const blocks = await normalizerEditor.tryParseMarkdownToBlocks(rawMarkdown);
    const normalized = await normalizerEditor.blocksToMarkdownLossy(blocks);
    setOriginal(normalized);
    setError(null);
  }, [normalizerEditor]);

  // Check URL for ?file= param on mount
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
        .then(handleImport)
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
        <ImportZone onImport={handleImport} />
      ) : (
        <Editor initialMarkdown={original} />
      )}
    </div>
  );
}
