/* ---------- RISKS REGISTER (Regulatory Risks & Sanctions) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allRisks, riskGapStatus, riskExposureScore, riskControls } from '../core/store.js';
import { empty, formatSecBadge, progBar } from '../ui/helpers.js';

export function pageRisks() {
  const u = S.ui;
  const q = (u.rskQ || '').toLowerCase().trim();
  const filter = u.rskFilter || 'all'; // 'all', 'CRITICAL', 'HIGH', 'MEDIUM', 'OPEN_GAPS'

  const risks = allRisks();
  const filtered = risks.filter(r => {
    const gap = riskGapStatus(r);
    if (filter === 'CRITICAL' && r.severity !== 'CRITICAL') return false;
    if (filter === 'HIGH' && r.severity !== 'HIGH') return false;
    if (filter === 'MEDIUM' && r.severity !== 'MEDIUM') return false;
    if (filter === 'OPEN_GAPS' && gap !== 'OPEN_GAPS') return false;

    if (q) {
      const matchCode = r.code.toLowerCase().includes(q);
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchAuth = r.authority && r.authority.toLowerCase().includes(q);
      const matchCons = r.consequence && r.consequence.toLowerCase().includes(q);
      const matchCat = r.category && r.category.toLowerCase().includes(q);
      const matchGap = r.gapSummary && r.gapSummary.toLowerCase().includes(q);
      const matchSec = (r.statuteSections || []).some(s => s.toLowerCase().includes(q));
      if (!matchCode && !matchTitle && !matchAuth && !matchCons && !matchCat && !matchGap && !matchSec) {
        return false;
      }
    }
    return true;
  });

  const gapCount = risks.filter(r => riskGapStatus(r) === 'OPEN_GAPS').length;
  const criticalCount = risks.filter(r => r.severity === 'CRITICAL').length;
  const highCount = risks.filter(r => r.severity === 'HIGH').length;
  const avgExposure = Math.round(risks.reduce((sum, r) => sum + riskExposureScore(r), 0) / Math.max(risks.length, 1));

  let body;
  if (!risks.length) {
    body = `<div class="panel">${empty('alert-triangle', 'No risks found', 'No regulatory risks registered in the matrix.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty('search-x', 'No matching risks found', 'No risks matched your search or active filter.', `<button class="btn btn-secondary btn-sm" data-a="set" data-k="rskFilter" data-v="all">Clear filters</button>`)}</div>`;
  } else {
    body = `<div class="panel" style="overflow-x:auto">${renderRisksTable(filtered)}</div>`;
  }

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Regulatory Risks & Sanctions</h1>
        <p>Supervisory sanctions, financial penalty exposures, and operational control coverage</p>
      </div>
      <div class="acts">
        ${
          gapCount > 0
            ? `<div class="gov-alert-badge" title="Risks with open compliance gaps requiring mitigation">
                ${ic('alert-triangle', 13)}
                <span>${gapCount} open gaps</span>
              </div>`
            : `<div class="gov-ok-badge">
                ${ic('check-circle', 13)}
                <span>All risks mitigated</span>
              </div>`
        }
      </div>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><span class="k">Regulatory Risks</span><span class="v">${risks.length}</span><span class="d">${criticalCount + highCount} high or critical</span></div>
      <div class="stat"><span class="k">Open Gaps</span><span class="v" style="${gapCount ? 'color:var(--amber)' : ''}">${gapCount}</span><span class="d">${gapCount ? 'requiring mitigation' : 'all gaps closed'}</span></div>
      <div class="stat"><span class="k">Critical Severity</span><span class="v" style="${criticalCount ? 'color:var(--red)' : ''}">${criticalCount}</span><span class="d">supervisory sanctions</span></div>
      <div class="stat"><span class="k">Avg Exposure</span><span class="v">${avgExposure}/100</span><span class="d">aggregate risk index</span></div>
    </div>

    <div class="row" style="margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <div class="inwrap" style="flex:1;max-width:400px">
        ${ic('search', 13)}
        <input class="input search-sm" id="rsk-q" data-in="rskQ" placeholder="Search risks by code, title, authority or penalty..." value="${esc(u.rskQ || '')}" aria-label="Search risks">
        ${u.rskQ ? `<button class="pillbtn" data-a="set" data-k="rskQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
      </div>
      <div class="seg" role="tablist">
        <button class="${filter === 'all' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="all">All (${risks.length})</button>
        <button class="${filter === 'OPEN_GAPS' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="OPEN_GAPS">Open Gaps (${gapCount})</button>
        <button class="${filter === 'CRITICAL' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="CRITICAL">Critical (${criticalCount})</button>
        <button class="${filter === 'HIGH' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="HIGH">High Risk</button>
        <button class="${filter === 'MEDIUM' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="MEDIUM">Medium</button>
      </div>
    </div>

    ${body}
  </div>`;
}

function renderRisksTable(risks) {
  return `<table class="gov-table">
      <thead>
        <tr>
          <th style="width:340px">Risk & Code</th>
          <th>Supervisory Authority</th>
          <th>Severity</th>
          <th style="width:160px">Exposure</th>
          <th>Gap Status</th>
          <th>Linked Statutes</th>
          <th style="text-align:right">Controls</th>
        </tr>
      </thead>
      <tbody>
        ${risks
          .map(r => {
            const gap = riskGapStatus(r);
            const hasGap = gap === 'OPEN_GAPS';
            const expScore = riskExposureScore(r);
            const ctls = riskControls(r);
            const sevClass = r.severity === 'CRITICAL' ? 'gov-status-critical' : r.severity === 'HIGH' ? 'gov-status-high' : 'gov-status-med';
            const sevLabel = r.severity === 'CRITICAL' ? 'Critical' : r.severity === 'HIGH' ? 'High' : 'Medium';

            return `<tr data-a="openGovDrawer" data-type="risk" data-id="${r.id}" title="Open risk details">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(r.code)}</span>
                <span class="trunc" style="max-width:240px">${esc(r.title)}</span>
              </div>
              <div class="muted trunc" style="font-size:11.5px;max-width:320px;margin-top:2px">${esc(r.consequence)}</div>
            </td>
            <td><span class="faint" style="font-size:12px">${esc(r.authority)}</span></td>
            <td>
              <span class="gov-badge ${sevClass}">
                ${ic('alert-octagon', 11)}
                <span>${sevLabel}</span>
              </span>
            </td>
            <td>
              <div class="row" style="gap:8px;min-width:130px">
                ${progBar(expScore, expScore > 60 ? 'red' : expScore > 35 ? 'amber' : 'green')}
                <span class="mono" style="font-size:11.5px;font-weight:600;width:48px">${expScore}/100</span>
              </div>
            </td>
            <td>
              ${
                hasGap
                  ? `<div class="gov-badge gov-status-alert" title="${esc(r.gapSummary || '')}">
                      ${ic('alert-triangle', 11)}
                      <span>Open Gap</span>
                    </div>`
                  : `<div class="gov-badge gov-status-ok">
                      ${ic('check', 11)}
                      <span>Covered</span>
                    </div>`
              }
            </td>
            <td>
              <div class="row" style="gap:4px;flex-wrap:wrap">
                ${(r.statuteSections || [])
                  .map(secId => `<span class="pill mono" style="font-size:10.5px;padding:1px 5px">${formatSecBadge(secId)}</span>`)
                  .join('')}
              </div>
            </td>
            <td style="text-align:right">
              <span class="mono" style="font-size:12px;font-weight:600">${ctls.length} controls</span>
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}
