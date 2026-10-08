import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allFeedItems, FEED_CATEGORIES, FEED_AUTHORITIES } from '../core/store.js';
import { empty, feedScoreClass, feedScoreLabel, getFeedCat, getFeedAuth } from '../ui/helpers.js';

export function pageFeed() {
  const u = S.ui;
  const q = (u.feedQ || '').toLowerCase().trim();
  const juris = u.feedJuris || 'all'; // 'all', 'se', 'fi', 'eu'
  const scoreFilter = u.feedScore || 'all'; // 'all', '5', '4', '3', '2', '1'
  const catFilter = u.feedCat || 'all'; // 'all', 'AMENDMENT', 'CIRCULAR', etc.
  const authFilter = u.feedAuth || 'all'; // 'all', 'fi', 'riksdagen', etc.
  const layout = u.feedLayout || 'cards'; // 'cards' or 'list'

  const allItems = allFeedItems();

  const filtered = allItems.filter(item => {
    // Jurisdiction filter
    if (juris !== 'all' && item.jurisdiction.toLowerCase() !== juris.toLowerCase()) {
      return false;
    }

    // Impact score filter
    if (scoreFilter !== 'all') {
      const minScore = parseInt(scoreFilter, 10);
      if (!isNaN(minScore)) {
        if (minScore === 5 && item.score !== 5) return false;
        if (minScore < 5 && item.score < minScore) return false;
      }
    }

    // Category filter
    if (catFilter !== 'all' && item.category !== catFilter) return false;

    // Authority filter
    if (authFilter !== 'all' && item.authorityId !== authFilter) return false;

    // Search query filter
    if (q) {
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchOrig = item.originalTitle && item.originalTitle.toLowerCase().includes(q);
      const matchAuth = item.authority.toLowerCase().includes(q);
      const matchSum = item.summary.toLowerCase().includes(q);
      const matchStat = item.statuteRef.toLowerCase().includes(q);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
      const matchWhy = item.plainEnglish?.whyItMatters && item.plainEnglish.whyItMatters.toLowerCase().includes(q);
      const matchAct = item.plainEnglish?.actionRequired && item.plainEnglish.actionRequired.toLowerCase().includes(q);

      if (!matchTitle && !matchOrig && !matchAuth && !matchSum && !matchStat && !matchTags && !matchWhy && !matchAct) {
        return false;
      }
    }

    return true;
  });

  // Calculate statistics
  const totalCount = allItems.length;
  const criticalCount = allItems.filter(i => i.score >= 5).length;
  const highImpactCount = allItems.filter(i => i.score >= 4).length;
  const seCount = allItems.filter(i => i.jurisdiction === 'SE').length;
  const fiCount = allItems.filter(i => i.jurisdiction === 'FI').length;
  const euCount = allItems.filter(i => i.jurisdiction === 'EU').length;
  const unreviewedCount = allItems.filter(i => i.status === 'UNREVIEWED').length;

  let body;
  if (!allItems.length) {
    body = `<div class="panel">${empty('newspaper', 'No feed items', 'No regulatory updates currently tracked.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty(
      'search-x',
      'No matching regulatory updates',
      'Try adjusting your search query, jurisdiction, or active score filters.',
      `<button class="btn btn-secondary btn-sm" data-a="clearFeedFilters">${ic('rotate-ccw', 13)} Reset all filters</button>`,
    )}</div>`;
  } else if (layout === 'list') {
    body = `<div class="panel" style="overflow-x:auto">${renderFeedList(filtered)}</div>`;
  } else {
    body = renderFeedCards(filtered);
  }

  // Active filter count
  const hasActiveFilters = q || juris !== 'all' || scoreFilter !== 'all' || catFilter !== 'all' || authFilter !== 'all';

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Regulatory Monitoring Feed</h1>
        <p>Real-time horizon tracking across Nordic supervisory authorities, Riksdagen legislative amendments, and EU technical standards</p>
      </div>
      <div class="acts">
        ${
          unreviewedCount > 0
            ? `<div class="gov-alert-badge" title="Unreviewed regulatory updates requiring compliance assessment">
                ${ic('bell-ring', 13)}
                <span>${unreviewedCount} unassessed updates</span>
              </div>`
            : `<div class="gov-ok-badge">
                ${ic('check-circle', 13)}
                <span>All horizon events assessed</span>
              </div>`
        }
      </div>
    </div>

    <!-- Metrics strip -->
    <div class="stats" style="margin-bottom:16px">
      <div class="stat">
        <span class="k">Monitored Updates</span>
        <span class="v">${totalCount}</span>
        <span class="d">active horizon stream</span>
      </div>
      <div class="stat">
        <span class="k">Critical & High Impact</span>
        <span class="v" style="${criticalCount ? 'color:var(--amber)' : ''}">${highImpactCount}</span>
        <span class="d">${criticalCount} critical (score 5)</span>
      </div>
      <div class="stat">
        <span class="k">Swedish Authorities</span>
        <span class="v">${seCount}</span>
        <span class="d">FI, Riksdagen & KO</span>
      </div>
      <div class="stat">
        <span class="k">EU Directives & Cross-Border</span>
        <span class="v">${euCount + fiCount}</span>
        <span class="d">${euCount} EU · ${fiCount} FIN-FSA</span>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="row feed-toolbar" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div class="inwrap" style="flex:1;min-width:240px;max-width:340px">
        ${ic('search', 13)}
        <input class="input search-sm" id="feed-q" data-in="feedQ" placeholder="Search updates, authorities, statutes or tags..." value="${esc(u.feedQ || '')}" aria-label="Search regulatory feed">
        ${u.feedQ ? `<button class="pillbtn" data-a="set" data-k="feedQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
      </div>

      <!-- Jurisdiction Segment -->
      <div class="seg" role="tablist">
        <button class="${juris === 'all' ? 'on' : ''}" data-a="set" data-k="feedJuris" data-v="all">All (${totalCount})</button>
        <button class="${juris === 'se' ? 'on' : ''}" data-a="set" data-k="feedJuris" data-v="se">🇸🇪 Sweden (${seCount})</button>
        <button class="${juris === 'fi' ? 'on' : ''}" data-a="set" data-k="feedJuris" data-v="fi">🇫🇮 Finland (${fiCount})</button>
        <button class="${juris === 'eu' ? 'on' : ''}" data-a="set" data-k="feedJuris" data-v="eu">🇪🇺 EU (${euCount})</button>
      </div>

      <!-- Impact Score Filter -->
      <div class="seg" role="tablist">
        <button class="${scoreFilter === 'all' ? 'on' : ''}" data-a="set" data-k="feedScore" data-v="all">All Scores</button>
        <button class="${scoreFilter === '5' ? 'on' : ''}" data-a="set" data-k="feedScore" data-v="5">Critical (5)</button>
        <button class="${scoreFilter === '4' ? 'on' : ''}" data-a="set" data-k="feedScore" data-v="4">High (4+)</button>
        <button class="${scoreFilter === '3' ? 'on' : ''}" data-a="set" data-k="feedScore" data-v="3">Moderate (3+)</button>
        <button class="${scoreFilter === '2' ? 'on' : ''}" data-a="set" data-k="feedScore" data-v="2">Low (2+)</button>
        <button class="${scoreFilter === '1' ? 'on' : ''}" data-a="set" data-k="feedScore" data-v="1">Info (1+)</button>
      </div>

      <!-- Category Filter Select -->
      <div class="row" style="gap:4px;align-items:center">
        <select class="input input-sm" data-in="feedCat" style="width:auto;padding:3px 8px;font-size:12px;font-weight:500" aria-label="Filter by category">
          <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All Categories</option>
          ${Object.values(FEED_CATEGORIES)
            .map(c => `<option value="${c.id}" ${catFilter === c.id ? 'selected' : ''}>${c.label}</option>`)
            .join('')}
        </select>
      </div>

      <!-- Authority Filter Select -->
      <div class="row" style="gap:4px;align-items:center">
        <select class="input input-sm" data-in="feedAuth" style="width:auto;padding:3px 8px;font-size:12px;font-weight:500" aria-label="Filter by authority">
          <option value="all" ${authFilter === 'all' ? 'selected' : ''}>All Authorities</option>
          ${Object.values(FEED_AUTHORITIES)
            .map(a => `<option value="${a.id}" ${authFilter === a.id ? 'selected' : ''}>${a.flag} ${a.short}</option>`)
            .join('')}
        </select>
      </div>

      <!-- Layout toggle -->
      <div class="seg" role="tablist" style="margin-left:auto">
        <button class="${layout !== 'list' ? 'on' : ''}" data-a="set" data-k="feedLayout" data-v="cards" title="Cards grid view">${ic('layout-grid', 13)}<span class="hide-m">Cards</span></button>
        <button class="${layout === 'list' ? 'on' : ''}" data-a="set" data-k="feedLayout" data-v="list" title="Compact list view">${ic('list', 13)}<span class="hide-m">List</span></button>
      </div>
    </div>

    <!-- Active filter chips bar -->
    ${
      hasActiveFilters
        ? `<div class="row feed-chips-bar" style="margin-bottom:14px;gap:6px;flex-wrap:wrap">
            <span class="faint mono" style="font-size:11px;margin-right:2px">Active filters:</span>
            ${q ? `<span class="feed-chip">Query: "${esc(q)}" <button data-a="set" data-k="feedQ" data-v="">${ic('x', 11)}</button></span>` : ''}
            ${juris !== 'all' ? `<span class="feed-chip">Jurisdiction: ${esc(juris.toUpperCase())} <button data-a="set" data-k="feedJuris" data-v="all">${ic('x', 11)}</button></span>` : ''}
            ${scoreFilter !== 'all' ? `<span class="feed-chip">Score: ${esc(scoreFilter)}+ <button data-a="set" data-k="feedScore" data-v="all">${ic('x', 11)}</button></span>` : ''}
            ${catFilter !== 'all' ? `<span class="feed-chip">Category: ${esc(FEED_CATEGORIES[catFilter]?.label || catFilter)} <button data-a="set" data-k="feedCat" data-v="all">${ic('x', 11)}</button></span>` : ''}
            ${authFilter !== 'all' ? `<span class="feed-chip">Authority: ${esc(FEED_AUTHORITIES[authFilter]?.short || authFilter)} <button data-a="set" data-k="feedAuth" data-v="all">${ic('x', 11)}</button></span>` : ''}
            <button class="btn btn-ghost btn-xs" data-a="clearFeedFilters" style="font-size:11px;padding:2px 6px">Clear all</button>
          </div>`
        : ''
    }

    <!-- Main Content -->
    ${body}
  </div>`;
}

/* ============================================================
   1. CARDS GRID VIEW
   ============================================================ */
function renderFeedCards(items) {
  return `<div class="feed-grid">
    ${items.map(item => renderFeedCard(item)).join('')}
  </div>`;
}

function renderFeedCard(item) {
  const catMeta = getFeedCat(item.category);
  const authMeta = getFeedAuth(item.authorityId, item.authority);
  const scoreClass = feedScoreClass(item.score);

  return `<div class="feed-card" data-id="${item.id}">
    <!-- Card Header -->
    <div class="feed-card-header">
      <div class="row" style="gap:6px;align-items:center">
        <span class="feed-card-auth">
          <span>${authMeta.flag}</span>
          <b>${esc(authMeta.short || item.authority)}</b>
        </span>
        <span class="pill mono feed-jur-pill">${esc(item.jurisdiction)}</span>
        <span class="faint" style="font-size:11.5px">·</span>
        <span class="feed-card-time">${esc(item.relativeTime)}</span>
      </div>

      <div class="feed-score-badge ${scoreClass}" title="${esc(feedScoreLabel(item.score))} (${item.score}/5)">
        ${ic('zap', 11)}
        <span>${item.score}/5</span>
      </div>
    </div>

    <!-- Category Pill -->
    <div style="margin-bottom:8px">
      <span class="pill mono feed-cat-pill">
        ${ic(catMeta.icon, 11)} ${esc(catMeta.label)}
      </span>
      ${item.status === 'ACKNOWLEDGED' ? `<span class="pill mono feed-status-ack">${ic('check', 10)} Assessed</span>` : ''}
      ${item.status === 'IN_MITIGATION' ? `<span class="pill mono feed-status-mit">${ic('clock', 10)} In Mitigation</span>` : ''}
    </div>

    <!-- Card Title -->
    <h3 class="feed-card-title" data-a="openFeedDrawer" data-id="${item.id}">
      ${esc(item.title)}
    </h3>

    ${item.originalTitle ? `<div class="feed-card-orig">${esc(item.originalTitle)}</div>` : ''}

    <!-- Summary -->
    <p class="feed-card-summary">
      ${esc(item.summary)}
    </p>

    <!-- Executive Breakdown -->
    ${
      item.plainEnglish?.whyItMatters
        ? `<div class="feed-card-why">
            <b>Why it matters:</b> ${esc(item.plainEnglish.whyItMatters)}
          </div>`
        : ''
    }
    ${
      item.plainEnglish?.actionRequired
        ? `<div style="margin-top:6px;font-size:11.5px;color:var(--text-2);background:var(--surface-2);padding:6px 10px;border-radius:4px;border:1px solid var(--border)">
            <b>Action:</b> ${esc(item.plainEnglish.actionRequired)}
          </div>`
        : ''
    }

    <!-- Statutory Citation Badge -->
    <div class="feed-card-statute" style="margin-top:10px">
      <button class="feed-statute-btn" data-a="openRegInReader" data-id="${item.statuteId}" data-sec="${item.statuteSec}" title="Open statutory provision in reader">
        ${ic('scale', 12)}
        <span>${esc(item.statuteRef)}</span>
        ${ic('arrow-right', 11, 'faint')}
      </button>
    </div>

    <!-- Governance Matrix Linkages -->
    <div class="feed-card-gov-chips" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px">
      ${(item.policyIds || []).map(pid => `<button class="pill mono btn-ghost" data-a="openGovDrawer" data-type="policy" data-id="${pid}" style="font-size:10.5px;padding:2px 6px" title="Inspect policy ${pid.toUpperCase()} in matrix">${ic('file-text', 10)} ${esc(pid.toUpperCase())}</button>`).join('')}
      ${(item.controlIds || []).map(cid => `<button class="pill mono btn-ghost" data-a="openGovDrawer" data-type="control" data-id="${cid}" style="font-size:10.5px;padding:2px 6px" title="Inspect control ${cid.toUpperCase()} in matrix">${ic('shield-check', 10)} ${esc(cid.toUpperCase())}</button>`).join('')}
      ${(item.riskIds || []).map(rid => `<button class="pill mono btn-ghost" data-a="openGovDrawer" data-type="risk" data-id="${rid}" style="font-size:10.5px;padding:2px 6px" title="Inspect risk ${rid.toUpperCase()} in matrix">${ic('alert-triangle', 10)} ${esc(rid.toUpperCase())}</button>`).join('')}
    </div>

    <!-- Card Actions Footer -->
    <div class="feed-card-actions" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border)">
      <button class="btn btn-sm btn-ghost" data-a="openFeedDrawer" data-id="${item.id}">
        ${ic('info', 12)} Inspect
      </button>
      <button class="btn btn-sm btn-secondary" data-a="openRegInReader" data-id="${item.statuteId}" data-sec="${item.statuteSec}">
        ${ic('book-open', 12)} Read Act
      </button>
      ${
        item.taskId
          ? `<button class="btn btn-sm btn-primary" data-a="editTask" data-id="${item.taskId}" title="Open mitigation task">
              ${ic('check', 12)} Task Linked
            </button>`
          : `<button class="btn btn-sm btn-primary" data-a="createTaskFromFeed" data-id="${item.id}" title="Create mitigation task in workspace">
              ${ic('plus', 12)} Mitigate
            </button>`
      }
      ${
        item.status !== 'ACKNOWLEDGED'
          ? `<button class="btn btn-sm btn-ghost" data-a="ackFeedItem" data-id="${item.id}" title="Mark as assessed" style="margin-left:auto">
              ${ic('check', 11)} Assess
            </button>`
          : ''
      }
    </div>
  </div>`;
}

/* ============================================================
   2. COMPACT LIST VIEW
   ============================================================ */
function renderFeedList(items) {
  return `<table class="gov-table feed-table">
    <thead>
      <tr>
        <th style="width:70px">Impact</th>
        <th style="width:130px">Authority</th>
        <th>Regulatory Event & Executive Synopsis</th>
        <th style="width:140px">Category</th>
        <th style="width:160px">Statutory Provision</th>
        <th style="width:160px">Governance Matrix</th>
        <th style="width:90px">Published</th>
        <th style="width:130px;text-align:right">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(item => {
          const catMeta = getFeedCat(item.category);
          const authMeta = getFeedAuth(item.authorityId, item.authority);
          const scoreClass = feedScoreClass(item.score);

          return `<tr>
            <td>
              <span class="feed-score-badge ${scoreClass}" style="padding:2px 6px" title="${esc(feedScoreLabel(item.score))} (${item.score}/5)">
                ${ic('zap', 11)} ${item.score}/5
              </span>
            </td>
            <td>
              <div class="row" style="gap:4px">
                <span>${authMeta.flag}</span>
                <span style="font-weight:600;font-size:12px">${esc(authMeta.short || item.authority)}</span>
                <span class="pill mono feed-jur-pill" style="font-size:9.5px">${esc(item.jurisdiction)}</span>
              </div>
            </td>
            <td>
              <div style="font-weight:600;font-size:13px;color:var(--text);line-height:1.35;cursor:pointer" data-a="openFeedDrawer" data-id="${item.id}">${esc(item.title)}</div>
              <div class="faint trunc" style="font-size:11.5px;max-width:440px;margin-top:2px">${esc(item.summary)}</div>
              ${item.plainEnglish?.actionRequired ? `<div class="faint" style="font-size:11px;margin-top:3px;color:var(--text-2)"><b>Action:</b> ${esc(item.plainEnglish.actionRequired)}</div>` : ''}
            </td>
            <td>
              <span class="pill mono" style="font-size:11px">
                ${ic(catMeta.icon, 11)} ${esc(catMeta.label)}
              </span>
            </td>
            <td>
              <button class="pill mono btn-ghost" data-a="openRegInReader" data-id="${item.statuteId}" data-sec="${item.statuteSec}" style="padding:3px 7px;font-size:11.5px" title="Jump to statute reader">
                ${ic('scale', 11)} ${esc(item.statuteRef)}
              </button>
            </td>
            <td>
              <div class="row" style="gap:3px;flex-wrap:wrap">
                ${(item.policyIds || []).map(pid => `<button class="pill mono btn-ghost" data-a="openGovDrawer" data-type="policy" data-id="${pid}" style="padding:2px 5px;font-size:10px" title="Inspect policy ${pid.toUpperCase()}">${ic('file-text', 10)} ${esc(pid.toUpperCase())}</button>`).join('')}
                ${(item.controlIds || []).map(cid => `<button class="pill mono btn-ghost" data-a="openGovDrawer" data-type="control" data-id="${cid}" style="padding:2px 5px;font-size:10px" title="Inspect control ${cid.toUpperCase()}">${ic('shield-check', 10)} ${esc(cid.toUpperCase())}</button>`).join('')}
                ${(item.riskIds || []).map(rid => `<button class="pill mono btn-ghost" data-a="openGovDrawer" data-type="risk" data-id="${rid}" style="padding:2px 5px;font-size:10px" title="Inspect risk ${rid.toUpperCase()}">${ic('alert-triangle', 10)} ${esc(rid.toUpperCase())}</button>`).join('')}
              </div>
            </td>
            <td>
              <span class="muted" style="font-size:11.5px">${esc(item.relativeTime)}</span>
            </td>
            <td style="text-align:right">
              <div class="row" style="gap:4px;justify-content:flex-end">
                <button class="btn btn-sm btn-ghost" data-a="openFeedDrawer" data-id="${item.id}" style="padding:2px 6px;font-size:11px" title="Inspect details">
                  Inspect
                </button>
                ${
                  item.taskId
                    ? `<button class="btn btn-sm btn-primary" data-a="editTask" data-id="${item.taskId}" style="padding:2px 6px;font-size:11px" title="View linked mitigation task">
                        Task ✓
                      </button>`
                    : `<button class="btn btn-sm btn-secondary" data-a="createTaskFromFeed" data-id="${item.id}" style="padding:2px 6px;font-size:11px" title="Create mitigation task">
                        + Task
                      </button>`
                }
              </div>
            </td>
          </tr>`;
        })
        .join('')}
    </tbody>
  </table>`;
}
