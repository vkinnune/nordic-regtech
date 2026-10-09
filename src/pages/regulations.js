/* ---------- REGULATIONS EXPLORER (Starting Screen: Grid Library -> 2nd Screen: Reader) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import {
  S,
  REGULATIONS,
  allChaptersOf,
  allRegulations,
  allSectionsOf,
  regulation,
  policiesForSection,
  controlsForSection,
  risksForSection,
  allPolicies,
  allControls,
  allRisks,
  isControlImpacted,
  isPolicyImpacted,
  isSectionAmended,
  getRegulationYear,
  getRegulationDomain,
  getRegulationTier,
  getRegulationAuthority,
  isRegulationRepeal,
  REGULATION_DOMAINS,
  REGULATION_TIERS,
} from '../core/store.js';
import { empty } from '../ui/helpers.js';
import { applyRegView, viewOf, viewToolbar } from '../shell/view-engine.js';

export function pageRegulations() {
  const u = S.ui;
  // Starting screen is the clean Grid Library view; Reader view is opened on card selection
  if (u.regView === 'reader') {
    return renderRegulationsReader(u);
  }
  return renderRegulationsLibrary(u);
}

/* ============================================================
   1. STARTING SCREEN: REGULATIONS LIBRARY (GRID & LIST)
   ============================================================ */
function renderRegulationsLibrary(u) {
  const v = viewOf('regulations');
  const auth = u.regLibAuth || 'all'; // 'all', 'fi', 'riksdagen'
  const layout = u.regLibLayout || 'grid'; // 'grid' or 'list'

  const policies = allPolicies();
  const controls = allControls();
  const risks = allRisks();

  const polSecSet = new Set(policies.flatMap(p => p.statuteSections || []));
  const ctlSecSet = new Set(controls.flatMap(c => c.statuteSections || []));
  const rskSecSet = new Set(risks.flatMap(r => r.statuteSections || []));

  const allActs = allRegulations();
  const totalSections = allActs.reduce((sum, a) => sum + allSectionsOf(a).length, 0);
  const totalPoliciesCount = policies.length;
  const totalControlsCount = controls.length;

  // Decorate all acts with precomputed metadata for fast multi-dimensional evaluation
  const decorated = allActs.map(r => {
    const secs = allSectionsOf(r);
    const year = getRegulationYear(r);
    const regDomain = getRegulationDomain(r);
    const regTier = getRegulationTier(r);
    const regAuth = getRegulationAuthority(r);
    const isRepeal = isRegulationRepeal(r);
    const hasLinkedPolicies = secs.some(s => polSecSet.has(s.id));
    const hasLinkedControls = secs.some(s => ctlSecSet.has(s.id));
    const hasLinkedRisks = secs.some(s => rskSecSet.has(s.id));
    const hasAmended = secs.some(isSectionAmended);
    const linkedControlsCount = secs.reduce((acc, s) => acc + controlsForSection(s.id).length, 0);
    const linkedPoliciesCount = secs.reduce((acc, s) => acc + policiesForSection(s.id).length, 0);

    return {
      r,
      secs,
      year,
      regDomain,
      regTier,
      regAuth,
      isRepeal,
      hasLinkedPolicies,
      hasLinkedControls,
      hasLinkedRisks,
      hasAmended,
      linkedControlsCount,
      linkedPoliciesCount,
    };
  });

  const filtered = applyRegView(decorated, v, auth);

  let body;
  if (!allActs.length) {
    body = `<div class="panel">${empty('scale', 'No regulations found', 'No statutory regulations in the library.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty(
      'search-x',
      'No matching regulations found',
      'Try adjusting your search query, sector, or active filters.',
      `<button class="btn btn-secondary btn-sm" data-a="clearFilters" data-key="regulations">${ic('rotate-ccw', 13)} Reset all filters</button>`,
    )}</div>`;
  } else if (layout === 'list') {
    body = `<div class="panel" style="overflow-x:auto">${renderRegulationsList(filtered)}</div>`;
  } else {
    body = renderRegulationsGrid(filtered);
  }

  const fffsCount = allActs.filter(r => getRegulationAuthority(r) === 'fi').length;
  const sfsCount = allActs.filter(r => getRegulationAuthority(r) === 'riksdagen').length;

  const extra = `<div class="seg" role="tablist">
    <button class="${layout !== 'list' ? 'on' : ''}" data-a="set" data-k="regLibLayout" data-v="grid" title="Cards view">${ic('layout-grid', 13)}<span class="hide-m">Cards</span></button>
    <button class="${layout === 'list' ? 'on' : ''}" data-a="set" data-k="regLibLayout" data-v="list" title="List view">${ic('list', 13)}<span class="hide-m">List</span></button>
  </div>`;

  const right = `<div class="seg" role="tablist">
    <button class="${auth === 'all' ? 'on' : ''}" data-a="set" data-k="regLibAuth" data-v="all">All (${allActs.length})</button>
    <button class="${auth === 'fi' ? 'on' : ''}" data-a="set" data-k="regLibAuth" data-v="fi">Finansinspektionen (${fffsCount})</button>
    <button class="${auth === 'riksdagen' ? 'on' : ''}" data-a="set" data-k="regLibAuth" data-v="riksdagen">Riksdagen Acts (${sfsCount})</button>
  </div>`;

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Regulations Library</h1>
        <p>Swedish financial statutory library and supervisory regulations</p>
      </div>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><span class="k">Statutes</span><span class="v">${allActs.length}</span><span class="d">Swedish acts & FFFS circulars</span></div>
      <div class="stat"><span class="k">Statutory Sections</span><span class="v">${totalSections}</span><span class="d">indexed legal provisions</span></div>
      <div class="stat"><span class="k">Governing Policies</span><span class="v">${totalPoliciesCount}</span><span class="d">linked compliance standards</span></div>
      <div class="stat"><span class="k">Enforcing Controls</span><span class="v">${totalControlsCount}</span><span class="d">operational safeguards</span></div>
    </div>

    ${viewToolbar('regulations', {
      group: false,
      extra,
      right,
      placeholder: 'Search regulations by title, code, topic, or year...',
    })}

    ${body}
  </div>`;
}

function renderRegulationsGrid(decoratedActs) {
  return `<div class="finlex-lib-grid">
    ${decoratedActs
      .map(item => {
        const { r, secs, year, regDomain, regTier, isRepeal, hasAmended, linkedControlsCount, linkedPoliciesCount } = item;
        const displayTitle = r.shortTitle && r.shortTitle !== r.code ? r.shortTitle : r.title;
        const domainObj = REGULATION_DOMAINS.find(d => d.id === regDomain);
        const tierObj = REGULATION_TIERS.find(t => t.id === regTier);
        const tierLabel = tierObj ? tierObj.label.replace('Parliamentary ', '').replace('Supervisory ', '').replace('Government ', '') : regTier;

        return `<article class="finlex-lib-card" data-a="openRegInReader" data-id="${r.id}" title="Open regulation in reader">
        <div class="finlex-lib-card-top">
          <div class="row" style="gap:6px;align-items:center">
            <span class="finlex-jurisdiction-tag">${esc(r.jurisdiction)}</span>
            <span class="finlex-tier-badge ${regTier}">${esc(tierLabel)}</span>
          </div>
          <span class="finlex-code-badge">${esc(r.code)}</span>
        </div>

        <div>
          <h2 class="finlex-lib-card-title">${esc(displayTitle)}</h2>
          ${r.shortTitle && r.shortTitle !== r.code && r.title && r.title !== r.shortTitle ? `<div class="faint trunc" style="font-size:11.5px;margin-top:2px" title="${esc(r.title)}">${esc(r.title)}</div>` : ''}
        </div>

        <p class="finlex-lib-card-desc">${esc(r.summary)}</p>

        <div class="finlex-lib-card-meta">
          <span class="finlex-domain-badge">${esc(domainObj ? domainObj.label : regDomain)}</span>
          <span>·</span>
          <span>${esc(r.authority)}</span>
          <span>·</span>
          <span>${year || esc(r.inForce || 'In force')}</span>
          <span>·</span>
          <span>${secs.length} sections</span>
          ${isRepeal ? `<span class="finlex-repeal-badge">Repeal</span>` : ''}
          ${hasAmended ? `<span class="pill" style="font-size:10px;background:var(--amber-soft);color:var(--amber);border-color:var(--amber)">Amended</span>` : ''}
          ${linkedControlsCount ? `<span class="finlex-gov-badge" title="${linkedControlsCount} linked controls">${ic('shield-check', 11)} ${linkedControlsCount} ${linkedControlsCount === 1 ? 'control' : 'controls'}</span>` : ''}
          ${linkedPoliciesCount ? `<span class="finlex-gov-badge" title="${linkedPoliciesCount} linked policies">${ic('file-text', 11)} ${linkedPoliciesCount} ${linkedPoliciesCount === 1 ? 'policy' : 'policies'}</span>` : ''}
        </div>

        ${
          r.tags && r.tags.length
            ? `<div class="finlex-lib-card-foot">
          <div class="row" style="gap:4px;flex-wrap:wrap">
            ${r.tags
              .slice(0, 3)
              .map(t => `<span class="pill" style="font-size:10.5px;padding:1px 6px">${esc(t)}</span>`)
              .join('')}
          </div>
        </div>`
            : ''
        }
      </article>`;
      })
      .join('')}
  </div>`;
}

function renderRegulationsList(decoratedActs) {
  return `<table class="finlex-lib-table">
      <thead>
        <tr>
          <th style="width:320px">Regulation & Title</th>
          <th>Sector</th>
          <th>Legal Tier</th>
          <th>Authority</th>
          <th>In Force</th>
          <th>Governance</th>
          <th>Sections</th>
        </tr>
      </thead>
      <tbody>
        ${decoratedActs
          .map(item => {
            const { r, secs, year, regDomain, regTier, isRepeal, hasAmended, linkedControlsCount, linkedPoliciesCount } = item;
            const displayTitle = r.shortTitle && r.shortTitle !== r.code ? r.shortTitle : r.title;
            const domainObj = REGULATION_DOMAINS.find(d => d.id === regDomain);
            const tierObj = REGULATION_TIERS.find(t => t.id === regTier);
            const tierLabel = tierObj ? tierObj.label.replace('Parliamentary ', '').replace('Supervisory ', '').replace('Government ', '') : regTier;

            return `<tr data-a="openRegInReader" data-id="${r.id}" title="Open ${esc(r.code)}">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(r.code)}</span>
                <span class="trunc" style="max-width:260px">${esc(displayTitle)}</span>
              </div>
            </td>
            <td><span class="finlex-domain-badge">${esc(domainObj ? domainObj.label : regDomain)}</span></td>
            <td><span class="finlex-tier-badge ${regTier}">${esc(tierLabel)}</span></td>
            <td><span style="font-size:12px;font-weight:500">${esc(r.authority)}</span></td>
            <td><span class="mono faint" style="font-size:11.5px">${year || esc(r.inForce || 'In force')}</span></td>
            <td>
              <div class="row" style="gap:4px;align-items:center">
                ${linkedControlsCount ? `<span class="finlex-gov-badge">${ic('shield-check', 11)} ${linkedControlsCount}</span>` : ''}
                ${linkedPoliciesCount ? `<span class="finlex-gov-badge">${ic('file-text', 11)} ${linkedPoliciesCount}</span>` : ''}
                ${hasAmended ? `<span class="pill" style="font-size:10px;background:var(--amber-soft);color:var(--amber)">Amended</span>` : ''}
                ${isRepeal ? `<span class="finlex-repeal-badge">Repeal</span>` : ''}
                ${!linkedControlsCount && !linkedPoliciesCount && !hasAmended && !isRepeal ? `<span class="faint" style="font-size:12px">—</span>` : ''}
              </div>
            </td>
            <td><span style="font-size:12px">${secs.length}</span></td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

/* ============================================================
   2. SECOND SCREEN: FINLEX DOCUMENT READER VIEW
   ============================================================ */
function renderRegulationsReader(u) {
  const selActId = u.regSel || 'sfs-2004-46';
  const curAct = regulation(selActId) || REGULATIONS[0];
  const q = (u.regQ || '').toLowerCase().trim();
  const showPlain = u.regPlain !== false;

  const allSecs = allSectionsOf(curAct);
  const activeSecId = u.regSec || (allSecs[0] ? allSecs[0].id : null);
  const chapters = allChaptersOf(curAct);
  const isFffs = Boolean((curAct.jurisdiction && curAct.jurisdiction.includes('Finansinspektionen')) || (curAct.code && curAct.code.startsWith('FFFS')));

  return `<div class="page flush">
    <div class="finlex-container">

      <!-- LEFT SIDEBAR: Finlex Sisällysluettelo (TOC) -->
      <aside class="finlex-toc ${u.regTocCollapsed ? 'collapsed' : ''}" aria-label="Table of Contents">
        <div class="finlex-toc-top">
          <!-- Back to Library Button -->
          <div class="row" style="gap:6px">
            <button class="finlex-toc-back-btn grow" data-a="setRegView" data-view="library" title="Back to regulations library">
              ${ic('arrow-left', 13)}
              <span>Back to Regulations</span>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" data-a="toggleRegToc" title="Collapse table of contents" aria-label="Collapse table of contents">
              ${ic('panel-left-close', 13)}
            </button>
          </div>

          <!-- Current Act Title in Sidebar -->
          <div class="finlex-toc-act-label">
            <span class="mono" style="font-size:11px;color:var(--text-3)">${esc(curAct.code)}</span>
            <span class="trunc" style="font-weight:700;font-size:13px;color:var(--text)">${
              curAct.shortTitle && curAct.shortTitle !== curAct.code
                ? esc(curAct.shortTitle)
                : esc(curAct.title && curAct.title !== curAct.code ? curAct.title : curAct.shortTitle || curAct.title)
            }</span>
          </div>

          <!-- Sisällysluettelo Title -->
          <div class="finlex-toc-hdr-row">
            <h2 class="finlex-toc-title">
              ${ic('book-open', 13)}
              <span>Table of Contents</span>
            </h2>
          </div>

          <!-- Section Search -->
          <div class="inwrap finlex-toc-search">
            ${ic('search', 13)}
            <input class="input search-sm" id="reg-toc-q" data-in="regQ" placeholder="Search sections..." value="${esc(u.regQ || '')}" aria-label="Search sections">
          </div>
        </div>

        <!-- TOC Hierarchical Tree -->
        <div class="finlex-toc-tree" data-keep="finlex-tree">
          ${!allSecs.length ? `<div style="padding:16px;font-size:12px;color:var(--text-3);text-align:center">No chapters indexed</div>` : renderFinlexTree(curAct, chapters, activeSecId, q)}
        </div>
      </aside>

      <!-- RIGHT MAIN CONTENT: Finlex Document Reader -->
      <main class="finlex-reader" id="finlex-doc-content" tabindex="-1">
        <div class="finlex-reader-inner">
          ${
            u.regTocCollapsed
              ? `<div style="margin-bottom:14px">
                  <button class="btn btn-secondary btn-sm" data-a="toggleRegToc" title="Show table of contents">
                    ${ic('panel-left', 13)}
                    <span>Table of Contents</span>
                  </button>
                </div>`
              : ''
          }

          <!-- Act Document Header -->
          <header class="finlex-doc-head">
            <div class="finlex-doc-act-no">
              <span>${esc(curAct.jurisdiction)} · ${esc(curAct.code)}${curAct.type ? ` · ${esc(curAct.type.replace('_', ' '))}` : ''}</span>
              ${
                curAct.ruleType === 'guidance' || (curAct.title && /allmänna råd/i.test(curAct.title))
                  ? `<span class="finlex-rule-badge guidance">General Guidance</span>`
                  : `<span class="finlex-rule-badge binding">Binding Rule</span>`
              }
            </div>
            <h1 class="finlex-doc-title">${esc(curAct.shortTitle || curAct.title)}</h1>
            ${
              curAct.shortTitle && curAct.shortTitle !== curAct.code && curAct.title && curAct.title !== curAct.shortTitle
                ? `<p class="finlex-doc-subtitle">${esc(curAct.title)}</p>`
                : ''
            }

            <div class="finlex-doc-meta">
              ${curAct.issueDate ? `<span>Issued: <b>${esc(curAct.issueDate)}</b></span><span>·</span>` : ''}
              <span>In force: <b>${esc(curAct.effectiveDate || curAct.inForce || 'In force')}</b></span>
              <span>·</span>
              <span>Supervisory authority: <b>${esc(curAct.authority)}</b></span>
              ${curAct.latestAmendment ? `<span>·</span><span>Latest amendment: <b>${esc(curAct.latestAmendment)}</b></span>` : ''}
              ${
                curAct.amends
                  ? `
                <span>·</span>
                <span>Amends: ${curAct.amendsId ? `<button class="finlex-link-btn" data-a="openRegInReader" data-id="${curAct.amendsId}" title="Open amended regulation">${esc(curAct.amends)}</button>` : `<span class="mono">${esc(curAct.amends)}</span>`}</span>
              `
                  : ''
              }
              ${
                curAct.amendments && curAct.amendments.length
                  ? `
                <span>·</span>
                <span>Amended by: <span class="finlex-amendments-group">${curAct.amendments.map(a => `<button class="finlex-link-btn" data-a="openRegInReader" data-id="${a.id}" title="Open amending regulation ${esc(a.code)}">${esc(a.code)}</button>`).join(', ')}</span></span>
              `
                  : curAct.amendedBy
                    ? `<span>·</span><span>Amended by: <b>${esc(curAct.amendedBy)}</b></span>`
                    : ''
              }
              ${curAct.incomingCount ? `<span>·</span><span class="finlex-cite-count-badge" title="Referenced by ${curAct.incomingCount} provisions across supervisory database">${ic('link', 11)} Cited by ${curAct.incomingCount}</span>` : ''}
            </div>

            <!-- Official Documents & Attachments Toolbar -->
            ${
              curAct.pdfUrl || curAct.memoUrl || curAct.sourceUrl
                ? `
              <div class="finlex-attachments-bar">
                <span class="finlex-attachments-label">${ic('paperclip', 12)} Official Attachments & Links:</span>
                <div class="finlex-attachments-links">
                  ${
                    curAct.pdfUrl
                      ? `
                    <a href="${esc(curAct.pdfUrl)}" target="_blank" rel="noopener noreferrer" class="finlex-attach-chip pdf" title="Download official PDF Gazette document">
                      ${ic('file-text', 12)}
                      <span>Official PDF</span>
                      ${ic('external-link', 10)}
                    </a>
                  `
                      : ''
                  }
                  ${
                    curAct.memoUrl
                      ? `
                    <a href="${esc(curAct.memoUrl)}" target="_blank" rel="noopener noreferrer" class="finlex-attach-chip memo" title="Read supervisory decision memorandum (Besluts-PM)">
                      ${ic('file-check', 12)}
                      <span>Decision Memo (Besluts-PM)</span>
                      ${ic('external-link', 10)}
                    </a>
                  `
                      : ''
                  }
                  ${
                    curAct.sourceUrl
                      ? `
                    <a href="${esc(curAct.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="finlex-attach-chip" title="Open official supervisory registry page">
                      ${ic('globe', 12)}
                      <span>Official Page</span>
                      ${ic('external-link', 10)}
                    </a>
                  `
                      : ''
                  }
                </div>
              </div>
            `
                : ''
            }

            <!-- Delegated Authority Strip -->
            ${
              curAct.authorizations && curAct.authorizations.length
                ? `
              <div class="finlex-auth-bar">
                <span class="finlex-auth-label">${ic('scale', 12)} Issued with authority from:</span>
                <div class="finlex-auth-chips">
                  ${curAct.authorizations
                    .map(
                      a => `
                    <button class="finlex-auth-chip ${a.targetDocId ? 'is-link' : 'is-external'}" data-a="openRegInReader" data-id="${a.targetDocId || ''}" data-sec="${a.targetChunkId || ''}" title="${a.targetDocId ? `Jump to enabling statute ${esc(a.rawText)}` : 'External enabling statute / ordinance'}">
                      ${ic('shield-alert', 11)}
                      <span>${esc(a.rawText)}</span>
                    </button>
                  `,
                    )
                    .join('')}
                </div>
              </div>
            `
                : ''
            }

            <!-- Document-level Incoming References -->
            ${
              curAct.incomingRefs && curAct.incomingRefs.length
                ? `
              <details class="finlex-incoming-refs finlex-doc-incoming">
                <summary class="finlex-incoming-summary">
                  ${ic('corner-down-right', 11)}
                  <span>${curAct.incomingRefs.length} incoming reference${curAct.incomingRefs.length === 1 ? '' : 's'} to this regulation</span>
                </summary>
                <ul class="finlex-incoming-list">
                  ${curAct.incomingRefs
                    .map(
                      ref => `
                    <li>
                      <button class="finlex-incoming-link" data-a="openRegInReader" data-id="${ref.docId}" data-sec="${ref.chunkId || ''}">
                        ${esc(ref.label)}
                      </button>
                      ${ref.via ? `<span class="finlex-incoming-via">via ${esc(ref.via)}</span>` : ''}
                    </li>
                  `,
                    )
                    .join('')}
                </ul>
              </details>
            `
                : ''
            }
          </header>

          <!-- Preamble Container (if document has both preamble and indexed sections) -->
          ${
            curAct.preamble && chapters.length > 0 && curAct.preamble !== curAct.summary
              ? `
            <div class="finlex-preamble-box">
              <div class="finlex-preamble-label">${ic('info', 11)} Statutory Preamble</div>
              <p class="finlex-preamble-text">${esc(curAct.preamble)}</p>
            </div>
          `
              : ''
          }

          <!-- Simple Toolbar: Plain English Toggle & Clear Search -->
          <div class="finlex-toolbar">
            <button class="btn btn-sm ${showPlain ? 'btn-primary' : 'btn-ghost'}" data-a="toggleRegPlain" title="Toggle Plain English summary">
              ${ic('sparkles', 13)}
              <span>Plain English</span>
            </button>
            <span class="sp"></span>
            ${
              q
                ? `<button class="pillbtn" data-a="set" data-k="regQ" data-v="" style="font-size:11.5px">
                    ${ic('x', 12)}Clear search
                  </button>`
                : ''
            }
          </div>

          <!-- Statutory Sections Stream -->
          <div class="finlex-sections-stream">
            ${
              !allSecs.length
                ? curAct.preamble
                  ? `<div class="finlex-unsectioned-doc" style="padding:16px 0">
                      <div class="panel" style="padding:24px;line-height:1.6;font-size:13.5px;white-space:pre-wrap;background:var(--surface)">${esc(curAct.preamble)}</div>
                    </div>`
                  : `<div class="panel" style="margin-top:20px;padding:36px 24px;text-align:center">
                      <div style="max-width:500px;margin:0 auto">
                        <div style="font-size:14px;font-weight:600;margin-bottom:8px">No section provisions indexed for this rule</div>
                        <p class="faint" style="font-size:13px;line-height:1.5;margin-bottom:16px">${esc(curAct.summary || 'This regulation is registered in the supervisory database without individual section breakdowns.')}</p>
                        <button class="btn btn-secondary btn-sm" data-a="setRegView" data-view="library">${ic('arrow-left', 13)} Back to Regulations</button>
                      </div>
                    </div>`
                : renderFinlexSections(chapters, activeSecId, showPlain, q, isFffs)
            }
          </div>
        </div>
      </main>

    </div>
  </div>`;
}

function renderFinlexTree(act, chapters, activeSecId, q) {
  let lastPart = null;

  return chapters
    .map(ch => {
      let partHtml = '';
      if (ch.partTitle && ch.partTitle !== lastPart) {
        lastPart = ch.partTitle;
        partHtml = `<div class="finlex-tree-part">
          ${ic('chevron-down', 11)}
          <span>${esc(ch.partNumber ? ch.partNumber + ' - ' : '')}${esc(ch.partTitle)}</span>
        </div>`;
      }

      const matchingSecs = (ch.sections || []).filter(s => {
        if (!q) return true;
        return (
          s.number.toLowerCase().includes(q) ||
          s.heading.toLowerCase().includes(q) ||
          (s.headingEn && s.headingEn.toLowerCase().includes(q)) ||
          s.text.toLowerCase().includes(q) ||
          (s.textEn && s.textEn.toLowerCase().includes(q)) ||
          (s.plainEnglish && s.plainEnglish.summary.toLowerCase().includes(q))
        );
      });

      if (q && !matchingSecs.length) return '';

      const secItems = matchingSecs
        .map(s => {
          const isActive = s.id === activeSecId;
          const heading = s.headingEn || s.heading;
          return `<button class="finlex-tree-sec ${isActive ? 'active' : ''}" data-a="selectSec" data-id="${s.id}" title="${esc(s.number)} ${esc(heading)}">
          ${esc(s.number)} - ${esc(heading)}
        </button>`;
        })
        .join('');

      return `
        ${partHtml}
        <div class="finlex-tree-chap">
          ${ic('chevron-down', 11)}
          <span>${esc(ch.number)} - ${esc(ch.title)}</span>
        </div>
        ${secItems}
      `;
    })
    .join('');
}

function renderFinlexSections(chapters, activeSecId, showPlain, q, isFffs) {
  return chapters
    .map(ch => {
      const matchingSecs = (ch.sections || []).filter(s => {
        if (!q) return true;
        return (
          s.number.toLowerCase().includes(q) ||
          s.heading.toLowerCase().includes(q) ||
          (s.headingEn && s.headingEn.toLowerCase().includes(q)) ||
          s.text.toLowerCase().includes(q) ||
          (s.textEn && s.textEn.toLowerCase().includes(q)) ||
          (s.plainEnglish && s.plainEnglish.summary.toLowerCase().includes(q))
        );
      });

      if (!matchingSecs.length) return '';

      return `
        <div class="finlex-chap-divider">
          <h3 class="finlex-chap-no">${esc(ch.number)}</h3>
          <h2 class="finlex-chap-name">${esc(ch.title)}</h2>
        </div>
        <div class="finlex-chap-body">
          ${matchingSecs.map(s => renderSectionBlock(s, activeSecId, showPlain, isFffs)).join('')}
        </div>
      `;
    })
    .join('');
}

function renderSectionBlock(s, activeSecId, showPlain, isFffs) {
  const isActive = s.id === activeSecId;
  const textToShow = s.textEn || s.text;
  const headingToShow = s.headingEn || s.heading;
  const hasParagraphs = Boolean(s.paragraphs && s.paragraphs.length);
  const isGuidanceSec = s.ruleType === 'guidance';

  return `<article class="finlex-sec ${isActive ? 'active' : ''} ${isGuidanceSec ? 'is-guidance' : ''}" id="sec-${s.id}">
    <!-- Section Citation & Heading -->
    <header class="finlex-sec-head">
      <div class="finlex-sec-cite">
        <span class="finlex-sec-num">${esc(s.number)}</span>
        ${s.upcoming ? `<span class="finlex-tag-badge upcoming">${ic('clock', 11)} Upcoming wording${s.inForceFrom ? `, in force ${esc(s.inForceFrom)}` : ''}</span>` : ''}
        ${s.inForceUntil ? `<span class="finlex-tag-badge past">In force until ${esc(s.inForceUntil)}</span>` : ''}
        ${s.amendingAct ? `<span class="finlex-sec-amendment">${esc(s.amendingAct)}</span>` : ''}
      </div>
      ${headingToShow ? `<h3 class="finlex-sec-title">${esc(headingToShow)}</h3>` : ''}
    </header>

    <!-- PLAIN ENGLISH BOX (Clean, simple, no fancy colors) -->
    ${
      showPlain && s.plainEnglish
        ? `<div class="finlex-plain-box">
            <div class="finlex-plain-tag">${ic('sparkles', 11)} Plain English:</div>
            <p class="finlex-plain-summary">${esc(s.plainEnglish.summary)}</p>
            ${
              s.plainEnglish.points && s.plainEnglish.points.length
                ? `<ul class="finlex-plain-list">
                    ${s.plainEnglish.points.map(pt => `<li>${esc(pt)}</li>`).join('')}
                  </ul>`
                : ''
            }
          </div>`
        : ''
    }

    <!-- STATUTORY BODY / PARAGRAPHS -->
    ${
      hasParagraphs
        ? s.paragraphs
            .map(p => {
              const pGuidance = p.ruleType === 'guidance';
              return `<div class="finlex-para ${pGuidance ? 'is-guidance' : ''}">
                ${isFffs ? `<span class="finlex-rule-badge ${pGuidance ? 'guidance' : 'binding'}">${pGuidance ? 'General Guidance · comply or explain' : 'Binding rule'}</span>` : ''}
                ${p.text ? `<p class="finlex-para-text">${esc(p.text)}</p>` : ''}
                ${
                  p.points && p.points.length
                    ? `<ul class="finlex-points-list">
                        ${p.points
                          .map(
                            pt => `
                          <li>
                            <div class="finlex-point-item">
                              <span class="finlex-point-num">${esc(pt.number ? pt.number + '.' : '–')}</span>
                              <span class="finlex-point-text">${esc(pt.text)}</span>
                            </div>
                            ${
                              pt.items && pt.items.length
                                ? `<ul class="finlex-subitems-list">
                                    ${pt.items.map(it => `<li>${esc(it.startsWith('–') || it.includes(')') ? it : '– ' + it)}</li>`).join('')}
                                  </ul>`
                                : ''
                            }
                          </li>`,
                          )
                          .join('')}
                      </ul>`
                    : ''
                }
              </div>`;
            })
            .join('')
        : `<div class="finlex-body">${formatFinlexBody(textToShow, s.status)}</div>`
    }

    <!-- GOVERNANCE & CONTROLS STRIP -->
    ${renderSectionGovernanceStrip(s)}

    <!-- OUTGOING CITATIONS -->
    ${
      s.crossRefs && s.crossRefs.length
        ? `<footer class="finlex-sec-foot">
            <div class="finlex-sec-citations">
              <span class="finlex-sec-citations-label">${ic('link-2', 11)} Citations:</span>
              <div class="row" style="gap:4px;flex-wrap:wrap">
                ${s.crossRefs
                  .map(
                    cr => `
                  <button class="finlex-ref-chip ${cr.regId ? 'is-link' : 'is-external'}" data-a="openRegInReader" data-id="${cr.regId || ''}" data-sec="${cr.targetSectionId || ''}" title="${cr.regId ? `Navigate to ${esc(cr.label)}` : 'External citation'}">
                    ${ic('link-2', 11)}
                    <span>${esc(cr.label)}</span>
                  </button>
                `,
                  )
                  .join('')}
              </div>
            </div>
          </footer>`
        : ''
    }

    <!-- INCOMING REFERENCES -->
    ${
      s.incomingRefs && s.incomingRefs.length
        ? `<details class="finlex-incoming-refs">
            <summary class="finlex-incoming-summary">
              ${ic('corner-down-right', 11)}
              <span>${s.incomingRefs.length} reference${s.incomingRefs.length === 1 ? '' : 's'} here</span>
            </summary>
            <ul class="finlex-incoming-list">
              ${s.incomingRefs
                .map(
                  ref => `
                <li>
                  <button class="finlex-incoming-link" data-a="openRegInReader" data-id="${ref.docId}" data-sec="${ref.chunkId || ''}">
                    ${esc(ref.label)}
                  </button>
                  ${ref.via ? `<span class="finlex-incoming-via">via ${esc(ref.via)}</span>` : ''}
                </li>
              `,
                )
                .join('')}
            </ul>
          </details>`
        : ''
    }
  </article>`;
}

function renderSectionGovernanceStrip(s) {
  const pols = policiesForSection(s.id);
  const ctls = controlsForSection(s.id);
  const rsks = risksForSection(s.id);

  if (!pols.length && !ctls.length && !rsks.length && s.status !== 'MODIFIED' && s.status !== 'ADDED') return '';

  return `<div class="finlex-gov-strip">
    <div class="finlex-gov-row">
      <span class="finlex-gov-label">${ic('shield', 12)} Governance & Controls:</span>
      <div class="finlex-gov-chips">
        ${pols
          .map(
            p => `
          <button class="finlex-gov-chip ${isPolicyImpacted(p) ? 'alert' : ''}" data-a="openGovDrawer" data-type="policy" data-id="${p.id}" title="Open policy ${esc(p.code)}: ${esc(p.title)}">
            ${ic('file-text', 11)}
            <span class="mono">${esc(p.code)}</span>
          </button>
        `,
          )
          .join('')}
        ${ctls
          .map(c => {
            const impacted = isControlImpacted(c);
            return `
          <button class="finlex-gov-chip ${impacted ? 'alert' : ''}" data-a="openGovDrawer" data-type="control" data-id="${c.id}" title="Open control ${esc(c.code)}: ${esc(c.title)}">
            ${impacted ? ic('alert-triangle', 11) : ic('check', 11)}
            <span class="mono">${esc(c.code)}</span>
          </button>
        `;
          })
          .join('')}
        ${rsks
          .map(
            r => `
          <button class="finlex-gov-chip" data-a="openGovDrawer" data-type="risk" data-id="${r.id}" title="Regulatory risk: ${esc(r.title)}">
            ${ic('alert-octagon', 11)}
            <span class="mono">${esc(r.code)}</span>
          </button>
        `,
          )
          .join('')}
        <button class="finlex-gov-chip faint" data-a="pop" data-pop="linkControl" data-sec="${s.id}" title="Link control">
          ${ic('plus', 11)}
          <span>Link</span>
        </button>
      </div>
    </div>
  </div>`;
}

function formatFinlexBody(rawText, status) {
  if (!rawText) return '';

  // If section was newly added
  if (status === 'ADDED') {
    return `<span class="finlex-ins">${esc(rawText)}</span>`;
  }
  // If section was deleted
  if (status === 'DELETED') {
    return `<span class="finlex-del">${esc(rawText)}</span>`;
  }

  // Format paragraphs and list items cleanly
  return esc(rawText)
    .replace(/^([0-9]+\)\s.+)$/gm, '<span style="display:block;padding-left:18px">$1</span>')
    .replace(/^([a-z]\)\s.+)$/gm, '<span style="display:block;padding-left:36px">$1</span>');
}
