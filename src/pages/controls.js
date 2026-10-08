import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allControls, policy, isControlImpacted, sectionOf, isSectionAmended } from '../core/store.js';
import { empty, formatSecBadge } from '../ui/helpers.js';

export function pageControls() {
  const u = S.ui;
  const q = (u.ctlQ || '').toLowerCase().trim();
  const filter = u.ctlFilter || 'all'; // 'all', 'DEFICIENT', 'EFFECTIVE', 'AUTOMATED', 'MANUAL'

  const controls = allControls();
  const filtered = controls.filter(c => {
    if (filter === 'DEFICIENT' && !isControlImpacted(c)) return false;
    if (filter === 'EFFECTIVE' && isControlImpacted(c)) return false;
    if (filter === 'AUTOMATED' && c.type !== 'AUTOMATED') return false;
    if (filter === 'MANUAL' && c.type !== 'MANUAL') return false;

    if (q) {
      const matchCode = c.code.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchOwner = c.owner && c.owner.toLowerCase().includes(q);
      const matchCat = c.category && c.category.toLowerCase().includes(q);
      const matchSpec = c.specification && c.specification.toLowerCase().includes(q);
      const matchAlert = c.impactedByAmendment && c.impactedByAmendment.toLowerCase().includes(q);
      const matchSec = (c.statuteSections || []).some(s => s.toLowerCase().includes(q));
      if (!matchCode && !matchTitle && !matchOwner && !matchCat && !matchSpec && !matchAlert && !matchSec) {
        return false;
      }
    }
    return true;
  });

  const deficientCount = controls.filter(isControlImpacted).length;
  const effectiveCount = controls.filter(c => !isControlImpacted(c)).length;
  const automatedCount = controls.filter(c => c.type === 'AUTOMATED').length;
  const automatedPct = Math.round((automatedCount / Math.max(controls.length, 1)) * 100);
  const distinctRisks = new Set(controls.flatMap(c => (Array.isArray(c.riskIds) ? c.riskIds : c.riskId ? [c.riskId] : [])).filter(Boolean)).size;

  let body;
  if (!controls.length) {
    body = `<div class="panel">${empty('shield-check', 'No controls found', 'No controls registered in the governance matrix.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty('search-x', 'No matching controls found', 'No controls matched your search or active filter.', `<button class="btn btn-secondary btn-sm" data-a="set" data-k="ctlFilter" data-v="all">Clear filters</button>`)}</div>`;
  } else {
    body = `<div class="panel" style="overflow-x:auto">${renderControlsTable(filtered)}</div>`;
  }

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Controls & Safeguards Matrix</h1>
        <p>Operational safeguards, automated system filters, and statutory compliance health</p>
      </div>
      <div class="acts">
        ${
          deficientCount > 0
            ? `<div class="gov-alert-badge" title="Controls requiring updates due to statutory amendments or deficiencies">
                ${ic('alert-triangle', 13)}
                <span>${deficientCount} require update</span>
              </div>`
            : `<div class="gov-ok-badge">
                ${ic('check-circle', 13)}
                <span>All controls effective</span>
              </div>`
        }
      </div>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><span class="k">Controls</span><span class="v">${controls.length}</span><span class="d">${effectiveCount} operational safeguards</span></div>
      <div class="stat"><span class="k">Needs Update</span><span class="v" style="${deficientCount ? 'color:var(--amber)' : ''}">${deficientCount}</span><span class="d">${deficientCount ? 'impacted by amendments' : 'zero deficiencies'}</span></div>
      <div class="stat"><span class="k">Automated</span><span class="v">${automatedPct}%</span><span class="d">${automatedCount} automated system filters</span></div>
      <div class="stat"><span class="k">Mitigated Risks</span><span class="v">${distinctRisks}</span><span class="d">regulatory risk categories</span></div>
    </div>

    <div class="row" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="inwrap" style="flex:1;max-width:400px">
        ${ic('search', 13)}
        <input class="input search-sm" id="ctl-q" data-in="ctlQ" placeholder="Search controls by code, title or citation..." value="${esc(u.ctlQ || '')}" aria-label="Search controls">
        ${u.ctlQ ? `<button class="pillbtn" data-a="set" data-k="ctlQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
      </div>
      <div class="seg" role="tablist">
        <button class="${filter === 'all' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="all">All (${controls.length})</button>
        <button class="${filter === 'DEFICIENT' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="DEFICIENT">Needs Update (${deficientCount})</button>
        <button class="${filter === 'EFFECTIVE' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="EFFECTIVE">Effective (${effectiveCount})</button>
        <button class="${filter === 'AUTOMATED' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="AUTOMATED">Automated</button>
        <button class="${filter === 'MANUAL' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="MANUAL">Manual</button>
      </div>
    </div>

    ${body}
  </div>`;
}

function renderControlsTable(controls) {
  return `<table class="gov-table">
      <thead>
        <tr>
          <th style="width:340px">Control & Code</th>
          <th>Type</th>
          <th>Health & Status</th>
          <th>Statutory Impact</th>
          <th>Linked Section</th>
          <th>Owner & Frequency</th>
          <th style="text-align:right">Policy</th>
        </tr>
      </thead>
      <tbody>
        ${controls
          .map(c => {
            const isDeficient = isControlImpacted(c);
            const statusLabel = isDeficient ? 'Needs Update' : 'Effective';
            const statusClass = isDeficient ? 'gov-status-alert' : 'gov-status-ok';
            const p = c.policyId ? policy(c.policyId) : null;
            const impactedSec = (c.statuteSections || []).map(sectionOf).find(isSectionAmended);
            const amendBadge = c.impactedByAmendment || (impactedSec ? impactedSec.amendingAct || 'Amended' : null);

            return `<tr data-a="openGovDrawer" data-type="control" data-id="${c.id}" title="Open control details">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(c.code)}</span>
                <span class="trunc" style="max-width:240px">${esc(c.title)}</span>
              </div>
              <div class="muted trunc" style="font-size:11.5px;max-width:320px;margin-top:2px">${esc(c.specification)}</div>
            </td>
            <td>
              <span class="pill" style="font-size:11px">
                ${c.type === 'AUTOMATED' ? ic('cpu', 11) : c.type === 'MANUAL' ? ic('user', 11) : ic('file-text', 11)}
                <span>${c.type === 'AUTOMATED' ? 'Automated' : c.type === 'MANUAL' ? 'Manual' : 'Reporting'}</span>
              </span>
            </td>
            <td>
              <span class="gov-badge ${statusClass}">
                ${isDeficient ? ic('alert-triangle', 11) : ic('check', 11)}
                <span>${statusLabel}</span>
              </span>
            </td>
            <td>
              ${
                amendBadge
                  ? `<div class="gov-amendment-pill" title="${esc(c.amendmentAlert || (impactedSec ? `${impactedSec.number} amended by ${impactedSec.amendingAct || 'statutory diff'}` : 'Statutory amendment'))}">
                      ${ic('alert-circle', 11)}
                      <span class="mono trunc" style="max-width:140px">${esc(amendBadge)}</span>
                    </div>`
                  : `<span class="faint mono" style="font-size:11px">—</span>`
              }
            </td>
            <td>
              <div class="row" style="gap:4px;flex-wrap:wrap">
                ${(c.statuteSections || [])
                  .map(secId => `<span class="pill mono" style="font-size:10.5px;padding:1px 5px">${formatSecBadge(secId)}</span>`)
                  .join('')}
              </div>
            </td>
            <td>
              <div style="font-size:12px;font-weight:500">${esc(c.owner)}</div>
              <div class="muted" style="font-size:11px">${esc(c.frequency)}</div>
            </td>
            <td style="text-align:right">
              ${p ? `<span class="mono faint" style="font-size:11.5px" title="${esc(p.title)}">${esc(p.code)}</span>` : `<span class="faint">—</span>`}
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}
