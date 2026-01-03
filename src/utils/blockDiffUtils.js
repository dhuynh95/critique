import * as Diff from 'diff';

/**
 * Extract plain text content from a BlockNote block (recursive for nested content)
 */
export function getBlockText(block) {
  if (!block) return '';

  // Handle inline content array
  if (block.content && Array.isArray(block.content)) {
    return block.content
      .map(item => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text || '';
        if (item.text) return item.text;
        return '';
      })
      .join('');
  }

  // Handle direct text property
  if (block.text) return block.text;

  return '';
}

/**
 * Compare original and current block arrays, return diff list.
 * Matches blocks by ID first, then by position+type as fallback.
 */
export function computeBlockDiffs(originalBlocks, currentBlocks) {
  if (!originalBlocks || !currentBlocks) return [];

  const diffs = [];
  const originalById = new Map(originalBlocks.map(b => [b.id, b]));
  const matchedOriginalIndices = new Set();

  // Process current blocks
  for (let i = 0; i < currentBlocks.length; i++) {
    const current = currentBlocks[i];
    let original = originalById.get(current.id);
    let matchedOriginalIdx = -1;

    // Try ID match first
    if (original) {
      matchedOriginalIdx = originalBlocks.findIndex(b => b.id === current.id);
    } else {
      // Fallback: match by position + type
      // Look for an unmatched original at same position with same type
      if (i < originalBlocks.length &&
          !matchedOriginalIndices.has(i) &&
          originalBlocks[i].type === current.type) {
        original = originalBlocks[i];
        matchedOriginalIdx = i;
      }
    }

    if (original && matchedOriginalIdx >= 0) {
      matchedOriginalIndices.add(matchedOriginalIdx);
      const originalText = getBlockText(original);
      const currentText = getBlockText(current);

      if (originalText === currentText) {
        diffs.push({
          type: 'unchanged',
          blockId: current.id,
          position: i,
        });
      } else {
        diffs.push({
          type: 'modified',
          blockId: current.id,
          originalText,
          currentText,
          position: i,
        });
      }
    } else {
      // Block only in current - added
      diffs.push({
        type: 'added',
        blockId: current.id,
        currentText: getBlockText(current),
        position: i,
      });
    }
  }

  // Find deleted blocks (in original but not matched)
  for (let i = 0; i < originalBlocks.length; i++) {
    if (!matchedOriginalIndices.has(i)) {
      diffs.push({
        type: 'deleted',
        blockId: originalBlocks[i].id,
        originalText: getBlockText(originalBlocks[i]),
        position: -1,
      });
    }
  }

  return diffs;
}

/**
 * Word-level diff for inline rendering within a modified block.
 * Returns array of {type: 'equal'|'insert'|'delete', value: string}
 */
export function computeWordDiff(originalText, currentText) {
  if (!originalText && !currentText) return [];
  if (!originalText) return [{ type: 'insert', value: currentText }];
  if (!currentText) return [{ type: 'delete', value: originalText }];

  const changes = Diff.diffWords(originalText, currentText);

  return changes.map(part => ({
    type: part.added ? 'insert' : part.removed ? 'delete' : 'equal',
    value: part.value,
  }));
}

/**
 * Check if there are any actual changes in the block diffs
 */
export function hasBlockChanges(blockDiffs) {
  return blockDiffs.some(d => d.type !== 'unchanged');
}
