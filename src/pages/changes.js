/* ---------- REGULATORY CHANGES & AMENDMENT CALENDAR & FEED ---------- */
import { MON, MONL, TODAY, WD, addD, diffD, esc, fmtDate, iso, parse, sod } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allChanges, formatChangeSecLabel } from '../core/store.js';
import { empty } from '../ui/helpers.js';
import { changeBadgeHtml, diffAccordionHtml } from '../ui/diff.js';

function startOfWeek(d, ws = 1) {
  const x = sod(d);
  const diff = (x.getDay() - ws + 7) % 7;
  return addD(x, -diff);
}

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

function getChangeDate(e) {
  return e.amendedDate || (e.fetchedAt ? e.fetchedAt.slice(0, 10) : iso(TODAY));
}

function getMilestones(events) {
  const map = new Map();
  for (const e of events) {
    const ds = getChangeDate(e);
    if (!ds) continue;
    const ym = ds.slice(0, 7);
    map.set(ym, (map.get(ym) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, count]) => {
      const [y, m] = ym.split('-').map(Number);
      return {
        key: ym,
        date: `${ym}-01`,
        label: `${MON[m - 1]} ${y}`,
        count,
      };
    });
}

export function pageChanges() {
  const u = S.ui;
  const view = u.changesView || 'calendar'; // 'calendar' | 'feed' | 'table'
  const sourceFilter = u.changesSource || 'all'; // 'all', 'riksdagen', 'fffs'
  const statusFilter = u.changesStatus || 'all'; // 'all', 'MODIFIED', 'ADDED', 'REPEALED'
  const calMode = u.changesCalMode || 'month'; // 'month' | 'week'
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
      const matchText =
        `${e.code || ''} ${e.title || ''} ${e.amendingAct || ''} ${e.chapter || ''} ${e.section || ''} ${e.oldText || ''} ${e.newText || ''} ${getChangeDate(e)}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  // Calendar dates setup
  const cur = parse(u.changesCalDate || iso(TODAY));
  const curYm = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
  const milestones = getMilestones(filtered);

  // Group items by exact in-force date
  const byDate = new Map();
  filtered.forEach(e => {
    const ds = getChangeDate(e);
    if (!byDate.has(ds)) byDate.set(ds, []);
    byDate.get(ds).push(e);
  });

  const itemsOn = ds => byDate.get(ds) || [];

  // Sub-renderers
  let bodyContent = '';

  if (!events.length) {
    bodyContent = `<div class="panel" style="margin:24px var(--gutter)">${empty(
      'history',
      'No changes recorded yet',
      'Changes are recorded each time regtech fetch discovers new amendments, new wordings, or repeals in Swedish financial law.',
    )}</div>`;
  } else if (!filtered.length) {
    bodyContent = `<div class="panel" style="margin:24px var(--gutter)">${empty(
      'search-x',
      'No matching regulatory changes',
      'Try adjusting your search query, legislative source, or status filter.',
      `<button class="btn btn-secondary btn-sm" data-a="clearChangesFilters">${ic('rotate-ccw', 13)} Reset filters</button>`,
    )}</div>`;
  } else if (view === 'calendar') {
    // -------------------------------------------------------------------
    // CALENDAR VIEW (MONTH / WEEK)
    // -------------------------------------------------------------------
    const chip = e => {
      const isMod = e.status === 'MODIFIED';
      const isAdd = e.status === 'ADDED';
      const statusColor = isMod ? 'var(--amber)' : isAdd ? 'var(--green)' : 'var(--red)';
      const statusCls = isMod ? 'is-mod' : isAdd ? 'is-add' : 'is-rep';
      const tag = isMod ? 'Mod' : isAdd ? 'Add' : 'Rep';
      const secLabel = e.level === 'document' ? 'Doc' : `${e.chapter ? `${esc(e.chapter)}:` : ''}${esc(e.section || '')} §`;
      const tooltip = `${esc(e.code)} ${secLabel}: ${e.status} ${e.amendingAct ? `by ${esc(e.amendingAct)}` : ''} · in force ${getChangeDate(e)}`;

      return `<button class="cev cev-change ${statusCls}" style="--c:${statusColor}" data-a="openChangeDrawer" data-id="${e.id}" title="${tooltip}">
        <span class="pdot" style="--c:${statusColor}"></span>
        <span class="status-tag">${tag}</span>
        <span class="trunc"><b>${esc(e.code)}</b> ${secLabel}</span>
      </button>`;
    };

    let calBody;
    let label;

    if (calMode === 'month') {
      label = `${MONL[cur.getMonth()]} ${cur.getFullYear()}`;
      const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const start = startOfWeek(first, 1);
      const cells = Array.from({ length: 42 }, (_, i) => addD(start, i));
      const trimmed = cells[35].getMonth() !== cur.getMonth() ? cells.slice(0, 35) : cells;
      const wdn = Array.from({ length: 7 }, (_, i) => WD[(i + 1) % 7]);

      calBody = `<div class="cal-h">${wdn.map(d => `<div>${d}</div>`).join('')}</div>
        <div class="cal-g" style="grid-template-rows:repeat(${trimmed.length / 7},minmax(112px,1fr))">${trimmed
          .map(d => {
            const ds = iso(d);
            const items = itemsOn(ds);
            const today = diffD(d, TODAY) === 0;
            return `<div class="cday ${d.getMonth() !== cur.getMonth() ? 'out' : ''} ${today ? 'today' : ''}">
              <span class="dn" ${today ? 'aria-current="date"' : ''}>${d.getDate()}</span>
              ${items.slice(0, 3).map(chip).join('')}
              ${items.length > 3 ? `<button class="cmore" data-a="pop" data-pop="changesDaylist" data-date="${ds}">+${items.length - 3} more</button>` : ''}
            </div>`;
          })
          .join('')}</div>`;
    } else {
      // Week mode
      const ws = startOfWeek(cur, 1);
      const days = Array.from({ length: 7 }, (_, i) => addD(ws, i));
      label = `${fmtDate(iso(days[0]))} – ${fmtDate(iso(days[6]))}, ${days[6].getFullYear()}`;

      calBody = `<div class="week">${days
        .map(d => {
          const ds = iso(d);
          const items = itemsOn(ds);
          const today = diffD(d, TODAY) === 0;
          return `<div class="wcol">
            <div class="wcol-h ${today ? 'today' : ''}">
              <span class="n">${d.getDate()}</span>
              <span class="muted" style="font-size:12px">${WD[d.getDay()]}</span>
              <span class="sp"></span>
              ${items.length ? `<span class="badge" style="font-size:10px">${items.length}</span>` : ''}
            </div>
            <div class="wcol-b">${
              items
                .map(e => {
                  const isMod = e.status === 'MODIFIED';
                  const isAdd = e.status === 'ADDED';
                  const statusColor = isMod ? 'var(--amber)' : isAdd ? 'var(--green)' : 'var(--red)';
                  const statusBadgeCls = isMod ? 'badge-amber' : isAdd ? 'badge-emerald' : 'badge-red';
                  const secLabel = esc(formatChangeSecLabel(e));

                  return `<button class="wcard" style="--c:${statusColor}" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect change details">
                    <div class="row" style="gap:6px;align-items:center;justify-content:space-between">
                      <span class="pdot" style="--c:${statusColor}"></span>
                      <span style="font-weight:700;font-size:12px;color:var(--text)">${esc(e.code)}</span>
                      <span class="finlex-tag-badge ${statusBadgeCls}" style="font-size:10px;padding:1px 5px">${e.status}</span>
                    </div>
                    <span style="font-size:12px;font-weight:500;color:var(--text);line-height:1.3" class="trunc">${secLabel}</span>
                    <span style="font-size:11.5px;color:var(--text-3);line-height:1.2" class="trunc">${esc(e.title)}</span>
                    ${e.amendingAct ? `<span style="font-size:11px;color:var(--text-4)">By ${esc(e.amendingAct)}</span>` : ''}
                  </button>`;
                })
                .join('') || '<span class="faint" style="font-size:12px;padding:6px">No statutory changes</span>'
            }</div>
          </div>`;
        })
        .join('')}</div>`;
    }

    bodyContent = `
      <div class="changes-cal-wrap">
        <div class="toolbar" style="gap:8px;border-top:0;background:var(--surface-2);padding:6px var(--gutter)">
          <button class="btn btn-secondary btn-sm" data-a="changesCalNav" data-d="0">Today</button>
          <div class="row" style="gap:0">
            <button class="ibtn ibtn-sm" data-a="changesCalNav" data-d="-1" aria-label="Previous">${ic('chevron-left', 16)}</button>
            <button class="ibtn ibtn-sm" data-a="changesCalNav" data-d="1" aria-label="Next">${ic('chevron-right', 16)}</button>
          </div>
          <h2 style="font-size:15px;font-weight:600;margin:0 4px;letter-spacing:-.01em" aria-live="polite">${label}</h2>

          <span class="sp"></span>

          <!-- In-force milestone quick jumpers -->
          <span class="row hide-m" style="gap:6px;font-size:11.5px;color:var(--text-3);align-items:center">
            <span style="font-weight:600;text-transform:uppercase;letter-spacing:.04em;font-size:10px">In-Force Milestones:</span>
            ${milestones
              .slice(0, 6)
              .map(
                m => `
              <button class="milestone-pill ${curYm === m.key ? 'on' : ''}" data-a="changesJumpDate" data-date="${m.date}" title="Jump to ${m.label}">
                <span>${m.label}</span>
                <span class="milestone-badge">${m.count}</span>
              </button>
            `,
              )
              .join('')}
          </span>

          <div class="seg">
            <button class="${calMode === 'month' ? 'on' : ''}" data-a="set" data-k="changesCalMode" data-v="month">Month</button>
            <button class="${calMode === 'week' ? 'on' : ''}" data-a="set" data-k="changesCalMode" data-v="week">Week</button>
          </div>
        </div>
        <div class="cal" style="flex:1;min-height:560px">
          ${calBody}
        </div>
      </div>
    `;
  } else if (view === 'feed') {
    // -------------------------------------------------------------------
    // FEED STREAM VIEW
    // -------------------------------------------------------------------
    const sortedDays = Array.from(byDate.entries()).sort(([a], [b]) => b.localeCompare(a));

    bodyContent = `
      <div class="changes-feed-wrap">
        <div class="changes-feed-inner">
          <div class="changes-stream">
            ${sortedDays
              .map(([day, items]) => {
                return `
                <section class="changes-day-section">
                  <div class="changes-day-hdr">
                    <span class="changes-day-date">${ic('calendar', 12)} In force ${formatDate(day)}</span>
                    <span class="changes-day-cnt">${items.length} provision change${items.length === 1 ? '' : 's'}</span>
                  </div>

                  <div class="changes-cards-list">
                    ${items
                      .map(e => {
                        const statusBadge = changeBadgeHtml(e.status, e.amendingAct, getChangeDate(e));
                        const secLabel = esc(formatChangeSecLabel(e)) + (e.upcoming ? ' (upcoming wording)' : '');

                        return `
                        <article class="changes-card surface">
                          <div class="changes-card-head">
                            <div class="changes-act-line">
                              <button class="changes-act-code link" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect amendment details in drawer">
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
                              <button class="changes-sec-btn link" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect amendment details in drawer">
                                ${secLabel}
                              </button>
                              ${statusBadge}
                            </div>
                            <div class="row" style="gap:4px">
                              <button class="btn btn-secondary btn-xs" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect amendment details in drawer">
                                ${ic('panel-right-open', 11)} Details
                              </button>
                              <button class="btn btn-ghost btn-xs" data-a="openRegInReader" data-id="${e.docId}" data-sec="${e.chunkId || ''}" data-diff="true" title="Open reader and inspect diff">
                                ${ic('external-link', 11)} Reader
                              </button>
                            </div>
                          </div>

                          ${diffAccordionHtml({
                            diff: e.diff,
                            isUpcoming: e.upcoming,
                            isAdded: e.status === 'ADDED',
                            newText: e.newText,
                            isOpen: false,
                          })}
                        </article>
                      `;
                      })
                      .join('')}
                  </div>
                </section>
              `;
              })
              .join('')}
          </div>
        </div>
      </div>
    `;
  } else {
    // -------------------------------------------------------------------
    // TABLE MATRIX VIEW
    // -------------------------------------------------------------------
    bodyContent = `
      <div class="tbl-wrap changes-table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width:110px">In Force</th>
              <th style="width:130px">Act</th>
              <th style="width:300px">Statutory Title</th>
              <th style="width:140px">Section</th>
              <th style="width:110px">Status</th>
              <th style="width:130px">Amending Act</th>
              <th style="width:130px">Authority</th>
              <th style="width:100px;text-align:right">Action</th>
            </tr>
          </thead>
          <tbody>
            ${filtered
              .map(e => {
                const secLabel = esc(formatChangeSecLabel(e));
                const isMod = e.status === 'MODIFIED';
                const isAdd = e.status === 'ADDED';
                const badgeCls = isMod ? 'badge-amber' : isAdd ? 'badge-emerald' : 'badge-red';

                return `
                <tr>
                  <td><span class="num">${esc(getChangeDate(e))}</span></td>
                  <td>
                    <button class="link bold" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect change details in drawer" style="font-family:var(--font-mono, monospace);font-size:12px">
                      ${esc(e.code)}
                    </button>
                  </td>
                  <td class="trunc" title="${esc(e.title)}">${esc(e.title)}</td>
                  <td>
                    <button class="link" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect change details in drawer">
                      ${secLabel}
                    </button>
                  </td>
                  <td><span class="finlex-tag-badge ${badgeCls}" style="font-size:10px">${e.status}</span></td>
                  <td>${e.amendingAct ? `<span class="num">${esc(e.amendingAct)}</span>` : '<span class="faint">—</span>'}</td>
                  <td><span class="changes-source-pill ${e.source === 'riksdagen' ? 'is-sfs' : 'is-fffs'}">${e.source === 'riksdagen' ? 'SFS' : 'FFFS'}</span></td>
                  <td style="text-align:right">
                    <button class="btn btn-secondary btn-xs" data-a="openChangeDrawer" data-id="${e.id}" title="Inspect amendment details in drawer">
                      ${ic('panel-right-open', 11)} Details
                    </button>
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return `<div class="page flush page-changes">
    <!-- PAGE HEADER -->
    <div class="ph">
      <div>
        <h1>Regulatory Changes</h1>
        <p>Live statutory amendment stream & in-force compliance schedule from official Swedish sources.</p>
      </div>
      <div class="acts">
        <span class="badge" title="Tracked provisions"><b>${totalEvents}</b> Changes</span>
        <span class="badge" title="Sections with word-level redline diffs"><b>${modifiedEvents}</b> Modified</span>
        <span class="badge" title="Newly enacted provisions"><b>${addedEvents}</b> Added</span>
        <span class="badge" title="Impacted statutory codes"><b>${uniqueActs}</b> Statutes</span>
      </div>
    </div>

    <!-- MAIN TOOLBAR -->
    <div class="toolbar" role="toolbar" style="gap:8px">
      <!-- Search Input -->
      <div class="inwrap" style="min-width:260px">
        ${ic('search', 13)}
        <input class="input search-sm" id="changes-q" data-in="changesQ" placeholder="Filter changes (e.g. SFS 2026:784)..." value="${esc(u.changesQ || '')}" aria-label="Filter changes">
        ${q ? `<button class="pillbtn" data-a="clearChangesQ" style="padding:2px 5px;position:absolute;right:6px;top:50%;transform:translateY(-50%)" aria-label="Clear search">${ic('x', 11)}</button>` : ''}
      </div>

      <!-- Source Filter -->
      <div class="seg" role="tablist" aria-label="Source filter">
        <button class="${sourceFilter === 'all' ? 'on' : ''}" data-a="set" data-k="changesSource" data-v="all">All Sources (${totalEvents})</button>
        <button class="${sourceFilter === 'riksdagen' ? 'on' : ''}" data-a="set" data-k="changesSource" data-v="riksdagen">SFS (${sfsEvents})</button>
        <button class="${sourceFilter === 'fffs' ? 'on' : ''}" data-a="set" data-k="changesSource" data-v="fffs">FFFS (${fffsEvents})</button>
      </div>

      <!-- Status Filter -->
      <div class="seg" role="tablist" aria-label="Status filter">
        <button class="${statusFilter === 'all' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="all">All Statuses</button>
        <button class="${statusFilter === 'MODIFIED' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="MODIFIED">Modified (${modifiedEvents})</button>
        <button class="${statusFilter === 'ADDED' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="ADDED">Added (${addedEvents})</button>
        ${repealedEvents ? `<button class="${statusFilter === 'REPEALED' ? 'on' : ''}" data-a="set" data-k="changesStatus" data-v="REPEALED">Repealed (${repealedEvents})</button>` : ''}
      </div>

      <span class="sp"></span>

      <!-- View Switcher -->
      <div class="seg" role="tablist" aria-label="View switcher">
        <button class="${view === 'calendar' ? 'on' : ''}" data-a="set" data-k="changesView" data-v="calendar" title="Calendar View">${ic('calendar', 13)}Calendar</button>
        <button class="${view === 'feed' ? 'on' : ''}" data-a="set" data-k="changesView" data-v="feed" title="Feed Stream View">${ic('newspaper', 13)}Feed</button>
        <button class="${view === 'table' ? 'on' : ''}" data-a="set" data-k="changesView" data-v="table" title="Table Matrix View">${ic('table-2', 13)}Table</button>
      </div>
    </div>

    <!-- VIEW BODY -->
    <div class="changes-view-container">
      ${bodyContent}
    </div>
  </div>`;
}
