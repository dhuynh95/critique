import React, { useEffect } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

export default function Editor({ editor, onChange, mode, onAddComment, onCopyDiff, blockDiffs }) {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
        if (e.key === 'm') {
          // Cmd+Shift+M: Add comment
          e.preventDefault();
          const selection = window.getSelection();
          if (!selection || selection.isCollapsed) return;

          const selectedText = selection.toString().trim();
          if (!selectedText) return;

          const comment = prompt('Add comment:');
          if (comment && onAddComment) {
            const blockEl = selection.anchorNode?.parentElement?.closest('[data-block-id]');
            const blockId = blockEl?.getAttribute('data-block-id') || 'unknown';
            onAddComment(blockId, selectedText, comment);
          }
        } else if (e.key === 'c' && onCopyDiff) {
          // Cmd+Shift+C: Copy diff
          e.preventDefault();
          onCopyDiff();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onAddComment, onCopyDiff]);

  // Update diff highlight extension when blockDiffs or mode changes
  useEffect(() => {
    if (!editor?._tiptapEditor) return;

    const storage = editor._tiptapEditor.storage.diffHighlight;
    if (!storage) return;

    storage.blockDiffs = blockDiffs || [];
    storage.enabled = mode === 'suggest';

    // Trigger re-decoration
    editor._tiptapEditor.view.dispatch(
      editor._tiptapEditor.state.tr.setMeta('diffHighlight', true)
    );
  }, [editor, blockDiffs, mode]);

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
