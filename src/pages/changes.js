/* ---------- REGULATORY CHANGES & AMENDMENT FEED ---------- */
import { esc, renderDiffHtml } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allChanges } from '../core/store.js';
import { empty } from '../ui/helpers.js';

export { renderDiffHtml };

function formatDate(dateStr) {
  if (!dateStr) return 'Recent';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function pageChanges() {
  const u = S.ui;
  const sourceFilter = u.changesSource || 'all'; // 'all', 'riksdagen', 'fffs'
  const statusFilter = u.changesStatus || 'all'; // 'all', 'MODIFIED', 'ADDED', 'REPEALED'
  const q = (u.changesQ || '').toLowerCase().trim();

  const events = allChanges() || [];

  const totalEvents = events.length;
  const sfsEvents = events.filter(e => e.source === 'riksdagen').length;
  const fffsEvents = events.filter(e => e.source === 'fffs').length;
  const modifiedEvents = events.filter(e => e.status === 'MODIFIED').length;
  const addedEvents = events.filter(e => e.status === 'ADDED').length;
  const repealedEvents = events.filter(e => e.status === 'REPEALED').length;
  const uniqueActs = new Set(events.map(e => e.docId)).size;

  const filtered = events.filter(e => {
    if (sourceFilter === 'riksdagen' && e.source !== 'riksdagen') return false;
    if (sourceFilter === 'fffs' && e.source !== 'fffs') return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (q) {
      const matchText = `${e.code || ''} ${e.title || ''} ${e.amendingAct || ''} ${e.chapter || ''} ${e.section || ''} ${e.oldText || ''} ${e.newText || ''}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  const byDay = new Map();
  filtered.forEach(e => {
    const dayStr = e.fetchedAt ? e.fetchedAt.slice(0, 10) : 'Recent';
    if (!byDay.has(dayStr)) byDay.set(dayStr, []);
    byDay.get(dayStr).push(e);
  });

  let body;
  if (!events.length) {
    body = `<div class="panel">${empty(
      'history',
      'No changes recorded yet',
      'Changes are recorded each time regtech fetch discovers new amendments, new wordings, or repeals in Swedish financial law.',
    )}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty(
      'search-x',
      'No matching regulatory changes',
      'Try adjusting your search query, legislative source, or status filter.',
      `<button class="btn btn-secondary btn-sm" data-a="clearChangesFilters">${ic('rotate-ccw', 13)} Reset filters</button>`,
    )}</div>`;
  } else {
    body = `<div class="changes-stream">
      ${Array.from(byDay.entries())
        .map(([day, items]) => {
          return `
          <section class="changes-day-section">
            <div class="changes-day-hdr">
              <span class="changes-day-date">${ic('calendar', 12)} Fetched ${formatDate(day)}</span>
              <span class="changes-day-cnt">${items.length} provision change${items.length === 1 ? '' : 's'}</span>
            </div>

            <div class="changes-cards-list">
              ${items
                .map(e => {
                  const isModified = e.status === 'MODIFIED';
                  const isAdded = e.status === 'ADDED';
                  const isRepealed = e.status === 'REPEALED';

                  let statusBadge = '';
                  if (isModified) {
                    statusBadge = `<span class="finlex-tag-badge badge-amber">Modified${e.amendingAct ? ` by ${esc(e.amendingAct)}` : ''}${e.amendedDate ? `, in force ${esc(e.amendedDate)}` : ''}</span>`;
                  } else if (isAdded) {
                    statusBadge = `<span class="finlex-tag-badge badge-emerald">Added${e.amendingAct ? ` by ${esc(e.amendingAct)}` : ''}${e.amendedDate ? `, in force ${esc(e.amendedDate)}` : ''}</span>`;
                  } else if (isRepealed) {
                    statusBadge = `<span class="finlex-tag-badge badge-red">Repealed${e.amendingAct ? ` by ${esc(e.amendingAct)}` : ''}</span>`;
                  }

                  const hasDiff = e.diff && e.diff.length > 0;
                  const diffChangesCount = hasDiff ? e.diff.filter(d => d[0] !== 'equal').length : 0;
                  const secLabel = e.level === 'document'
                    ? 'Whole document'
                    : `${e.chapter ? `${esc(e.chapter)} kap. ` : ''}${esc(e.section || '')} §${e.upcoming ? ' (upcoming wording)' : ''}`;

                  return `
                  <article class="changes-card surface">
                    <div class="changes-card-head">
                      <div class="changes-act-line">
                        <button class="changes-act-code link" data-a="openRegInReader" data-id="${e.docId}" data-sec="${e.chunkId || ''}" data-diff="true" title="Open regulation in reader">
                          ${esc(e.code || e.docId)}
                        </button>
                        <span class="changes-act-title truncate" title="${esc(e.title)}">${esc(e.title)}</span>
                      </div>
                      <span class="changes-source-pill ${e.source === 'riksdagen' ? 'is-sfs' : 'is-fffs'}">
                        ${e.source === 'riksdagen' ? 'Riksdagen SFS' : 'Finansinspektionen FFFS'}
                      </span>
                    </div>

                    <div class="changes-card-meta">
                      <div class="changes-sec-group">
                        <button class="changes-sec-btn link" data-a="openRegInReader" data-id="${e.docId}" data-sec="${e.chunkId || ''}" data-diff="true" title="Jump to section in reader">
                          ${secLabel}
                        </button>
                        ${statusBadge}
                      </div>
                      <button class="btn btn-secondary btn-xs" data-a="openRegInReader" data-id="${e.docId}" data-sec="${e.chunkId || ''}" data-diff="true" title="Open reader and inspect diff">
                        ${ic('external-link', 11)} Open in Reader
                      </button>
                    </div>

                    ${
                      hasDiff
                        ? `
                      <details class="finlex-diff-details">
                        <summary class="finlex-diff-summary">
                          ${ic('git-compare', 12)}
                          <span>Show changes ${e.upcoming ? 'against the text in force' : 'since previous version'}</span>
                          <span class="finlex-diff-stats">(${diffChangesCount} changes)</span>
                        </summary>
                        <div class="finlex-diff-body diff-body">
                          ${renderDiffHtml(e.diff)}
                        </div>
                      </details>
                    `
                        : isAdded && e.newText
                          ? `
                      <details class="finlex-diff-details">
                        <summary class="finlex-diff-summary">
                          ${ic('plus-circle', 12)}
                          <span>View newly added statutory text</span>
                        </summary>
                        <div class="finlex-diff-body diff-body">
                          <ins class="diff-token-ins">${esc(e.newText)}</ins>
                        </div>
                      </details>
                    `
                          : ''
                    }
                  </article>
                `;
                })
                .join('')}
            </div>
          </section>
        `;
        })
        .join('')}
    </div>`;
  }

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Regulatory Changes</h1>
        <p>Live statutory amendment stream & redline comparison directly from Swedish official sources</p>
      </div>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><span class="k">Recorded Changes</span><span class="v">${totalEvents}</span><span class="d">tracked statutory provisions</span></div>
      <div class="stat"><span class="k">Modifications</span><span class="v">${modifiedEvents}</span><span class="d">sections with redline changes</span></div>
      <div class="stat"><span class="k">New Provisions</span><span class="v">${addedEvents}</span><span class="d">newly enacted provisions</span></div>
      <div class="stat"><span class="k">Impacted Statutes</span><span class="v">${uniqueActs}</span><span class="d">Swedish statutory codes</span></div>
    </div>

    <!-- FILTER TOOLBAR -->
    <div class="changes-toolbar surface">
      <!-- Search -->
      <div class="inwrap changes-search-wrap">
        ${ic('search', 13)}
        <input class="input search-sm" id="changes-q" data-in="changesQ" placeholder="Filter changes by act, section, amendment (e.g. SFS 2026:784)..." value="${esc(u.changesQ || '')}" aria-label="Filter changes">
        ${q ? `<button class="ibtn ibtn-xs" data-a="clearChangesQ" title="Clear filter">${ic('x', 11)}</button>` : ''}
      </div>

      <!-- Source Segment -->
      <div class="seg" role="tablist" aria-label="Source filter">
        <button class="${sourceFilter === 'all' ? 'on' : ''}" data-a="set" data-k="changesSource" data-v="all">All Sources (${totalEvents})</button>
        <button class="${sourceFilter === 'riksdagen' ? 'on' : ''}" data-a="set" data-k="changesSource" data-v="riksdagen">Parliament (SFS ${sfsEvents})</button>
        <button class="${sourceFilter === 'fffs' ? 'on' : ''}" data-a="set" data-k="changesSource" data-v="fffs">FI Rules (FFFS ${fffsEvents})</button>
      </div>

      <!-- Status Segment -->
      <div class="seg" role="tablist" aria-label="Status filter">
        <button class="${statusFilter === 'all' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="all">All Statuses</button>
        <button class="${statusFilter === 'MODIFIED' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="MODIFIED">Modified (${modifiedEvents})</button>
        <button class="${statusFilter === 'ADDED' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="ADDED">Added (${addedEvents})</button>
        ${repealedEvents ? `<button class="${statusFilter === 'REPEALED' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="REPEALED">Repealed (${repealedEvents})</button>` : ''}
      </div>
    </div>

    ${body}
  </div>`;
}
