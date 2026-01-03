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
 * Create a signature for a block (type + content) for comparison
 */
function getBlockSignature(block) {
  return `${block.type}:${getBlockText(block)}`;
}

/**
 * Compute LCS (Longest Common Subsequence) of two arrays using signatures.
 * Returns array of [origIdx, currIdx] pairs for matched elements.
 */
function computeLCS(original, current) {
  const m = original.length;
  const n = current.length;

  // Build DP table
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (getBlockSignature(original[i - 1]) === getBlockSignature(current[j - 1])) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matched pairs
  const matches = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (getBlockSignature(original[i - 1]) === getBlockSignature(current[j - 1])) {
      matches.unshift([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return matches;
}

/**
 * Compare original and current block arrays using LCS-based matching.
 * Handles insertions, deletions, and modifications correctly.
 */
export function computeBlockDiffs(originalBlocks, currentBlocks) {
  if (!originalBlocks || !currentBlocks) return [];

  const diffs = [];

  // First try ID-based matching for blocks that kept their IDs
  const originalById = new Map(originalBlocks.map((b, idx) => [b.id, { block: b, idx }]));
  const currentById = new Map(currentBlocks.map((b, idx) => [b.id, { block: b, idx }]));

  const matchedOriginal = new Set();
  const matchedCurrent = new Set();

  // Pass 1: Match by ID (exact matches from same session)
  for (const [id, { block: curr, idx: currIdx }] of currentById) {
    const orig = originalById.get(id);
    if (orig) {
      matchedOriginal.add(orig.idx);
      matchedCurrent.add(currIdx);

      const originalText = getBlockText(orig.block);
      const currentText = getBlockText(curr);

      if (originalText === currentText && orig.block.type === curr.type) {
        diffs.push({ type: 'unchanged', blockId: id, position: currIdx });
      } else {
        diffs.push({ type: 'modified', blockId: id, originalText, currentText, position: currIdx });
      }
    }
  }

  // Pass 2: For unmatched blocks, use LCS on content signatures
  const unmatchedOriginal = originalBlocks
    .map((b, i) => ({ block: b, idx: i }))
    .filter(({ idx }) => !matchedOriginal.has(idx));
  const unmatchedCurrent = currentBlocks
    .map((b, i) => ({ block: b, idx: i }))
    .filter(({ idx }) => !matchedCurrent.has(idx));

  if (unmatchedOriginal.length > 0 && unmatchedCurrent.length > 0) {
    const lcsMatches = computeLCS(
      unmatchedOriginal.map(x => x.block),
      unmatchedCurrent.map(x => x.block)
    );

    const lcsMatchedOrig = new Set();
    const lcsMatchedCurr = new Set();

    for (const [origLocalIdx, currLocalIdx] of lcsMatches) {
      const orig = unmatchedOriginal[origLocalIdx];
      const curr = unmatchedCurrent[currLocalIdx];

      lcsMatchedOrig.add(origLocalIdx);
      lcsMatchedCurr.add(currLocalIdx);
      matchedOriginal.add(orig.idx);
      matchedCurrent.add(curr.idx);

      // LCS matches have same signature, so they're unchanged
      diffs.push({ type: 'unchanged', blockId: curr.block.id, position: curr.idx });
    }

    // Remaining unmatched current blocks are added
    for (let i = 0; i < unmatchedCurrent.length; i++) {
      if (!lcsMatchedCurr.has(i)) {
        const curr = unmatchedCurrent[i];
        diffs.push({
          type: 'added',
          blockId: curr.block.id,
          currentText: getBlockText(curr.block),
          position: curr.idx,
        });
      }
    }
  } else {
    // No LCS needed - just mark remaining as added
    for (const { block, idx } of unmatchedCurrent) {
      diffs.push({
        type: 'added',
        blockId: block.id,
        currentText: getBlockText(block),
        position: idx,
      });
    }
  }

  // Pass 3: Find deleted blocks and determine where to render them
  for (let i = 0; i < originalBlocks.length; i++) {
    if (!matchedOriginal.has(i)) {
      const deleted = originalBlocks[i];

      // Find the next matched original block to determine insertion point
      let afterBlockId = null;
      for (let j = i - 1; j >= 0; j--) {
        if (matchedOriginal.has(j)) {
          // Find which current block this original matched to
          const origBlock = originalBlocks[j];
          const currMatch = currentBlocks.find(c =>
            c.id === origBlock.id || getBlockSignature(c) === getBlockSignature(origBlock)
          );
          if (currMatch) {
            afterBlockId = currMatch.id;
            break;
          }
        }
      }

      diffs.push({
        type: 'deleted',
        blockId: deleted.id,
        originalText: getBlockText(deleted),
        originalType: deleted.type,
        position: i,
        afterBlockId, // null means insert at start
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
