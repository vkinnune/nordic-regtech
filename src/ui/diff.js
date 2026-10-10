/* =====================================================================
   UI: Diff renderers and regulatory amendment badge helpers
   ===================================================================== */
import { esc } from '../core/utils.js';

const ICON_GIT_COMPARE =
  '<svg class="i" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/></svg>';

const ICON_PLUS_CIRCLE =
  '<svg class="i" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>';

const STATUS_CONFIG = {
  MODIFIED: { cls: 'badge-amber', label: 'Modified', title: 'Statutory modification' },
  ADDED: { cls: 'badge-emerald', label: 'Added', title: 'Newly added statutory provision' },
  REPEALED: { cls: 'badge-red', label: 'Repealed', title: 'Repealed provision' },
};

/**
 * Renders a word-level diff array into HTML with token classes.
 * @param {Array<[string, string]>} diff - Array of [op, text] tuples
 * @returns {string} HTML markup
 */
export function renderDiffHtml(diff) {
  if (!diff || !diff.length) return '';
  return diff
    .map(([op, text]) => {
      if (op === 'delete') {
        const words = text.replace(/\s+$/, '');
        const space = text.slice(words.length);
        return `<del class="diff-token-del">${esc(words)}</del>${esc(space)}`;
      }
      if (op === 'insert') {
        const words = text.replace(/\s+$/, '');
        const space = text.slice(words.length);
        return `<ins class="diff-token-ins">${esc(words)}</ins>${esc(space)}`;
      }
      return esc(text);
    })
    .join('');
}

/**
 * Formats a regulatory status badge (Modified, Added, Repealed).
 * @param {string} status - 'MODIFIED' | 'ADDED' | 'REPEALED'
 * @param {string|null} amendingAct - e.g. 'SFS 2026:784'
 * @param {string|null} amendedDate - e.g. '2026-12-05'
 * @returns {string} HTML badge markup
 */
export function changeBadgeHtml(status, amendingAct = null, amendedDate = null) {
  const cfg = STATUS_CONFIG[status];
  if (!cfg) return '';
  const actPart = amendingAct ? ` by ${esc(amendingAct)}` : '';
  const datePart = amendedDate ? `, in force ${esc(amendedDate)}` : '';
  return `<span class="finlex-tag-badge ${cfg.cls}" title="${cfg.title}">${cfg.label}${actPart}${datePart}</span>`;
}

/**
 * Renders an expandable diff accordion component.
 * @param {Object} options
 * @param {Array<[string, string]>} [options.diff]
 * @param {boolean} [options.isUpcoming]
 * @param {boolean} [options.isAdded]
 * @param {string} [options.newText]
 * @param {boolean} [options.isOpen]
 * @returns {string} HTML markup
 */
export function diffAccordionHtml({ diff, isUpcoming = false, isAdded = false, newText = '', isOpen = false }) {
  const hasDiff = Boolean(diff && diff.length > 0);
  if (hasDiff) {
    const diffCount = diff.filter(d => d[0] !== 'equal').length;
    return `
      <details class="finlex-diff-details" ${isOpen ? 'open' : ''}>
        <summary class="finlex-diff-summary">
          ${ICON_GIT_COMPARE}
          <span>Show changes ${isUpcoming ? 'against the text in force' : 'since previous version'}</span>
          <span class="finlex-diff-stats">(${diffCount} changes)</span>
        </summary>
        <div class="finlex-diff-body diff-body">
          ${renderDiffHtml(diff)}
        </div>
      </details>
    `;
  }

  if (isAdded && newText) {
    return `
      <details class="finlex-diff-details" ${isOpen ? 'open' : ''}>
        <summary class="finlex-diff-summary">
          ${ICON_PLUS_CIRCLE}
          <span>View newly added statutory text</span>
        </summary>
        <div class="finlex-diff-body diff-body">
          <ins class="diff-token-ins">${esc(newText)}</ins>
        </div>
      </details>
    `;
  }

  return '';
}
