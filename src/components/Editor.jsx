import React, { useMemo } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import '@blocknote/mantine/style.css';

export default function Editor({ initialMarkdown }) {
  const editor = useCreateBlockNote({
    initialContent: undefined,
  });

  // Parse markdown on mount
  useMemo(() => {
    if (initialMarkdown && editor) {
      const parseMarkdown = async () => {
        const blocks = await editor.tryParseMarkdownToBlocks(initialMarkdown);
        editor.replaceBlocks(editor.document, blocks);
      };
      parseMarkdown();
    }
  }, [initialMarkdown, editor]);

  return (
    <div className="editor-container">
      <BlockNoteView
        editor={editor}
        theme="dark"
        data-theming-css-variables-demo
      />
    </div>
  );
}
