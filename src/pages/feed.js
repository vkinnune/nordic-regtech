import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allFeedItems, FEED_CATEGORIES, FEED_AUTHORITIES } from '../core/store.js';
import { empty, feedScoreClass, feedScoreLabel, getFeedCat, getFeedAuth } from '../ui/helpers.js';

export function pageFeed() {
  const u = S.ui;
  const q = (u.feedQ || '').toLowerCase().trim();
  const authSeg = u.feedAuthSeg || 'all'; // 'all', 'fi', 'riksdagen', 'consumer_imy', 'riksbank'
  const scoreFilter = u.feedScore || 'all'; // 'all', '5', '4', '3', '2', '1'
  const catFilter = u.feedCat || 'all'; // 'all', 'AMENDMENT', 'CIRCULAR', etc.
  const authFilter = u.feedAuth || 'all'; // 'all', 'fi', 'riksdagen', etc.
  const layout = u.feedLayout || 'cards'; // 'cards' or 'list'

  const allItems = allFeedItems();

  const filtered = allItems.filter(item => {
    // Swedish Authority Segment filter
    if (authSeg !== 'all') {
      if (authSeg === 'fi' && item.authorityId !== 'fi') return false;
      if (authSeg === 'riksdagen' && item.authorityId !== 'riksdagen') return false;
      if ((authSeg === 'consumer_imy' || authSeg === 'consumer-imy') && item.authorityId !== 'konsumentverket' && item.authorityId !== 'imy') return false;
      if (authSeg === 'riksbank' && item.authorityId !== 'riksbank') return false;
    }

    // Impact score filter
    if (scoreFilter !== 'all') {
      const minScore = parseInt(scoreFilter, 10);
      if (!isNaN(minScore)) {
        if (minScore === 5 && item.score !== 5) return false;
        if (minScore === 1 && item.score !== 1) return false;
        if (minScore > 1 && minScore < 5 && item.score < minScore) return false;
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
      const matchFw = (item.frameworks || []).some(fw => fw.toLowerCase().includes(q));
      const matchVendors = (item.vendors || []).some(v => v.toLowerCase().includes(q));
      const matchRisks = (item.risks || []).some(r => r.toLowerCase().includes(q));
      const matchExpl = item.explanation && item.explanation.toLowerCase().includes(q);
      const matchWhy = item.plainEnglish?.whyItMatters && item.plainEnglish.whyItMatters.toLowerCase().includes(q);
      const matchAct = item.plainEnglish?.actionRequired && item.plainEnglish.actionRequired.toLowerCase().includes(q);

      if (
        !matchTitle &&
        !matchOrig &&
        !matchAuth &&
        !matchSum &&
        !matchStat &&
        !matchTags &&
        !matchFw &&
        !matchVendors &&
        !matchRisks &&
        !matchExpl &&
        !matchWhy &&
        !matchAct
      ) {
        return false;
      }
    }

    return true;
  });

  // Calculate statistics
  const totalCount = allItems.length;
  const criticalCount = allItems.filter(i => i.score >= 5).length;
  const highImpactCount = allItems.filter(i => i.score >= 4).length;
  const unreviewedCount = allItems.filter(i => i.status === 'UNREVIEWED').length;

  // Swedish Authority segment counts
  const fiCount = allItems.filter(i => i.authorityId === 'fi').length;
  const riksdagenCount = allItems.filter(i => i.authorityId === 'riksdagen').length;
  const consumerImyCount = allItems.filter(i => i.authorityId === 'konsumentverket' || i.authorityId === 'imy').length;
  const riksbankCount = allItems.filter(i => i.authorityId === 'riksbank').length;
  const agencyCount = totalCount - fiCount;

  const feedLimit = u.feedLimit || 24;
  const paged = filtered.slice(0, layout === 'list' ? feedLimit * 2 : feedLimit);

  let body;
  if (!allItems.length) {
    body = `<div class="panel">${empty('newspaper', 'No feed items', 'No regulatory updates currently tracked.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty(
      'search-x',
      'No matching regulatory updates',
      'Try adjusting your search query, authority segment, or active score filters.',
      `<button class="btn btn-secondary btn-sm" data-a="clearFeedFilters">${ic('rotate-ccw', 13)} Reset all filters</button>`,
    )}</div>`;
  } else if (layout === 'list') {
    body = `<div class="panel" style="overflow-x:auto">${renderFeedList(paged)}</div>`;
  } else {
    body = renderFeedCards(paged);
  }

  if (filtered.length > paged.length) {
    body += `<div class="row" style="justify-content:center;margin-top:20px;margin-bottom:24px">
      <button class="btn btn-secondary" data-a="moreFeedItems" style="padding:8px 24px;font-size:13px;font-weight:600">
        ${ic('chevron-down', 14)} Show more updates (${paged.length} of ${filtered.length})
      </button>
    </div>`;
  }

  // Active filter count
  const hasActiveFilters = q || authSeg !== 'all' || scoreFilter !== 'all' || catFilter !== 'all' || authFilter !== 'all';

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Regulatory Monitoring Feed</h1>
        <p>Real-time horizon tracking across Swedish supervisory authorities, Riksdagen legislative amendments, and Finansinspektionen regulatory standards</p>
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
        <span class="d">100% Swedish supervisory stream</span>
      </div>
      <div class="stat">
        <span class="k">Critical & High Impact</span>
        <span class="v" style="${criticalCount ? 'color:var(--amber)' : ''}">${highImpactCount}</span>
        <span class="d">${criticalCount} critical (score 5)</span>
      </div>
      <div class="stat">
        <span class="k">Finansinspektionen</span>
        <span class="v">${fiCount}</span>
        <span class="d">FSA supervisory notices</span>
      </div>
      <div class="stat">
        <span class="k">Riksdagen & Agencies</span>
        <span class="v">${agencyCount}</span>
        <span class="d">${riksdagenCount} Riksdagen · ${consumerImyCount} Consumer/IMY · ${riksbankCount} RB</span>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="row feed-toolbar" style="margin-bottom:14px;flex-wrap:wrap;gap:8px;align-items:center">
      <div class="inwrap" style="flex:1;min-width:240px;max-width:320px">
        ${ic('search', 13)}
        <input class="input search-sm" id="feed-q" data-in="feedQ" placeholder="Search updates, authorities, statutes..." value="${esc(u.feedQ || '')}" aria-label="Search regulatory feed">
        ${u.feedQ ? `<button class="pillbtn" data-a="set" data-k="feedQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
      </div>

      <!-- Swedish Authority Segment -->
      <div class="seg" role="tablist">
        <button class="${authSeg === 'all' ? 'on' : ''}" data-a="set" data-k="feedAuthSeg" data-v="all">All (${totalCount})</button>
        <button class="${authSeg === 'fi' ? 'on' : ''}" data-a="set" data-k="feedAuthSeg" data-v="fi">Finansinspektionen (${fiCount})</button>
        <button class="${authSeg === 'riksdagen' ? 'on' : ''}" data-a="set" data-k="feedAuthSeg" data-v="riksdagen">Riksdagen (${riksdagenCount})</button>
        <button class="${authSeg === 'consumer_imy' || authSeg === 'consumer-imy' ? 'on' : ''}" data-a="set" data-k="feedAuthSeg" data-v="consumer_imy">Consumer / IMY (${consumerImyCount})</button>
        <button class="${authSeg === 'riksbank' ? 'on' : ''}" data-a="set" data-k="feedAuthSeg" data-v="riksbank">Riksbank (${riksbankCount})</button>
      </div>

      <!-- Impact Score Filter Select -->
      <div class="row" style="gap:4px;align-items:center">
        <select class="select" data-in="feedScore" style="height:28px;width:auto;font-size:12px" aria-label="Filter by impact score">
          <option value="all" ${scoreFilter === 'all' ? 'selected' : ''}>All Scores</option>
          <option value="5" ${scoreFilter === '5' ? 'selected' : ''}>Critical (5)</option>
          <option value="4" ${scoreFilter === '4' ? 'selected' : ''}>High (4+)</option>
          <option value="3" ${scoreFilter === '3' ? 'selected' : ''}>Moderate (3+)</option>
          <option value="2" ${scoreFilter === '2' ? 'selected' : ''}>Low (2+)</option>
          <option value="1" ${scoreFilter === '1' ? 'selected' : ''}>Informational (1)</option>
        </select>
      </div>

      <!-- Category Filter Select -->
      <div class="row" style="gap:4px;align-items:center">
        <select class="select" data-in="feedCat" style="height:28px;width:auto;font-size:12px" aria-label="Filter by category">
          <option value="all" ${catFilter === 'all' ? 'selected' : ''}>All Categories</option>
          ${Object.values(FEED_CATEGORIES)
            .map(c => `<option value="${c.id}" ${catFilter === c.id ? 'selected' : ''}>${c.label}</option>`)
            .join('')}
        </select>
      </div>

      <!-- Authority Filter Select -->
      <div class="row" style="gap:4px;align-items:center">
        <select class="select" data-in="feedAuth" style="height:28px;width:auto;font-size:12px" aria-label="Filter by authority">
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
            ${authSeg !== 'all' ? `<span class="feed-chip">Authority: ${esc(authSeg === 'consumer_imy' || authSeg === 'consumer-imy' ? 'Consumer / IMY' : authSeg === 'fi' ? 'Finansinspektionen' : authSeg === 'riksdagen' ? 'Riksdagen' : authSeg === 'riksbank' ? 'Riksbank' : authSeg)} <button data-a="set" data-k="feedAuthSeg" data-v="all">${ic('x', 11)}</button></span>` : ''}
            ${scoreFilter !== 'all' ? `<span class="feed-chip">Score: ${scoreFilter === '5' ? 'Critical (5)' : scoreFilter === '1' ? 'Informational (1)' : scoreFilter + '+'} <button data-a="set" data-k="feedScore" data-v="all">${ic('x', 11)}</button></span>` : ''}
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
  const primaryFramework = item.frameworks && item.frameworks.length ? item.frameworks[0] : null;

  return `<article class="feed-card" data-id="${item.id}">
    <header class="feed-card-header">
      <div class="feed-card-source">
        <span>${authMeta.flag}</span>
        <span class="feed-auth-name">${esc(authMeta.short || item.authority)}</span>
        <span class="feed-sep">·</span>
        <time class="feed-time">${esc(item.relativeTime)}</time>
      </div>

      <div class="feed-card-status">
        ${item.status === 'ACKNOWLEDGED' ? `<span class="pill mono feed-status-ack">${ic('check', 10)} Assessed</span>` : ''}
        ${item.status === 'IN_MITIGATION' ? `<span class="pill mono feed-status-mit">${ic('clock', 10)} In Mitigation</span>` : ''}
        <span class="feed-score-badge ${scoreClass}" title="${esc(feedScoreLabel(item.score))} (${item.score}/5)">
          ${item.score}/5
        </span>
      </div>
    </header>

    <h3 class="feed-card-title" data-a="openFeedDrawer" data-id="${item.id}" title="Click to inspect regulatory analysis">
      ${esc(item.title)}
    </h3>

    <p class="feed-card-summary">
      ${esc(item.summary)}
    </p>

    <div class="feed-card-context">
      <span class="pill mono feed-cat-pill">${esc(catMeta.label)}</span>
      ${
        item.statuteRef
          ? `<button class="pill mono feed-statute-pill" data-a="openRegInReader" data-id="${item.statuteId}" data-sec="${item.statuteSec}" title="Jump to ${esc(item.statuteRef)} in regulation reader">
              ${ic('scale', 11)} ${esc(item.statuteRef)}
            </button>`
          : ''
      }
      ${primaryFramework ? `<button class="pill mono feed-fw-pill clickable" data-a="openRegFromFramework" data-fw="${esc(primaryFramework)}" title="Jump to regulation for ${esc(primaryFramework)}" style="cursor:pointer;border:1px solid var(--border)">${ic('file-check', 11)} ${esc(primaryFramework)}</button>` : ''}
    </div>

    <footer class="feed-card-footer">
      <button class="btn btn-sm btn-ghost feed-inspect-btn" data-a="openFeedDrawer" data-id="${item.id}">
        Inspect analysis ${ic('arrow-right', 12)}
      </button>

      <div class="feed-card-acts">
        ${
          item.taskId
            ? `<button class="btn btn-sm btn-ghost feed-task-btn" data-a="editTask" data-id="${item.taskId}" title="Open mitigation task #${item.taskId}">
                ${ic('check', 11)} Task linked
              </button>`
            : `<button class="btn btn-sm btn-secondary feed-mit-btn" data-a="createTaskFromFeed" data-id="${item.id}" title="Create mitigation task in workspace">
                ${ic('plus', 11)} Mitigate
              </button>`
        }
        ${
          item.status !== 'ACKNOWLEDGED'
            ? `<button class="btn btn-sm btn-ghost feed-ack-btn" data-a="ackFeedItem" data-id="${item.id}" title="Mark as assessed by compliance">
                ${ic('check', 11)}
              </button>`
            : ''
        }
      </div>
    </footer>
  </article>`;
}

/* ============================================================
   2. COMPACT LIST VIEW
   ============================================================ */
function renderFeedList(items) {
  return `<table class="gov-table feed-table">
    <thead>
      <tr>
        <th style="width:70px">Impact</th>
        <th style="width:140px">Authority</th>
        <th>Regulatory Event & Synopsis</th>
        <th style="width:140px">Category</th>
        <th style="width:160px">Statute</th>
        <th style="width:100px">Published</th>
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
                ${item.score}/5
              </span>
            </td>
            <td>
              <div class="row" style="gap:5px;align-items:center">
                <span>${authMeta.flag}</span>
                <span style="font-weight:600;font-size:12px">${esc(authMeta.short || item.authority)}</span>
                <span class="pill mono feed-jur-pill" style="font-size:9.5px">${esc(item.jurisdiction)}</span>
              </div>
            </td>
            <td>
              <div style="font-weight:600;font-size:13px;color:var(--text);line-height:1.35;cursor:pointer" data-a="openFeedDrawer" data-id="${item.id}" title="Inspect analysis">${esc(item.title)}</div>
              <div class="faint trunc" style="font-size:12px;max-width:520px;margin-top:2px">${esc(item.summary)}</div>
              ${
                (item.frameworks && item.frameworks.length) || (item.risks && item.risks.length) || (item.vendors && item.vendors.length)
                  ? `<div class="row" style="gap:4px;margin-top:4px;flex-wrap:wrap">
                      ${(item.frameworks || [])
                        .slice(0, 2)
                        .map(
                          f =>
                            `<button class="pill mono feed-meta-tag feed-fw-pill clickable" data-a="openRegFromFramework" data-fw="${esc(f)}" style="font-size:9.5px;padding:1px 5px;cursor:pointer;border:1px solid var(--border)" title="Jump to regulation for ${esc(f)}">${ic('file-text', 9)} ${esc(f)}</button>`,
                        )
                        .join('')}
                      ${(item.risks || [])
                        .slice(0, 1)
                        .map(r => `<span class="pill mono feed-meta-tag" style="font-size:9.5px;padding:1px 5px">${ic('alert-triangle', 9)} ${esc(r)}</span>`)
                        .join('')}
                      ${(item.vendors || [])
                        .slice(0, 1)
                        .map(v => `<span class="pill mono feed-meta-tag" style="font-size:9.5px;padding:1px 5px">${ic('building-2', 9)} ${esc(v)}</span>`)
                        .join('')}
                    </div>`
                  : ''
              }
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
              <span class="muted" style="font-size:11.5px">${esc(item.relativeTime)}</span>
            </td>
            <td style="text-align:right">
              <div class="row" style="gap:4px;justify-content:flex-end">
                <button class="btn btn-sm btn-ghost" data-a="openFeedDrawer" data-id="${item.id}" style="padding:2px 7px;font-size:11px" title="Inspect details">
                  Inspect
                </button>
                ${
                  item.taskId
                    ? `<button class="btn btn-sm btn-ghost" data-a="editTask" data-id="${item.taskId}" style="padding:2px 6px;font-size:11px" title="View linked mitigation task">
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
