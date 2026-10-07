/* ---------- CONTROLS MATRIX (Kontrollit & Toimenpiteet) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allControls, policy } from '../core/store.js';

export function pageControls() {
  const u = S.ui;
  const q = (u.ctlQ || '').toLowerCase().trim();
  const filter = u.ctlFilter || 'all'; // 'all', 'DEFICIENT', 'EFFECTIVE', 'AUTOMATED', 'MANUAL'

  const controls = allControls();
  const filtered = controls.filter(c => {
    if (filter === 'DEFICIENT' && c.status !== 'DEFICIENT') return false;
    if (filter === 'EFFECTIVE' && c.status !== 'EFFECTIVE') return false;
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

  const deficientCount = controls.filter(c => c.status === 'DEFICIENT').length;
  const effectiveCount = controls.filter(c => c.status === 'EFFECTIVE').length;

  return `<div class="page flush">
    <div class="gov-page-wrap">
      <div class="gov-page-inner">

        <!-- Header -->
        <header class="gov-header">
          <div class="gov-title-box">
            <h1 style="display:flex;align-items:center;gap:8px">
              ${ic('shield-check', 20)}
              <span>Kontrollit ja suojatoimenpiteet</span>
              <span class="pill" style="font-size:12px;font-weight:600">${controls.length}</span>
            </h1>
            <p>Operatiiviset kontrollit, järjestelmäsuodattimet ja niiden säädöskohtainen toimivuus</p>
          </div>
          ${
            deficientCount > 0
              ? `<div class="gov-alert-badge" title="Lakimuutoksen tai puutteen vuoksi päivitettäviä kontrolleja">
                  ${ic('alert-triangle', 13)}
                  <span>${deficientCount} kontrollia vaatii lakimuutospäivityksen</span>
                </div>`
              : `<div class="gov-ok-badge">
                  ${ic('check-circle', 13)}
                  <span>Kaikki kontrollit toimivia</span>
                </div>`
          }
        </header>

        <!-- Search & Filter Controls -->
        <div class="gov-controls">
          <div class="gov-search-bar">
            <div class="inwrap" style="flex:1">
              ${ic('search', 14)}
              <input class="input" style="height:36px;font-size:13.5px" data-in="ctlQ" placeholder="Etsi kontrollia koodilla, nimellä tai säädöksellä (esim. CTL-ALG, DORA, kill switch)..." value="${esc(u.ctlQ || '')}">
              ${u.ctlQ ? `<button class="pillbtn" data-a="set" data-k="ctlQ" data-v="" style="padding:2px 6px">${ic('x', 12)}Tyhjennä</button>` : ''}
            </div>
          </div>

          <div class="gov-filters-row">
            <div class="gov-filter-pills">
              <button class="finlex-filter-pill ${filter === 'all' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="all">Kaikki (${controls.length})</button>
              <button class="finlex-filter-pill ${filter === 'DEFICIENT' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="DEFICIENT">
                Vaatii päivityksen (${deficientCount})
              </button>
              <button class="finlex-filter-pill ${filter === 'EFFECTIVE' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="EFFECTIVE">
                Toimivat (${effectiveCount})
              </button>
              <button class="finlex-filter-pill ${filter === 'AUTOMATED' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="AUTOMATED">Automaattiset</button>
              <button class="finlex-filter-pill ${filter === 'MANUAL' ? 'on' : ''}" data-a="set" data-k="ctlFilter" data-v="MANUAL">Manuaaliset</button>
            </div>
          </div>
        </div>

        <!-- Table View -->
        ${
          filtered.length === 0
            ? `<div class="empty" style="padding:48px 24px;border:1px dashed var(--border);border-radius:6px;background:var(--surface)">
                ${ic('search-x', 32)}
                <h3 style="margin:12px 0 4px;font-size:16px">Ei hakua vastaavia kontrolleja</h3>
                <p class="muted" style="margin:0 0 16px;font-size:13px">Hakusanalla tai valitulla suodattimella ei löytynyt tuloksia.</p>
                <button class="btn btn-sm btn-ghost" data-a="set" data-k="ctlFilter" data-v="all">${ic('refresh-cw', 13)} Nollaa suodattimet</button>
              </div>`
            : renderControlsTable(filtered)
        }

      </div>
    </div>
  </div>`;
}

function renderControlsTable(controls) {
  return `<div class="gov-table-wrap">
    <table class="gov-table">
      <thead>
        <tr>
          <th style="width:340px">Kontrolli & Koodi</th>
          <th>Tyyppi</th>
          <th>Tila</th>
          <th>Lakimuutosvaikutus</th>
          <th>Liitetty säädöspykalä</th>
          <th>Vastuuhenkilö & Tiheys</th>
          <th style="text-align:right">Käytäntö</th>
        </tr>
      </thead>
      <tbody>
        ${controls
          .map(c => {
            const isDeficient = c.status === 'DEFICIENT';
            const statusLabel = isDeficient ? 'Vaatii päivityksen' : 'Toimiva';
            const statusClass = isDeficient ? 'gov-status-alert' : 'gov-status-ok';
            const p = c.policyId ? policy(c.policyId) : null;

            return `<tr data-a="openGovDrawer" data-type="control" data-id="${c.id}" title="Avaa kontrollin tiedot">
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
                <span>${c.type === 'AUTOMATED' ? 'Automaattinen' : c.type === 'MANUAL' ? 'Manuaalinen' : 'Raportointi'}</span>
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
                c.impactedByAmendment
                  ? `<div class="gov-amendment-pill" title="${esc(c.amendmentAlert || '')}">
                      ${ic('alert-circle', 11)}
                      <span class="mono trunc" style="max-width:140px">${esc(c.impactedByAmendment)}</span>
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
