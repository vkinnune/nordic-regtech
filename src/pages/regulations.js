/* ---------- REGULATIONS EXPLORER (Starting Screen: Grid Library -> 2nd Screen: Reader) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import {
  S,
  task,
  REGULATIONS,
  allChaptersOf,
  allRegulations,
  allSectionsOf,
  regulation,
  policiesForSection,
  policiesNeedingReviewForSection,
  controlsForSection,
  impactedControlsForSection,
  risksForSection,
} from '../core/store.js';
import { stIcon } from '../ui/helpers.js';

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
  const libQ = (u.regLibQ || '').toLowerCase().trim();
  const juris = u.regLibJuris || 'all'; // 'all', 'fi', 'se', 'eu'
  const layout = u.regLibLayout || 'grid'; // 'grid' or 'list'

  const allActs = allRegulations();
  const filtered = allActs.filter(r => {
    // Jurisdiction filter
    if (juris === 'fi' && !r.jurisdiction.includes('Finland')) return false;
    if (juris === 'se' && !r.jurisdiction.includes('Sweden')) return false;
    if (juris === 'eu' && !r.jurisdiction.includes('European Union')) return false;

    // Search query
    if (libQ) {
      const matchCode = r.code && r.code.toLowerCase().includes(libQ);
      const matchTitle = r.title && r.title.toLowerCase().includes(libQ);
      const matchShort = r.shortTitle && r.shortTitle.toLowerCase().includes(libQ);
      const matchAuth = r.authority && r.authority.toLowerCase().includes(libQ);
      const matchSum = r.summary && r.summary.toLowerCase().includes(libQ);
      const matchJuris = r.jurisdiction && r.jurisdiction.toLowerCase().includes(libQ);
      const matchTag = r.tags && r.tags.some(t => t.toLowerCase().includes(libQ));
      if (!matchCode && !matchTitle && !matchShort && !matchAuth && !matchSum && !matchJuris && !matchTag) {
        return false;
      }
    }
    return true;
  });

  return `<div class="page flush">
    <div class="finlex-lib-wrap">
      <div class="finlex-lib-inner">

        <!-- Top Header: Super simple & uncluttered -->
        <header class="finlex-lib-head">
          <div class="finlex-lib-title-box">
            <h1 style="display:flex;align-items:center;gap:8px">
              ${ic('scale', 20)}
              <span>Säädökset</span>
            </h1>
            <p>Pohjoismainen finanssialan säädöskokoelma ja EU-direktiivit (${allActs.length})</p>
          </div>
          <div class="seg" role="tablist">
            <button class="${layout !== 'list' ? 'on' : ''}" data-a="setRegLibLayout" data-layout="grid" title="Korttinäkymä">${ic('layout-grid', 14)} Kortit</button>
            <button class="${layout === 'list' ? 'on' : ''}" data-a="setRegLibLayout" data-layout="list" title="Luettelonäkymä">${ic('list', 14)} Luettelo</button>
          </div>
        </header>

        <!-- Search & Jurisdiction Controls -->
        <div class="finlex-lib-controls">
          <div class="finlex-lib-search-bar">
            <div class="inwrap" style="flex:1">
              ${ic('search', 14)}
              <input class="input" style="height:36px;font-size:13.5px" data-in="regLibQ" placeholder="Etsi säädöstä nimellä, koodilla tai aiheella (esim. 747/2012, SFS 2004:46, DORA, AI)..." value="${esc(u.regLibQ || '')}">
              ${u.regLibQ ? `<button class="pillbtn" data-a="clearRegLibQ" style="padding:2px 6px">${ic('x', 12)}Tyhjennä</button>` : ''}
            </div>
          </div>

          <div class="finlex-lib-filters-row">
            <div class="finlex-lib-filter-pills">
              <button class="finlex-filter-pill ${juris === 'all' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="all">Kaikki (${allActs.length})</button>
              <button class="finlex-filter-pill ${juris === 'fi' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="fi">Suomi</button>
              <button class="finlex-filter-pill ${juris === 'se' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="se">Ruotsi</button>
              <button class="finlex-filter-pill ${juris === 'eu' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="eu">Euroopan unioni</button>
            </div>
          </div>
        </div>

        <!-- Result Views -->
        ${
          filtered.length === 0
            ? `
          <div class="empty" style="padding:48px 24px;border:1px dashed var(--border);border-radius:6px;background:var(--surface)">
            ${ic('search-x', 32)}
            <h3 style="margin:12px 0 4px;font-size:16px">Ei hakua vastaavia säädöksiä</h3>
            <p class="muted" style="margin:0 0 16px;font-size:13px">Hakusanalla "${esc(libQ)}" ei löytynyt säädöksiä.</p>
            <button class="btn btn-sm btn-ghost" data-a="clearRegLibFilters">${ic('refresh-cw', 13)} Nollaa suodattimet</button>
          </div>
        `
            : layout === 'list'
              ? renderRegulationsList(filtered)
              : renderRegulationsGrid(filtered)
        }

      </div>
    </div>
  </div>`;
}

function renderRegulationsGrid(acts) {
  return `<div class="finlex-lib-grid">
    ${acts
      .map(r => {
        const secs = allSectionsOf(r);
        return `<article class="finlex-lib-card" data-a="openRegInReader" data-id="${r.id}" title="Avaa säädös lukijassa">
        <div class="finlex-lib-card-top">
          <span class="finlex-jurisdiction-tag">${esc(r.jurisdiction)}</span>
          <span class="finlex-code-badge">${esc(r.code)}</span>
        </div>

        <h2 class="finlex-lib-card-title">${esc(r.shortTitle || r.title)}</h2>
        <p class="finlex-lib-card-desc">${esc(r.summary)}</p>

        <div class="finlex-lib-card-meta">
          <span>${esc(r.authority)}</span>
          <span>·</span>
          <span>${esc(r.inForce || 'Voimassa')}</span>
          <span>·</span>
          <span>${secs.length} pykälää</span>
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

function renderRegulationsList(acts) {
  return `<div class="finlex-lib-table-wrap">
    <table class="finlex-lib-table">
      <thead>
        <tr>
          <th style="width:300px">Säädös</th>
          <th>Lainkäyttöalue</th>
          <th>Valvova viranomainen</th>
          <th>Voimaantulo</th>
          <th>Laajuus</th>
        </tr>
      </thead>
      <tbody>
        ${acts
          .map(r => {
            const secs = allSectionsOf(r);
            return `<tr data-a="openRegInReader" data-id="${r.id}" title="Avaa ${esc(r.code)}">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(r.code)}</span>
                <span>${esc(r.shortTitle || r.title)}</span>
              </div>
            </td>
            <td><span class="faint" style="font-size:12px">${esc(r.jurisdiction)}</span></td>
            <td><span style="font-size:12px;font-weight:500">${esc(r.authority)}</span></td>
            <td><span class="mono faint" style="font-size:11.5px">${esc(r.inForce || 'Voimassa')}</span></td>
            <td><span style="font-size:12px">${secs.length} pykälää</span></td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  </div>`;
}

/* ============================================================
   2. SECOND SCREEN: FINLEX DOCUMENT READER VIEW
   ============================================================ */
function renderRegulationsReader(u) {
  const selActId = u.regSel || 'reg-finlex-747-2012';
  const curAct = regulation(selActId) || REGULATIONS[0];
  const q = (u.regQ || '').toLowerCase().trim();
  const showPlain = u.regPlain !== false;
  const lang = u.regLang || 'fi'; // 'fi' (original) or 'en' (translated)

  const allSecs = allSectionsOf(curAct);
  const activeSecId = u.regSec || (allSecs[0] ? allSecs[0].id : null);
  const chapters = allChaptersOf(curAct);

  return `<div class="page flush">
    <div class="finlex-container">

      <!-- LEFT SIDEBAR: Finlex Sisällysluettelo (TOC) -->
      <aside class="finlex-toc" aria-label="Sisällysluettelo">
        <div class="finlex-toc-top">
          <!-- Back to Library Button -->
          <button class="finlex-toc-back-btn" data-a="setRegView" data-view="library" title="Takaisin säädösluetteloon">
            ${ic('arrow-left', 13)}
            <span>Takaisin säädöksiin</span>
          </button>

          <!-- Current Act Title in Sidebar -->
          <div class="finlex-toc-act-label">
            <span class="mono" style="font-size:11px;color:var(--text-3)">${esc(curAct.code)}</span>
            <span class="trunc" style="font-weight:700;font-size:13px;color:var(--text)">${esc(curAct.shortTitle || curAct.title)}</span>
          </div>

          <!-- Sisällysluettelo Title -->
          <div class="finlex-toc-hdr-row">
            <h2 class="finlex-toc-title">
              ${ic('book-open', 13)}
              <span>Sisällysluettelo</span>
            </h2>
          </div>

          <!-- Section Search -->
          <div class="inwrap finlex-toc-search">
            ${ic('search', 13)}
            <input class="input search-sm" id="reg-toc-q" data-in="regQ" placeholder="Etsi pykälää..." value="${esc(u.regQ || '')}" aria-label="Etsi pykälää">
          </div>
        </div>

        <!-- TOC Hierarchical Tree -->
        <div class="finlex-toc-tree" data-keep="finlex-tree">
          ${renderFinlexTree(curAct, chapters, activeSecId, q)}
        </div>
      </aside>

      <!-- RIGHT MAIN CONTENT: Finlex Document Reader -->
      <main class="finlex-reader" id="finlex-doc-content" tabindex="-1">
        <div class="finlex-reader-inner">

          <!-- Act Document Header -->
          <header class="finlex-doc-head">
            <div class="finlex-doc-act-no">${esc(curAct.jurisdiction)} · ${esc(curAct.code)}</div>
            <h1 class="finlex-doc-title">${esc(curAct.shortTitle || curAct.title)}</h1>
            <div class="finlex-doc-meta">
              <span>Voimaantulo: <b>${esc(curAct.inForce || 'Voimassa')}</b></span>
              <span>·</span>
              <span>Valvoja: <b>${esc(curAct.authority)}</b></span>
              ${curAct.amendedBy ? `<span>·</span><span>Muutossäädös: <b>${esc(curAct.amendedBy)}</b></span>` : ''}
            </div>
          </header>

          <!-- Simple Toolbar: Plain English and Language Toggles Only -->
          <div class="finlex-toolbar">
            <button class="btn btn-sm ${showPlain ? 'btn-primary' : 'btn-ghost'}" data-a="toggleRegPlain" title="Näytä selkokielinen tiivistelmä">
              ${ic('sparkles', 13)}
              <span>Selkokieli</span>
            </button>
            <button class="btn btn-sm btn-ghost" data-a="toggleRegLang" title="Vaihda kieltä">
              ${ic('languages', 13)}
              <span>${lang === 'en' ? 'English' : 'Alkuperäinen'}</span>
            </button>
            <span class="sp"></span>
            ${
              q
                ? `<button class="pillbtn" data-a="set" data-k="regQ" data-v="" style="font-size:11.5px">
                    ${ic('x', 12)}Tyhjennä haku
                  </button>`
                : ''
            }
          </div>

          <!-- Statutory Sections Stream -->
          <div class="finlex-sections-stream">
            ${renderFinlexSections(chapters, activeSecId, showPlain, lang, q)}
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
          s.text.toLowerCase().includes(q) ||
          (s.plainEnglish && s.plainEnglish.summary.toLowerCase().includes(q))
        );
      });

      if (q && !matchingSecs.length) return '';

      const secItems = matchingSecs
        .map(s => {
          const isActive = s.id === activeSecId;
          return `<button class="finlex-tree-sec ${isActive ? 'active' : ''}" data-a="selectSec" data-id="${s.id}" title="${esc(s.number)} ${esc(s.heading)}">
          ${esc(s.number)} - ${esc(s.heading)}
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

function renderFinlexSections(chapters, activeSecId, showPlain, lang, q) {
  return chapters
    .map(ch => {
      const matchingSecs = (ch.sections || []).filter(s => {
        if (!q) return true;
        return (
          s.number.toLowerCase().includes(q) ||
          s.heading.toLowerCase().includes(q) ||
          s.text.toLowerCase().includes(q) ||
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
          ${matchingSecs.map(s => renderSectionBlock(s, activeSecId, showPlain, lang)).join('')}
        </div>
      `;
    })
    .join('');
}

function renderSectionBlock(s, activeSecId, showPlain, lang) {
  const isActive = s.id === activeSecId;
  const t = s.taskId ? task(s.taskId) : null;
  const textToShow = lang === 'en' && s.textEn ? s.textEn : s.text;

  return `<article class="finlex-sec ${isActive ? 'active' : ''}" id="sec-${s.id}">
    <!-- Section Citation & Heading -->
    <header class="finlex-sec-head">
      <div class="finlex-sec-cite">
        <span class="finlex-sec-num">${esc(s.number)}</span>
        ${s.amendingAct ? `<span class="finlex-sec-amendment">${esc(s.amendingAct)}</span>` : ''}
      </div>
      <h3 class="finlex-sec-title">${esc(s.heading)}</h3>
    </header>

    <!-- PLAIN ENGLISH BOX (Clean, simple, no fancy colors) -->
    ${
      showPlain && s.plainEnglish
        ? `<div class="finlex-plain-box">
            <div class="finlex-plain-tag">${ic('sparkles', 11)} Selkokielellä:</div>
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

    <!-- STATUTORY BODY TEXT -->
    <div class="finlex-body">
      ${formatFinlexBody(textToShow, s.status)}
    </div>

    <!-- GOVERNANCE & CONTROLS STRIP (Policies, Controls, Risks & Impact Alerts) -->
    ${renderSectionGovernanceStrip(s)}

    <!-- METADATA & LINKED TASKS -->
    <footer class="finlex-sec-foot">
      ${
        s.crossRefs && s.crossRefs.length
          ? s.crossRefs
              .map(
                cr => `
            <button class="finlex-ref-chip" data-a="openRegInReader" data-id="${cr.regId}" title="Siirry säädökseen">
              ${ic('link-2', 11)}Viite: ${esc(cr.label)}
            </button>
          `,
              )
              .join('')
          : ''
      }
      ${
        t
          ? `<button class="finlex-task-btn" data-a="openTask" data-id="${t.id}" title="Avaa tehtävä ja lakimuutoksen vaatimukset">
              ${stIcon(t.status, 12)}
              <span>Tehtävä: <b>${esc(t.key)}</b> (${esc(t.title)})</span>
              ${ic('arrow-right', 12)}
            </button>`
          : ''
      }
    </footer>
  </article>`;
}

function renderSectionGovernanceStrip(s) {
  const pols = policiesForSection(s.id);
  const ctls = controlsForSection(s.id);
  const rsks = risksForSection(s.id);
  const impacted = impactedControlsForSection(s.id);
  const reviewPols = policiesNeedingReviewForSection(s.id);

  if (!pols.length && !ctls.length && !rsks.length && s.status !== 'MODIFIED' && s.status !== 'ADDED') return '';

  return `<div class="finlex-gov-strip">
    <div class="finlex-gov-row">
      <span class="finlex-gov-label">${ic('shield', 12)} Hallinto & Kontrollit:</span>
      <div class="finlex-gov-chips">
        ${pols
          .map(
            p => `
          <button class="finlex-gov-chip ${p.status === 'NEEDS_REVIEW' ? 'alert' : ''}" data-a="openGovDrawer" data-type="policy" data-id="${p.id}" title="Avaa käytäntö ${esc(p.code)}: ${esc(p.title)}">
            ${ic('file-text', 11)}
            <span class="mono">${esc(p.code)}</span>
          </button>
        `,
          )
          .join('')}
        ${ctls
          .map(
            c => `
          <button class="finlex-gov-chip ${c.status === 'DEFICIENT' ? 'alert' : ''}" data-a="openGovDrawer" data-type="control" data-id="${c.id}" title="Avaa kontrolli ${esc(c.code)}: ${esc(c.title)}">
            ${c.status === 'DEFICIENT' ? ic('alert-triangle', 11) : ic('check', 11)}
            <span class="mono">${esc(c.code)}</span>
          </button>
        `,
          )
          .join('')}
        ${rsks
          .map(
            r => `
          <button class="finlex-gov-chip" data-a="openGovDrawer" data-type="risk" data-id="${r.id}" title="Säädösriski: ${esc(r.title)}">
            ${ic('alert-octagon', 11)}
            <span class="mono">${esc(r.code)}</span>
          </button>
        `,
          )
          .join('')}
        <button class="finlex-gov-chip faint" data-a="pop" data-pop="linkControl" data-sec="${s.id}" title="Linkitä kontrolli">
          ${ic('plus', 11)}
          <span>Linkitä</span>
        </button>
      </div>
    </div>

    <!-- Policy Review Alert -->
    ${
      reviewPols.length
        ? reviewPols
            .map(
              p => `
          <div class="finlex-impact-banner" style="border-left: 3px solid var(--text-3)">
            <div class="finlex-impact-head">
              <span style="display:flex;align-items:center;gap:6px">
                ${ic('file-text', 13)}
                <span>Käytännön katselmointitarve: <b>${esc(p.code)}</b> (${esc(p.title)})</span>
              </span>
              <span class="mono faint" style="font-size:11px">${esc(s.amendingAct || 'Päivitys vaaditaan')}</span>
            </div>
            <div class="muted" style="font-size:11.5px;line-height:1.4">
              Lakimuutos edellyttää sisäisen toimintaohjeen ja käytäntödokumentaation tarkastamista ja hyväksyntää.
            </div>
            <div class="finlex-impact-actions">
              <button class="btn btn-sm btn-primary" data-a="createPolicyUpdateTask" data-id="${p.id}" data-sec="${s.id}" style="padding:2px 8px;font-size:11px">
                ${ic('plus', 11)} Luo päivitystehtävä
              </button>
              <button class="btn btn-sm btn-ghost" data-a="signOffPolicy" data-id="${p.id}" style="padding:2px 8px;font-size:11px">
                ${ic('check-circle', 11)} Kuittaa katselmoiduksi
              </button>
            </div>
          </div>
        `,
            )
            .join('')
        : ''
    }

    <!-- Law Change Impact Assessment Alerts for impacted controls -->
    ${
      impacted.length
        ? impacted
            .map(
              c => `
          <div class="finlex-impact-banner">
            <div class="finlex-impact-head">
              <span style="display:flex;align-items:center;gap:6px">
                ${ic('alert-circle', 13)}
                <span>Säädösmuutos vaikuttaa kontrolliin <b>${esc(c.code)}</b> (${esc(c.title)})</span>
              </span>
              <span class="mono faint" style="font-size:11px">${esc(s.amendingAct || '')}</span>
            </div>
            <div class="muted" style="font-size:11.5px;line-height:1.4">
              ${esc(c.amendmentAlert || 'Kontrollin toimivuus ja raja-arvot on todennettava vastaamaan lakimuutosta.')}
            </div>
            <div class="finlex-impact-actions">
              <button class="btn btn-sm btn-primary" data-a="createMitigationTask" data-sec="${s.id}" data-ctl="${c.id}" style="padding:2px 8px;font-size:11px">
                ${ic('plus', 11)} Luo päivitystehtävä
              </button>
              <button class="btn btn-sm btn-ghost" data-a="resolveGap" data-id="${c.id}" style="padding:2px 8px;font-size:11px">
                ${ic('check-circle', 11)} Kuittaa huomioiduksi
              </button>
              <button class="btn btn-sm btn-ghost" data-a="pop" data-pop="linkControl" data-sec="${s.id}" style="padding:2px 8px;font-size:11px">
                ${ic('link-2', 11)} Linkitä kontrolli
              </button>
            </div>
          </div>
        `,
            )
            .join('')
        : ''
    }
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
