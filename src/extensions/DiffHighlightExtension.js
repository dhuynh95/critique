import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { computeWordDiff } from '../utils/blockDiffUtils';

const diffHighlightKey = new PluginKey('diffHighlight');

/**
 * TipTap extension that renders inline diff decorations.
 *
 * Usage:
 * 1. Register with BlockNote editor
 * 2. Update storage.diffHighlight.blockDiffs with computed diffs
 * 3. Update storage.diffHighlight.enabled to toggle
 * 4. Dispatch transaction with setMeta('diffHighlight', true) to trigger redecoration
 */
export const DiffHighlightExtension = Extension.create({
  name: 'diffHighlight',

  addStorage() {
    return {
      blockDiffs: [],
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    const extension = this;

    return [
      new Plugin({
        key: diffHighlightKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, oldDecorations, oldState, newState) {
            // Rebuild decorations when triggered or on doc change
            const updateMeta = tr.getMeta('diffHighlight');
            const docChanged = tr.docChanged;

            if (!updateMeta && !docChanged) {
              return oldDecorations.map(tr.mapping, tr.doc);
            }

            const { blockDiffs, enabled } = extension.storage;

            if (!enabled || !blockDiffs || blockDiffs.length === 0) {
              return DecorationSet.empty;
            }

            return buildDecorations(newState.doc, blockDiffs);
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

/**
 * Build ProseMirror decorations from block diffs
 */
function buildDecorations(doc, blockDiffs) {
  const decorations = [];

  // Create a map of blockId -> diff for quick lookup
  const diffMap = new Map();
  for (const diff of blockDiffs) {
    if (diff.type === 'modified' || diff.type === 'added') {
      diffMap.set(diff.blockId, diff);
    }
  }

  // Walk the document and find blocks
  doc.descendants((node, pos) => {
    // BlockNote blocks have a blockId attribute
    const blockId = node.attrs?.id;
    if (!blockId) return;

    const diff = diffMap.get(blockId);
    if (!diff) return;

    if (diff.type === 'added') {
      // Highlight entire block as added
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'diff-block-added',
        })
      );
    } else if (diff.type === 'modified') {
      // Add block-level indicator
      decorations.push(
        Decoration.node(pos, pos + node.nodeSize, {
          class: 'diff-block-modified',
        })
      );

      // Add inline word-level decorations
      const wordDiffs = computeWordDiff(diff.originalText, diff.currentText);
      const inlineDecorations = buildInlineDecorations(node, pos, wordDiffs);
      decorations.push(...inlineDecorations);
    }
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Build inline decorations for word-level diff within a block
 */
function buildInlineDecorations(blockNode, blockPos, wordDiffs) {
  const decorations = [];

  // Find the text content node within the block
  let textPos = blockPos;
  let textNode = null;

  blockNode.descendants((node, relPos) => {
    if (node.isText && !textNode) {
      textNode = node;
      textPos = blockPos + relPos + 1; // +1 for block node opening
    }
  });

  if (!textNode) return decorations;

  // Map word diffs to positions in current text
  // Note: We can only decorate text that exists in the current document
  // Deleted text will be shown via a different mechanism (inline widget) in Phase 2
  // For now, we highlight insertions in the current text

  const currentText = textNode.text || '';
  let currentPos = textPos;
  let currentTextIndex = 0;

  for (const part of wordDiffs) {
    if (part.type === 'equal') {
      // Move position forward
      currentPos += part.value.length;
      currentTextIndex += part.value.length;
    } else if (part.type === 'insert') {
      // Find this text in current document and highlight it
      const insertStart = currentText.indexOf(part.value, currentTextIndex);
      if (insertStart !== -1 && insertStart === currentTextIndex) {
        const from = textPos + insertStart;
        const to = from + part.value.length;
        decorations.push(
          Decoration.inline(from, to, { class: 'diff-insert' })
        );
        currentPos += part.value.length;
        currentTextIndex += part.value.length;
      }
    }
    // 'delete' parts don't exist in current document, skip for now
  }

  return decorations;
}

export default DiffHighlightExtension;
