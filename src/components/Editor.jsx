import React from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';

export default function Editor({ editor, onChange }) {
  return (
    <div className="editor-container">
      <BlockNoteView
        editor={editor}
        theme="dark"
        onChange={onChange}
      />
    </div>
  );
}
