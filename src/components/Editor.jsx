import React, { useEffect, useCallback } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

export default function Editor({ editor, onChange, mode, onAddComment }) {
  // Handle Cmd+Shift+M for adding comments
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'm') {
        e.preventDefault();
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const selectedText = selection.toString().trim();
        if (!selectedText) return;

        const comment = prompt('Add comment:');
        if (comment && onAddComment) {
          // Get the block ID from selection - simplified approach
          const blockEl = selection.anchorNode?.parentElement?.closest('[data-block-id]');
          const blockId = blockEl?.getAttribute('data-block-id') || 'unknown';
          onAddComment(blockId, selectedText, comment);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onAddComment]);

  return (
    <div className={`editor-container ${mode === 'suggest' ? 'editor-suggest-mode' : ''}`}>
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={onChange}
      />
    </div>
  );
}
