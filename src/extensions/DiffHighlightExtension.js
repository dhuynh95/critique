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
 * Collect all text nodes within a block with their absolute positions
 */
function collectTextNodes(blockNode, blockPos) {
  const textNodes = [];
  blockNode.descendants((node, relPos) => {
    if (node.isText) {
      const from = blockPos + relPos + 1; // +1 for block node opening
      textNodes.push({
        node,
        from,
        to: from + node.text.length,
        text: node.text,
      });
    }
  });
  return textNodes;
}

/**
 * Create a DOM element for deleted text widget
 */
function createDeletedWidget(text) {
  const span = document.createElement('span');
  span.className = 'diff-delete';
  span.textContent = text;
  return span;
}

/**
 * Find document position for a given index in joined text
 */
function findDocPosition(textNodes, textIndex) {
  let cumulative = 0;
  for (const tn of textNodes) {
    const nodeLen = tn.text.length;
    if (textIndex <= cumulative + nodeLen) {
      return tn.from + (textIndex - cumulative);
    }
    cumulative += nodeLen;
  }
  // Past end - return end of last node
  if (textNodes.length > 0) {
    const last = textNodes[textNodes.length - 1];
    return last.to;
  }
  return 0;
}

/**
 * Build inline decorations for word-level diff within a block
 */
function buildInlineDecorations(blockNode, blockPos, wordDiffs) {
  const decorations = [];
  const textNodes = collectTextNodes(blockNode, blockPos);

  if (textNodes.length === 0) return decorations;

  // Join all text for position mapping
  const joinedText = textNodes.map(tn => tn.text).join('');
  let diffIndex = 0; // Position in current document's joined text

  for (const part of wordDiffs) {
    if (part.type === 'equal') {
      diffIndex += part.value.length;
    } else if (part.type === 'insert') {
      // Create inline decoration(s) spanning potentially multiple nodes
      const startIdx = diffIndex;
      const endIdx = diffIndex + part.value.length;

      // Find all nodes that overlap with [startIdx, endIdx]
      let cumulative = 0;
      for (const tn of textNodes) {
        const nodeStart = cumulative;
        const nodeEnd = cumulative + tn.text.length;

        // Check if this node overlaps with our range
        if (nodeEnd > startIdx && nodeStart < endIdx) {
          const decoStart = Math.max(startIdx, nodeStart);
          const decoEnd = Math.min(endIdx, nodeEnd);
          const from = tn.from + (decoStart - nodeStart);
          const to = tn.from + (decoEnd - nodeStart);

          if (from < to) {
            decorations.push(
              Decoration.inline(from, to, { class: 'diff-insert' })
            );
          }
        }
        cumulative += tn.text.length;
      }
      diffIndex += part.value.length;
    } else if (part.type === 'delete') {
      // Insert widget at current position showing deleted text
      const docPos = findDocPosition(textNodes, diffIndex);
      decorations.push(
        Decoration.widget(docPos, createDeletedWidget(part.value), { side: -1 })
      );
      // Don't advance diffIndex - deleted text doesn't exist in current doc
    }
  }

  return decorations;
}

export default DiffHighlightExtension;
