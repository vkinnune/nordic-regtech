/* ---------- FINLEX LEGISLATION EXPLORER & REGULATIONS LIBRARY ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, task, REGULATIONS, allChaptersOf, allRegulations, allSectionsOf, regulation } from '../core/store.js';
import { stIcon } from '../ui/helpers.js';

export function pageRegulations() {
  const u = S.ui;
  if (u.regView === 'library') {
    return renderRegulationsLibrary(u);
  }
  return renderRegulationsReader(u);
}

/* ============================================================
   REGULATIONS LIBRARY VIEW (Catalogue, Grid & List Layouts)
   ============================================================ */
function renderRegulationsLibrary(u) {
  const libQ = (u.regLibQ || '').toLowerCase().trim();
  const juris = u.regLibJuris || 'all'; // 'all', 'fi', 'se', 'eu'
  const tagFilter = u.regLibTag || '';
  const layout = u.regLibLayout || 'grid'; // 'grid' or 'list'

  const allActs = allRegulations();
  const filtered = allActs.filter(r => {
    // Jurisdiction filter
    if (juris === 'fi' && !r.jurisdiction.includes('Finland')) return false;
    if (juris === 'se' && !r.jurisdiction.includes('Sweden')) return false;
    if (juris === 'eu' && !r.jurisdiction.includes('European Union')) return false;

    // Tag filter
    if (tagFilter && !(r.tags || []).includes(tagFilter)) return false;

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

  const popularTags = ['Funds', 'AI', 'AlgorithmicTrading', 'Risk', 'DORA', 'AML', 'MiFID', 'ESG', 'Conduct'];

  return `<div class="page flush">
    <div class="finlex-lib-wrap">
      <div class="finlex-lib-inner">

        <!-- Top Header -->
        <header class="finlex-lib-head">
          <div class="finlex-lib-title-box">
            <h1 style="display:flex;align-items:center;gap:8px">
              ${ic('scale', 22)}
              <span>Lakikirjasto · Regulations Library</span>
            </h1>
            <p>Pohjoismainen finanssialan säädöskokoelma, EU-direktiivit ja valvontamääräykset · ${allActs.length} säädöstä arkistossa</p>
          </div>
          <div class="row" style="gap:8px">
            <div class="seg" role="tablist">
              <button class="${layout !== 'list' ? 'on' : ''}" data-a="setRegLibLayout" data-layout="grid" title="Korttinäkymä (Grid)">${ic('layout-grid', 14)} Kortit</button>
              <button class="${layout === 'list' ? 'on' : ''}" data-a="setRegLibLayout" data-layout="list" title="Taulukkonäkymä (List)">${ic('list', 14)} Luettelo</button>
            </div>
            <button class="btn btn-sm btn-primary" data-a="setRegView" data-view="reader" title="Avaa Finlex-lukija">
              ${ic('book-open', 14)}
              <span>Finlex-lukija</span>
            </button>
          </div>
        </header>

        <!-- Search & Filter Controls -->
        <div class="finlex-lib-controls">
          <div class="finlex-lib-search-bar">
            <div class="inwrap" style="flex:1">
              ${ic('search', 14)}
              <input class="input" style="height:36px;font-size:13.5px" data-in="regLibQ" placeholder="Hae lakia, pykälää, säädöskoodia, valvojaa tai asiasanaa (esim. 747/2012, SFS 2004:46, DORA, AI)..." value="${esc(u.regLibQ || '')}">
              ${u.regLibQ ? `<button class="pillbtn" data-a="clearRegLibQ" style="padding:2px 6px">${ic('x', 12)}Tyhjennä</button>` : ''}
            </div>
          </div>

          <div class="finlex-lib-filters-row">
            <div class="finlex-lib-filter-pills">
              <span class="faint" style="font-size:12px;font-weight:600;margin-right:4px">Lainkäyttö:</span>
              <button class="finlex-filter-pill ${juris === 'all' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="all">Kaikki (${allActs.length})</button>
              <button class="finlex-filter-pill ${juris === 'fi' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="fi">Suomi · Finlex</button>
              <button class="finlex-filter-pill ${juris === 'se' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="se">Ruotsi · SFS</button>
              <button class="finlex-filter-pill ${juris === 'eu' ? 'on' : ''}" data-a="setRegLibJuris" data-juris="eu">Euroopan unioni · EU</button>
            </div>

            <div class="finlex-lib-filter-pills">
              <span class="faint" style="font-size:12px;font-weight:600;margin-right:4px">Aihealueet:</span>
              ${popularTags
                .map(
                  t => `
                <button class="finlex-filter-pill ${tagFilter === t ? 'on' : ''}" data-a="setRegLibTag" data-tag="${t}">${esc(t)}</button>
              `,
                )
                .join('')}
              ${tagFilter ? `<button class="pillbtn" data-a="setRegLibTag" data-tag="" style="font-size:11.5px">${ic('x', 11)}Nollaa aihe</button>` : ''}
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
            <p class="muted" style="margin:0 0 16px;font-size:13px">Hakusanalla "${esc(libQ || tagFilter)}" ei löytynyt säädöksiä tai määräyksiä.</p>
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
        return `<article class="finlex-lib-card" data-a="openRegInReader" data-id="${r.id}" title="Avaa säädös Finlex-lukijassa">
        <div class="finlex-lib-card-top">
          <span class="finlex-jurisdiction-tag">${esc(r.jurisdiction)}</span>
          <span class="finlex-code-badge">${esc(r.code)}</span>
        </div>

        <h2 class="finlex-lib-card-title">${esc(r.shortTitle || r.title)}</h2>
        <p class="finlex-lib-card-desc">${esc(r.summary)}</p>

        <div class="finlex-lib-card-meta">
          <span>${ic('landmark', 12)} ${esc(r.authority)}</span>
          <span>·</span>
          <span>${ic('calendar', 12)} Voimaantulo: <b>${esc(r.inForce || 'Voimassa')}</b></span>
          <span>·</span>
          <span>${ic('file-text', 12)} ${secs.length} pykälää</span>
        </div>

        <div class="finlex-lib-card-foot">
          <div class="row" style="gap:4px;flex-wrap:wrap">
            ${(r.tags || [])
              .slice(0, 3)
              .map(t => `<span class="pill" style="font-size:10.5px;padding:1px 6px">${esc(t)}</span>`)
              .join('')}
          </div>
          <button class="finlex-btn-link" style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px">
            <span>Lue pykälät</span>
            ${ic('arrow-right', 12)}
          </button>
        </div>
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
          <th style="width:280px">Säädöskoodi ja nimi</th>
          <th>Lainkäyttöalue</th>
          <th>Valvova viranomainen</th>
          <th>Voimaantulo</th>
          <th>Laajuus</th>
          <th style="text-align:right">Toiminto</th>
        </tr>
      </thead>
      <tbody>
        ${acts
          .map(r => {
            const secs = allSectionsOf(r);
            return `<tr data-a="openRegInReader" data-id="${r.id}" title="Avaa ${esc(r.code)} Finlex-lukijassa">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(r.code)}</span>
                <span>${esc(r.shortTitle || r.title)}</span>
              </div>
              <div class="muted trunc" style="font-size:11.5px;max-width:320px;margin-top:2px">${esc(r.title)}</div>
            </td>
            <td><span class="faint" style="font-size:12px">${esc(r.jurisdiction)}</span></td>
            <td><span style="font-size:12px;font-weight:500">${esc(r.authority)}</span></td>
            <td><span class="mono faint" style="font-size:11.5px">${esc(r.inForce || 'Voimassa')}</span></td>
            <td><span style="font-size:12px">${secs.length} pykälää</span></td>
            <td style="text-align:right">
              <button class="btn btn-sm btn-ghost" data-a="openRegInReader" data-id="${r.id}" style="padding:3px 8px;font-size:11.5px">
                ${ic('book-open', 12)} Avaa ➔
              </button>
            </td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>
  </div>`;
}

/* ============================================================
   FINLEX DOCUMENT READER VIEW
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
          <!-- Act Switcher Combobox / Picker -->
          ${renderLawPicker(curAct, u)}

          <!-- Sisällysluettelo Header & Actions -->
          <div class="finlex-toc-hdr-row">
            <h2 class="finlex-toc-title">
              ${ic('book-open', 14)}
              <span>Sisällysluettelo</span>
            </h2>
            <div class="finlex-toc-tools">
              <button class="finlex-btn-link" data-a="set" data-k="regTocCollapse" data-v="1" title="Supista kaikki">Supista</button>
              <button class="finlex-btn-link" data-a="set" data-k="regTocCollapse" data-v="0" title="Laajenna kaikki">Laajenna</button>
            </div>
          </div>

          <!-- Section Search -->
          <div class="inwrap finlex-toc-search">
            ${ic('search', 13)}
            <input class="input search-sm" id="reg-toc-q" data-in="regQ" placeholder="Etsi pykälää tai tekstiä…" value="${esc(u.regQ || '')}" aria-label="Etsi pykälää">
          </div>
        </div>

        <!-- TOC Hierarchical Tree -->
        <div class="finlex-toc-tree" data-keep="finlex-tree">
          ${renderFinlexTree(curAct, chapters, activeSecId, q, u.regTocCollapse === '1')}
        </div>
      </aside>

      <!-- RIGHT MAIN CONTENT: Finlex Document Reader -->
      <main class="finlex-reader" id="finlex-doc-content" tabindex="-1">
        <div class="finlex-reader-inner">

          <!-- Act Document Header -->
          <header class="finlex-doc-head">
            <div class="finlex-doc-act-no">${esc(curAct.jurisdiction)} · ${esc(curAct.code)}</div>
            <h1 class="finlex-doc-title">${esc(curAct.title)}</h1>
            <div class="finlex-doc-meta">
              <span>Voimaantulo: <b>${esc(curAct.inForce || 'Voimassa')}</b></span>
              <span>·</span>
              <span>Valvoja: <b>${esc(curAct.authority)}</b></span>
              ${curAct.amendedBy ? `<span>·</span><span>Muutossäädös: <b>${esc(curAct.amendedBy)}</b></span>` : ''}
              <span>·</span>
              <span>Säädöskokoelma (SDK)</span>
            </div>
          </header>

          <!-- Top Toolbar: Plain English, Language & Library Jump -->
          <div class="finlex-toolbar">
            <button class="btn btn-sm btn-ghost" data-a="setRegView" data-view="library" title="Siirry lakikirjastoon">
              ${ic('layout-grid', 13)}
              <span>Lakikirjasto (Library)</span>
            </button>
            <button class="btn btn-sm ${showPlain ? 'btn-primary' : 'btn-ghost'}" data-a="toggleRegPlain" title="Näytä selkokielinen tiivistelmä">
              ${ic('sparkles', 13)}
              <span>Selkokielinen tiivistelmä (Plain English)</span>
            </button>
            <button class="btn btn-sm btn-ghost" data-a="toggleRegLang" title="Vaihda kieltä">
              ${ic('languages', 13)}
              <span>Kieli: <b>${lang === 'en' ? 'English (Käännös)' : 'Alkuperäisteksti (FI/SV)'}</b></span>
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

function renderLawPicker(curAct, u) {
  const pickerQ = (u.regPickerQ || '').toLowerCase().trim();
  const isOpen = !!u.regPickerOpen;
  const allActs = allRegulations();
  const filteredActs = allActs.filter(r => {
    if (!pickerQ) return true;
    return (
      (r.code && r.code.toLowerCase().includes(pickerQ)) ||
      (r.title && r.title.toLowerCase().includes(pickerQ)) ||
      (r.shortTitle && r.shortTitle.toLowerCase().includes(pickerQ)) ||
      (r.authority && r.authority.toLowerCase().includes(pickerQ)) ||
      (r.jurisdiction && r.jurisdiction.toLowerCase().includes(pickerQ)) ||
      (r.tags && r.tags.some(t => t.toLowerCase().includes(pickerQ)))
    );
  });

  return `<div class="finlex-picker-box">
    <button class="finlex-picker-trigger" data-a="toggleRegPicker" title="Vaihda säädöstä">
      <span style="display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;text-overflow:ellipsis">
        ${ic('book-open', 14)}
        <span class="trunc"><b>${esc(curAct.shortTitle || curAct.code)}</b> <span class="mono faint">(${esc(curAct.code)})</span></span>
      </span>
      ${ic(isOpen ? 'chevron-up' : 'chevron-down', 13)}
    </button>

    ${
      isOpen
        ? `
      <div class="finlex-picker-menu">
        <div class="inwrap" style="width:100%">
          ${ic('search', 13)}
          <input class="input search-sm" id="finlex-picker-search" data-in="regPickerQ" placeholder="Etsi säädöstä (koodi, nimi, aihe)..." value="${esc(u.regPickerQ || '')}" autofocus>
          ${u.regPickerQ ? `<button class="pillbtn" data-a="clearRegPickerQ" style="padding:1px 4px">${ic('x', 11)}</button>` : ''}
        </div>
        <div class="finlex-picker-list">
          ${
            filteredActs.length
              ? filteredActs
                  .map(
                    r => `
            <button class="finlex-picker-item ${r.id === curAct.id ? 'on' : ''}" data-a="selectReg" data-id="${r.id}">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:6px">
                <span style="font-weight:600;font-size:12.5px">${esc(r.shortTitle || r.title)}</span>
                <span class="mono faint" style="font-size:11px">${esc(r.code)}</span>
              </div>
              <div style="font-size:11px;color:var(--text-3);display:flex;gap:6px;align-items:center">
                <span>${esc(r.jurisdiction)}</span>
                <span>·</span>
                <span>${esc(r.authority)}</span>
              </div>
            </button>
          `,
                  )
                  .join('')
              : `<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">Ei hakutuloksia</div>`
          }
        </div>
        <button class="btn btn-sm btn-ghost" data-a="setRegView" data-view="library" style="width:100%;justify-content:center;margin-top:4px;border-top:1px solid var(--border);border-radius:0 0 4px 4px;padding-top:6px">
          ${ic('layout-grid', 13)} <span>Avaa lakikirjasto</span>
        </button>
      </div>
    `
        : ''
    }
  </div>`;
}

function renderFinlexTree(act, chapters, activeSecId, q, isCollapsed) {
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

      const secItems =
        isCollapsed && !q
          ? ''
          : matchingSecs
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
          ${ic(isCollapsed && !q ? 'chevron-right' : 'chevron-down', 11)}
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

  return `<article class="finlex-sec ${isActive ? 'active' : 'inactive'}" id="sec-${s.id}">
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
            <div class="finlex-plain-tag">${ic('sparkles', 11)} Mitä tämä tarkoittaa selkokielellä / In plain English:</div>
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

    <!-- METADATA & LINKED TASKS -->
    <footer class="finlex-sec-foot">
      ${
        s.crossRefs && s.crossRefs.length
          ? s.crossRefs
              .map(
                cr => `
            <button class="finlex-ref-chip" data-a="selectReg" data-id="${cr.regId}" title="Siirry säädökseen">
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
