/* ---------- POLICIES REGISTRY (Governance Policies & Standards) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allPolicies, isPolicyImpacted, regulationOfSection } from '../core/store.js';
import { empty, formatSecBadge } from '../ui/helpers.js';

export function pagePolicies() {
  const u = S.ui;
  const q = (u.polQ || '').toLowerCase().trim();
  const statusFilter = u.polStatus || 'all'; // 'all', 'NEEDS_REVIEW', 'ACTIVE', 'DRAFT'

  const policies = allPolicies();
  const filtered = policies.filter(p => {
    if (statusFilter === 'NEEDS_REVIEW' && !isPolicyImpacted(p)) return false;
    if (statusFilter !== 'all' && statusFilter !== 'NEEDS_REVIEW' && p.status !== statusFilter) return false;
    if (q) {
      const matchCode = p.code.toLowerCase().includes(q);
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchShort = p.shortTitle && p.shortTitle.toLowerCase().includes(q);
      const matchOwner = p.owner && p.owner.toLowerCase().includes(q);
      const matchCat = p.category && p.category.toLowerCase().includes(q);
      const matchSum = p.summary && p.summary.toLowerCase().includes(q);
      const matchSec = (p.statuteSections || []).some(s => s.toLowerCase().includes(q));
      if (!matchCode && !matchTitle && !matchShort && !matchOwner && !matchCat && !matchSum && !matchSec) {
        return false;
      }
    }
    return true;
  });

  const needsReviewCount = policies.filter(isPolicyImpacted).length;
  const activeCount = policies.filter(p => p.status === 'ACTIVE' && !isPolicyImpacted(p)).length;
  const totalControlsLinked = policies.reduce((sum, p) => sum + (p.controlIds || []).length, 0);
  const distinctStatutes = new Set(policies.flatMap(p => (p.statuteSections || []).map(s => regulationOfSection(s)?.id || s.split('-')[0]))).size;

  let body;
  if (!policies.length) {
    body = `<div class="panel">${empty('file-text', 'No policies found', 'No policies registered in the statutory governance matrix.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty('search-x', 'No matching policies found', 'No policies matched your search or active filter.', `<button class="btn btn-secondary btn-sm" data-a="set" data-k="polStatus" data-v="all">Clear filters</button>`)}</div>`;
  } else {
    body = `<div class="panel" style="overflow-x:auto">${renderPoliciesTable(filtered)}</div>`;
  }

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Policies & Governance Standards</h1>
        <p>Internal compliance policies, board-approved governance standards, and statutory linkages</p>
      </div>
      <div class="acts">
        ${
          needsReviewCount > 0
            ? `<div class="gov-alert-badge" title="Policies requiring review due to statutory amendments">
                ${ic('alert-triangle', 13)}
                <span>${needsReviewCount} require review</span>
              </div>`
            : `<div class="gov-ok-badge">
                ${ic('check-circle', 13)}
                <span>All policies up to date</span>
              </div>`
        }
      </div>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><span class="k">Policies</span><span class="v">${policies.length}</span><span class="d">${activeCount} active standards</span></div>
      <div class="stat"><span class="k">Needs Review</span><span class="v" style="${needsReviewCount ? 'color:var(--amber)' : ''}">${needsReviewCount}</span><span class="d">${needsReviewCount ? 'flagged by law amendments' : 'all standards cleared'}</span></div>
      <div class="stat"><span class="k">Linked Controls</span><span class="v">${totalControlsLinked}</span><span class="d">operational controls</span></div>
      <div class="stat"><span class="k">Statutory Acts</span><span class="v">${distinctStatutes}</span><span class="d">Swedish statutes</span></div>
    </div>

    <div class="row" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="inwrap" style="flex:1;max-width:400px">
        ${ic('search', 13)}
        <input class="input search-sm" id="pol-q" data-in="polQ" placeholder="Search policies by code, title or citation..." value="${esc(u.polQ || '')}" aria-label="Search policies">
        ${u.polQ ? `<button class="pillbtn" data-a="set" data-k="polQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
      </div>
      <div class="seg" role="tablist">
        <button class="${statusFilter === 'all' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="all">All (${policies.length})</button>
        <button class="${statusFilter === 'NEEDS_REVIEW' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="NEEDS_REVIEW">Needs Review (${needsReviewCount})</button>
        <button class="${statusFilter === 'ACTIVE' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="ACTIVE">Active (${activeCount})</button>
        <button class="${statusFilter === 'DRAFT' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="DRAFT">Drafts</button>
      </div>
    </div>

    ${body}
  </div>`;
}

function renderPoliciesTable(policies) {
  return `<table class="gov-table">
      <thead>
        <tr>
          <th style="width:320px">Policy & Code</th>
          <th>Category</th>
          <th>Owner</th>
          <th>Version & Review</th>
          <th>Status</th>
          <th>Linked Statutory Sections</th>
          <th style="text-align:right">Controls</th>
        </tr>
      </thead>
      <tbody>
        ${policies
          .map(p => {
            const isAlert = isPolicyImpacted(p);
            const statusLabel = isAlert ? 'Needs Review' : p.status === 'ACTIVE' ? 'Active' : p.status === 'DRAFT' ? 'Draft' : 'Archived';
            const statusClass = isAlert ? 'gov-status-alert' : p.status === 'ACTIVE' ? 'gov-status-ok' : 'gov-status-draft';

            return `<tr data-a="openGovDrawer" data-type="policy" data-id="${p.id}" title="Open policy details">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(p.code)}</span>
                <span class="trunc" style="max-width:230px">${esc(p.shortTitle || p.title)}</span>
              </div>
              <div class="muted trunc" style="font-size:11.5px;max-width:300px;margin-top:2px">${esc(p.summary)}</div>
            </td>
            <td><span class="faint" style="font-size:12px">${esc(p.category)}</span></td>
            <td>
              <div style="font-size:12px;font-weight:500">${esc(p.owner)}</div>
              <div class="muted" style="font-size:11px">${esc(p.ownerRole || '')}</div>
            </td>
            <td>
              <div class="mono" style="font-size:11.5px">v${esc(p.version)}</div>
              <div class="faint" style="font-size:11px">Reviewed: ${esc(p.lastReviewDate)}</div>
            </td>
            <td>
              <span class="gov-badge ${statusClass}">
                ${isAlert ? ic('alert-triangle', 11) : ic('check', 11)}
                <span>${statusLabel}</span>
              </span>
            </td>
            <td>
              <div class="row" style="gap:4px;flex-wrap:wrap">
                ${(p.statuteSections || [])
                  .map(secId => `<span class="pill mono" style="font-size:10.5px;padding:1px 5px">${formatSecBadge(secId)}</span>`)
                  .join('')}
              </div>
            </td>
            <td style="text-align:right">
              <span class="mono" style="font-size:12px;font-weight:600">${(p.controlIds || []).length} controls</span>
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}
