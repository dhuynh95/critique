import * as Diff from 'diff';

/**
 * Compute line-level diff between original and current markdown
 * @returns {Array<{type: 'unchanged'|'added'|'removed', value: string}>}
 */
export function computeDiff(original, current) {
  if (!original) return [];
  return Diff.diffLines(original, current, { newlineIsToken: true });
}

/**
 * Compute word-level diff for detailed view
 * @returns {Array<{type: 'unchanged'|'added'|'removed', value: string}>}
 */
export function computeWordDiff(original, current) {
  return Diff.diffWords(original, current);
}

/**
 * Check if there are any changes between original and current
 */
export function hasChanges(original, current) {
  if (!original) return false;
  return original !== current;
}

/**
 * Format diff as git-style unified diff for clipboard
 */
export function formatDiffForClipboard(original, current, comments = []) {
  if (!original) return '';

  const diff = Diff.createPatch('document', original, current, '', '');

  // Append comments section if any
  let output = diff;
  if (comments.length > 0) {
    output += '\n\n# Comments\n';
    comments.forEach((c, i) => {
      output += `\n## Comment ${i + 1}\n`;
      output += `> "${c.originalText}"\n\n`;
      output += `${c.comment}\n`;
    });
  }

  return output;
}

/**
 * Get change summary for UI display
 * @returns {{ additions: number, deletions: number, modified: boolean }}
 */
export function getChangeSummary(original, current) {
  if (!original) return { additions: 0, deletions: 0, modified: false };

  const diff = computeDiff(original, current);
  let additions = 0;
  let deletions = 0;

  diff.forEach(part => {
    if (part.added) {
      additions += part.value.split('\n').filter(l => l).length;
    } else if (part.removed) {
      deletions += part.value.split('\n').filter(l => l).length;
    }
  });

  return { additions, deletions, modified: additions > 0 || deletions > 0 };
}
