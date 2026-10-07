/* ---------- RISKS REGISTER (Compliance- ja säädösriskit) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allRisks } from '../core/store.js';

export function pageRisks() {
  const u = S.ui;
  const q = (u.rskQ || '').toLowerCase().trim();
  const filter = u.rskFilter || 'all'; // 'all', 'CRITICAL', 'HIGH', 'MEDIUM', 'OPEN_GAPS'

  const risks = allRisks();
  const filtered = risks.filter(r => {
    if (filter === 'CRITICAL' && r.severity !== 'CRITICAL') return false;
    if (filter === 'HIGH' && r.severity !== 'HIGH') return false;
    if (filter === 'MEDIUM' && r.severity !== 'MEDIUM') return false;
    if (filter === 'OPEN_GAPS' && r.gapStatus !== 'OPEN_GAPS') return false;

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

  const gapCount = risks.filter(r => r.gapStatus === 'OPEN_GAPS').length;
  const criticalCount = risks.filter(r => r.severity === 'CRITICAL').length;

  return `<div class="page flush">
    <div class="gov-page-wrap">
      <div class="gov-page-inner">

        <!-- Header -->
        <header class="gov-header">
          <div class="gov-title-box">
            <h1 style="display:flex;align-items:center;gap:8px">
              ${ic('alert-triangle', 20)}
              <span>Säädösriskit ja seuraamusrekisteri</span>
              <span class="pill" style="font-size:12px;font-weight:600">${risks.length}</span>
            </h1>
            <p>Viranomaismääräysten noudattamatta jättämisestä aiheutuvat sanktiot, taloudelliset riskit ja kontrollikattavuus</p>
          </div>
          ${
            gapCount > 0
              ? `<div class="gov-alert-badge" title="Riskikohteita joissa on avoimia kontrollikuiluja">
                  ${ic('alert-triangle', 13)}
                  <span>${gapCount} riskissä avoin kontrollikuilu</span>
                </div>`
              : `<div class="gov-ok-badge">
                  ${ic('check-circle', 13)}
                  <span>Kaikki riskit katettu</span>
                </div>`
          }
        </header>

        <!-- Search & Filter Controls -->
        <div class="gov-controls">
          <div class="gov-search-bar">
            <div class="inwrap" style="flex:1">
              ${ic('search', 14)}
              <input class="input" style="height:36px;font-size:13.5px" data-in="rskQ" placeholder="Etsi riskiä koodilla, nimellä tai viranomaisella (esim. RSK-ALG, FIN-FSA, sakko)..." value="${esc(u.rskQ || '')}">
              ${u.rskQ ? `<button class="pillbtn" data-a="set" data-k="rskQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Tyhjennä</button>` : ''}
            </div>
          </div>

          <div class="gov-filters-row">
            <div class="gov-filter-pills">
              <button class="finlex-filter-pill ${filter === 'all' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="all">Kaikki (${risks.length})</button>
              <button class="finlex-filter-pill ${filter === 'OPEN_GAPS' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="OPEN_GAPS">
                Avoimet kuilut (${gapCount})
              </button>
              <button class="finlex-filter-pill ${filter === 'CRITICAL' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="CRITICAL">
                Kriittiset (${criticalCount})
              </button>
              <button class="finlex-filter-pill ${filter === 'HIGH' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="HIGH">Korkea riski</button>
              <button class="finlex-filter-pill ${filter === 'MEDIUM' ? 'on' : ''}" data-a="set" data-k="rskFilter" data-v="MEDIUM">Kohtalainen</button>
            </div>
          </div>
        </div>

        <!-- Table View -->
        ${
          filtered.length === 0
            ? `<div class="empty" style="padding:48px 24px;border:1px dashed var(--border);border-radius:6px;background:var(--surface)">
                ${ic('search-x', 32)}
                <h3 style="margin:12px 0 4px;font-size:16px">Ei hakua vastaavia riskejä</h3>
                <p class="muted" style="margin:0 0 16px;font-size:13px">Hakusanalla tai valitulla suodattimella ei löytynyt tuloksia.</p>
                <button class="btn btn-sm btn-ghost" data-a="set" data-k="rskFilter" data-v="all">${ic('refresh-cw', 13)} Nollaa suodattimet</button>
              </div>`
            : renderRisksTable(filtered)
        }

      </div>
    </div>
  </div>`;
}

function renderRisksTable(risks) {
  return `<div class="gov-table-wrap">
    <table class="gov-table">
      <thead>
        <tr>
          <th style="width:340px">Riski & Koodi</th>
          <th>Valvova viranomainen</th>
          <th>Vakavuus</th>
          <th>Altistus</th>
          <th>Kuilutilanne</th>
          <th>Liitetyt säädökset</th>
          <th style="text-align:right">Kontrollit</th>
        </tr>
      </thead>
      <tbody>
        ${risks
          .map(r => {
            const hasGap = r.gapStatus === 'OPEN_GAPS';
            const sevClass = r.severity === 'CRITICAL' ? 'gov-status-critical' : r.severity === 'HIGH' ? 'gov-status-high' : 'gov-status-med';
            const sevLabel = r.severity === 'CRITICAL' ? 'Kriittinen' : r.severity === 'HIGH' ? 'Korkea' : 'Kohtalainen';

            return `<tr data-a="openGovDrawer" data-type="risk" data-id="${r.id}" title="Avaa riskin tiedot">
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
              <div style="display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:12px;font-weight:600">${r.exposureScore}/100</span>
                <span class="muted" style="font-size:11px">(${esc(r.likelihood)})</span>
              </div>
            </td>
            <td>
              ${
                hasGap
                  ? `<div class="gov-badge gov-status-alert" title="${esc(r.gapSummary || '')}">
                      ${ic('alert-triangle', 11)}
                      <span>Avoin kuilu</span>
                    </div>`
                  : `<div class="gov-badge gov-status-ok">
                      ${ic('check', 11)}
                      <span>Katettu</span>
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
              <span class="mono" style="font-size:12px;font-weight:600">${(r.controlIds || []).length} kpl</span>
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  </div>`;
}

function formatSecBadge(secId) {
  if (secId.startsWith('finlex-')) {
    const parts = secId.replace('finlex-', '').split('-');
    return `747/2012 ${parts[0]}:${parts[1]} §`;
  }
  if (secId.startsWith('sfs-')) {
    const parts = secId.replace('sfs-', '').split('-');
    return `SFS ${parts[0]}:${parts[1]} §`;
  }
  if (secId.startsWith('dora-')) {
    return `DORA Art. ${secId.replace('dora-', '')}`;
  }
  if (secId.startsWith('aml-')) {
    const parts = secId.replace('aml-', '').split('-');
    return `AML 444/2017 ${parts[0]}:${parts[1]} §`;
  }
  return secId;
}
