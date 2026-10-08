/* ---------- POLICIES REGISTRY (Governance Policies & Standards) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allPolicies } from '../core/store.js';
import { formatSecBadge } from '../ui/helpers.js';

export function pagePolicies() {
  const u = S.ui;
  const q = (u.polQ || '').toLowerCase().trim();
  const statusFilter = u.polStatus || 'all'; // 'all', 'NEEDS_REVIEW', 'ACTIVE', 'DRAFT'

  const policies = allPolicies();
  const filtered = policies.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
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

  const needsReviewCount = policies.filter(p => p.status === 'NEEDS_REVIEW').length;

  return `<div class="page flush">
    <div class="gov-page-wrap">
      <div class="gov-page-inner">

        <!-- Header -->
        <header class="gov-header">
          <div class="gov-title-box">
            <h1 style="display:flex;align-items:center;gap:8px">
              ${ic('file-text', 20)}
              <span>Policies & Governance Standards</span>
              <span class="pill" style="font-size:12px;font-weight:600">${policies.length}</span>
            </h1>
            <p>Internal compliance policies, board-approved governance standards, and statutory linkages</p>
          </div>
          ${
            needsReviewCount > 0
              ? `<div class="gov-alert-badge" title="Policies requiring review due to statutory amendments">
                  ${ic('alert-triangle', 13)}
                  <span>${needsReviewCount} policies require statutory review</span>
                </div>`
              : ''
          }
        </header>

        <!-- Search & Filter Controls -->
        <div class="gov-controls">
          <div class="gov-search-bar">
            <div class="inwrap" style="flex:1">
              ${ic('search', 14)}
              <input class="input" style="height:36px;font-size:13.5px" data-in="polQ" placeholder="Search policies by code, title or statutory citation (e.g. POL-ALG, DORA, KYC)..." value="${esc(u.polQ || '')}">
              ${u.polQ ? `<button class="pillbtn" data-a="set" data-k="polQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
            </div>
          </div>

          <div class="gov-filters-row">
            <div class="gov-filter-pills">
              <button class="finlex-filter-pill ${statusFilter === 'all' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="all">All (${policies.length})</button>
              <button class="finlex-filter-pill ${statusFilter === 'NEEDS_REVIEW' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="NEEDS_REVIEW">
                Needs Review (${needsReviewCount})
              </button>
              <button class="finlex-filter-pill ${statusFilter === 'ACTIVE' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="ACTIVE">Active</button>
              <button class="finlex-filter-pill ${statusFilter === 'DRAFT' ? 'on' : ''}" data-a="set" data-k="polStatus" data-v="DRAFT">Drafts</button>
            </div>
          </div>
        </div>

        <!-- Table View -->
        ${
          filtered.length === 0
            ? `<div class="empty" style="padding:48px 24px;border:1px dashed var(--border);border-radius:6px;background:var(--surface)">
                ${ic('search-x', 32)}
                <h3 style="margin:12px 0 4px;font-size:16px">No matching policies found</h3>
                <p class="muted" style="margin:0 0 16px;font-size:13px">No policies matched the search query or active filter.</p>
                <button class="btn btn-sm btn-ghost" data-a="set" data-k="polStatus" data-v="all">${ic('refresh-cw', 13)} Reset filters</button>
              </div>`
            : renderPoliciesTable(filtered)
        }

      </div>
    </div>
  </div>`;
}

function renderPoliciesTable(policies) {
  return `<div class="gov-table-wrap">
    <table class="gov-table">
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
            const isAlert = p.status === 'NEEDS_REVIEW';
            const statusLabel = p.status === 'NEEDS_REVIEW' ? 'Needs Review' : p.status === 'ACTIVE' ? 'Active' : p.status === 'DRAFT' ? 'Draft' : 'Archived';
            const statusClass = p.status === 'NEEDS_REVIEW' ? 'gov-status-alert' : p.status === 'ACTIVE' ? 'gov-status-ok' : 'gov-status-draft';

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
    </table>
  </div>`;
}
