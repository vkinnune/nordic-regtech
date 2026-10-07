/* ---------- REGULATIONS EXPLORER ---------- */
import { esc, fmtDate } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, proj, task } from '../core/store.js';
import { empty, pIcon, stIcon } from '../ui/helpers.js';
import { REGULATIONS, allRegulations, allTags, regulation } from '../data/regulations.js';

export function pageRegulations() {
  const u = S.ui;
  const q = (u.regQ || '').toLowerCase().trim();
  const typeFilter = u.regType || 'all';
  const tagFilter = u.regTag || null;
  const selId = u.regSel || REGULATIONS[0].id;

  let list = allRegulations().filter(r => {
    if (typeFilter !== 'all') {
      if (typeFilter === 'sfs' && r.type !== 'national_act') return false;
      if (typeFilter === 'eu' && !r.type.startsWith('eu_')) return false;
      if (typeFilter === 'fi' && r.type !== 'supervisory_regulation') return false;
    }
    if (tagFilter) {
      const hasTag = (r.tags || []).includes(tagFilter) || (r.chapters || []).some(ch => (ch.sections || []).some(s => (s.tags || []).includes(tagFilter)));
      if (!hasTag) return false;
    }
    if (q) {
      const matchHeader =
        r.code.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.shortTitle.toLowerCase().includes(q) ||
        r.authority.toLowerCase().includes(q) ||
        (r.tags || []).some(t => t.toLowerCase().includes(q));
      const matchSection = (r.chapters || []).some(ch =>
        (ch.sections || []).some(
          s =>
            s.number.toLowerCase().includes(q) ||
            s.heading.toLowerCase().includes(q) ||
            s.text.toLowerCase().includes(q) ||
            (s.tags || []).some(t => t.toLowerCase().includes(q)),
        ),
      );
      if (!matchHeader && !matchSection) return false;
    }
    return true;
  });

  const cur = regulation(selId) || list[0] || REGULATIONS[0];
  const tags = allTags();

  return `<div class="page flush">
    <div style="display:grid;grid-template-columns:minmax(0,390px) minmax(0,1fr);flex:1;min-height:0" class="reg-grid">
      <style>
        @media(max-width:960px){
          .reg-grid{grid-template-columns:minmax(0,1fr)!important}
          .reg-detail{display:${u.regSel ? 'flex' : 'none'}!important;position:fixed;inset:0;z-index:48;background:var(--surface)}
        }
        .reg-card {
          padding: 14px var(--gutter);
          border-bottom: 1px solid var(--divider);
          cursor: pointer;
          transition: background var(--dur);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .reg-card:hover { background: var(--surface-2); }
        .reg-card.on { background: var(--surface-2); border-left: 3px solid var(--accent); }
        .reg-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: 4px;
          background: var(--surface-3);
          color: var(--text-2);
          cursor: pointer;
        }
        .reg-tag:hover { color: var(--text); background: var(--border); }
        .reg-tag.on { background: var(--accent); color: var(--on-accent); }
        .statute-section {
          padding: 14px 16px;
          border-radius: var(--r);
          background: var(--surface-2);
          border: 1px solid var(--border);
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .statute-section.status-added { border-color: rgba(46, 132, 86, 0.4); background: rgba(46, 132, 86, 0.04); }
        .statute-section.status-deleted { border-color: rgba(217, 70, 70, 0.4); background: rgba(217, 70, 70, 0.04); }
        .statute-section.status-modified { border-color: rgba(200, 138, 20, 0.4); background: rgba(200, 138, 20, 0.04); }
      </style>

      <!-- LEFT COLUMN: Search, Filters, and Regulation List -->
      <div style="border-right:1px solid var(--border);display:flex;flex-direction:column;min-height:0">
        <div style="padding:16px var(--gutter) 8px;display:flex;flex-direction:column;gap:10px">
          <div class="row">
            <h1 style="font-size:var(--fs-xl);margin:0;font-weight:600;letter-spacing:-.015em">Regulations</h1>
            <span class="sp"></span>
            <span class="faint" style="font-size:12px">${list.length} rulebooks</span>
          </div>
          <div class="inwrap">
            ${ic('search', 13)}
            <input class="input search-sm" id="reg-q" data-in="regQ" placeholder="Search laws, articles, tags…" value="${esc(u.regQ || '')}" aria-label="Search regulations">
          </div>
          <div class="seg" role="tablist" style="width:100%">
            ${[
              ['all', 'All'],
              ['sfs', 'Swedish (SFS)'],
              ['eu', 'EU'],
              ['fi', 'FI Code'],
            ]
              .map(
                ([k, n]) =>
                  `<button style="flex:1;justify-content:center" class="${typeFilter === k ? 'on' : ''}" data-a="set" data-k="regType" data-v="${k}">${n}</button>`,
              )
              .join('')}
          </div>
          <div class="row" style="flex-wrap:wrap;gap:4px;max-height:64px;overflow-y:auto">
            ${tagFilter ? `<button class="reg-tag on" data-a="set" data-k="regTag" data-v="">${ic('x', 11)}Clear #${esc(tagFilter)}</button>` : ''}
            ${tags
              .slice(0, 10)
              .map(t => `<button class="reg-tag ${tagFilter === t ? 'on' : ''}" data-a="set" data-k="regTag" data-v="${t}">#${esc(t)}</button>`)
              .join('')}
          </div>
        </div>

        <div style="flex:1;overflow-y:auto" data-keep="reg-list">
          ${
            list.length
              ? list
                  .map(r => {
                    const on = cur && cur.id === r.id;
                    const secCount = (r.chapters || []).reduce((acc, ch) => acc + (ch.sections || []).length, 0);
                    const taskCount = (r.chapters || []).reduce((acc, ch) => acc + (ch.sections || []).filter(s => s.taskId).length, 0);
                    return `<div class="reg-card ${on ? 'on' : ''}" data-a="set" data-k="regSel" data-v="${r.id}" role="button" tabindex="0">
                      <div class="row" style="gap:8px">
                        <span class="mono" style="font-weight:600;font-size:13px;color:var(--text)">${esc(r.code)}</span>
                        ${r.amendedBy ? `<span class="diff-badge diff-modified" style="font-size:9.5px;padding:1px 4px">${esc(r.amendedBy)}</span>` : ''}
                        <span class="sp"></span>
                        <span class="badge ${r.status === 'In force' ? 'green' : 'amber'}" style="font-size:10px">${esc(r.status)}</span>
                      </div>
                      <div style="font-size:13px;font-weight:500;line-height:1.4;color:var(--text)">${esc(r.title)}</div>
                      <div class="row" style="gap:6px;font-size:11.5px;color:var(--text-3)">
                        <span>${esc(r.authority)}</span>
                        <span>·</span>
                        <span>${secCount} sections</span>
                        ${taskCount ? `<span>·</span><span class="row" style="gap:3px;color:var(--accent)">${ic('circle-check', 11)}<b>${taskCount}</b> linked</span>` : ''}
                      </div>
                      <div class="row" style="flex-wrap:wrap;gap:4px;margin-top:2px">
                        ${(r.tags || []).map(t => `<span class="reg-tag" data-a="set" data-k="regTag" data-v="${t}">#${esc(t)}</span>`).join('')}
                      </div>
                    </div>`;
                  })
                  .join('')
              : empty(
                  'book-x',
                  'No regulations found',
                  'Try adjusting your search terms or filters.',
                  `<button class="btn btn-secondary btn-sm" data-a="set" data-k="regQ" data-v="">Clear search</button>`,
                  'sm',
                )
          }
        </div>
      </div>

      <!-- RIGHT PANE: Statutory Section Reader & Inspector -->
      <div class="reg-detail" style="display:flex;flex-direction:column;min-height:0;overflow-y:auto;padding:24px 32px">
        ${
          cur
            ? renderRegulationDetail(cur)
            : `<div class="fullstate"><div class="empty-state">${ic('scale', 24)}<h2>Select a regulation</h2><p>Explore statutory chapters, sections, and cross-references.</p></div></div>`
        }
      </div>
    </div>
  </div>`;
}

function renderRegulationDetail(r) {
  const p = r.projectId ? proj(r.projectId) : null;
  const totalSections = (r.chapters || []).reduce((acc, ch) => acc + (ch.sections || []).length, 0);

  return `
    <!-- Header -->
    <div style="margin-bottom:20px;border-bottom:1px solid var(--border);padding-bottom:18px">
      <div class="row" style="margin-bottom:8px;gap:8px">
        <button class="btn btn-sm btn-ghost hide-d" data-a="set" data-k="regSel" data-v="" style="margin-left:-8px">${ic('arrow-left', 14)}All regulations</button>
        <span class="badge indigo mono" style="font-size:12px;padding:2px 8px">${esc(r.code)}</span>
        ${r.amendedBy ? `<span class="diff-badge diff-modified">Amended by ${esc(r.amendedBy)}</span>` : ''}
        <span class="sp"></span>
        ${
          p
            ? `<button class="btn btn-secondary btn-sm" data-a="go" data-r="project" data-id="${p.id}" data-tab="overview">
                ${pIcon(p, '', 13)}Open project board
               </button>`
            : ''
        }
      </div>
      <h2 style="font-size:24px;font-weight:600;letter-spacing:-.02em;margin:0 0 8px">${esc(r.title)}</h2>
      <p style="font-size:14px;line-height:1.6;color:var(--text-2);margin:0 0 14px">${esc(r.summary)}</p>

      <div class="row" style="flex-wrap:wrap;gap:12px;font-size:12.5px;color:var(--text-2)">
        <span class="row" style="gap:5px">${ic('landmark', 13)}<span>Authority: <b>${esc(r.authority)}</b></span></span>
        <span>·</span>
        <span class="row" style="gap:5px">${ic('globe', 13)}<span>Jurisdiction: <b>${esc(r.jurisdiction)}</b></span></span>
        <span>·</span>
        <span class="row" style="gap:5px">${ic('calendar', 13)}<span>In force: <b>${fmtDate(r.inForce, true)}</b></span></span>
      </div>

      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:12px">
        ${(r.tags || []).map(t => `<button class="reg-tag" data-a="set" data-k="regTag" data-v="${t}">#${esc(t)}</button>`).join('')}
      </div>
    </div>

    <!-- Chapter & Section Outline -->
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="row">
        <h3 style="font-size:16px;font-weight:600;margin:0">Statutory index & sections</h3>
        <span class="sp"></span>
        <span class="faint" style="font-size:12px">${totalSections} sections</span>
      </div>

      ${(r.chapters || [])
        .map(
          ch => `
        <div class="reg-chapter" style="display:flex;flex-direction:column;gap:8px">
          <div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--divider)">
            <span class="mono" style="font-weight:600;color:var(--accent);font-size:13px">${esc(ch.number)}</span>
            <b style="font-size:14px;color:var(--text)">${esc(ch.title)}</b>
            <span class="sp"></span>
            <span class="faint" style="font-size:12px">${(ch.sections || []).length} sections</span>
          </div>

          <div style="display:flex;flex-direction:column;gap:10px;padding-top:4px">
            ${(ch.sections || []).map(s => renderSectionCard(s)).join('')}
          </div>
        </div>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderSectionCard(s) {
  const t = s.taskId ? task(s.taskId) : null;
  const statusCls = s.status ? `status-${s.status.toLowerCase()}` : '';

  return `<div class="statute-section ${statusCls}" id="sec-${s.id}">
    <div class="row" style="gap:8px;align-items:flex-start">
      <span class="mono" style="font-weight:600;font-size:13.5px;color:var(--text)">${esc(s.number)}</span>
      <b style="font-size:13.5px;color:var(--text)">${esc(s.heading)}</b>
      ${
        s.status && s.status !== 'UNCHANGED'
          ? `<span class="diff-badge diff-${s.status.toLowerCase()}" style="font-size:9.5px;padding:1px 5px">${s.status} ${s.amendingAct ? '(' + esc(s.amendingAct) + ')' : ''}</span>`
          : ''
      }
      <span class="sp"></span>
      ${
        t
          ? `<button class="pillbtn" data-a="openTask" data-id="${t.id}" style="font-size:11.5px;padding:2px 8px;gap:5px" title="Inspect task & statutory diff">
              ${stIcon(t.status, 11)}
              <span class="mono">${t.key}</span>
              ${t.diff ? `<span class="diff-badge diff-${t.diff.status.toLowerCase()}" style="font-size:8.5px;padding:0 3px">Diff</span>` : ''}
             </button>`
          : ''
      }
    </div>

    <div style="font-size:13px;line-height:1.65;color:var(--text-2);font-family:var(--font-sans)">
      ${esc(s.text)}
    </div>

    ${
      (s.crossRefs && s.crossRefs.length) || (s.tags && s.tags.length)
        ? `<div class="row" style="flex-wrap:wrap;gap:8px;padding-top:4px;border-top:1px dashed var(--border)">
            ${(s.crossRefs || [])
              .map(
                cr => `
              <button class="pillbtn" data-a="set" data-k="regSel" data-v="${cr.regId}" style="font-size:11px;padding:2px 7px;gap:4px;color:var(--accent)" title="Jump to regulation">
                ${ic('link-2', 11)}Ref: ${esc(cr.label)}
              </button>
            `,
              )
              .join('')}
            ${(s.tags || [])
              .map(
                tg => `
              <button class="reg-tag" data-a="set" data-k="regTag" data-v="${tg}" style="font-size:10.5px">#${esc(tg)}</button>
            `,
              )
              .join('')}
          </div>`
        : ''
    }
  </div>`;
}
