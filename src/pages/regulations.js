/* ---------- FINLEX LEGISLATION EXPLORER ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, task } from '../core/store.js';
import { stIcon } from '../ui/helpers.js';
import { REGULATIONS, allChaptersOf, allRegulations, allSectionsOf, regulation } from '../data/regulations.js';

export function pageRegulations() {
  const u = S.ui;
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
          <!-- Act Switcher -->
          <div class="finlex-act-picker">
            <select class="finlex-act-select" data-in="regActSelect" aria-label="Valitse laki">
              ${allRegulations()
                .map(r => `<option value="${r.id}" ${r.id === curAct.id ? 'selected' : ''}>${esc(r.shortTitle || r.code)} (${esc(r.code)})</option>`)
                .join('')}
            </select>
          </div>

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

          <!-- Top Toolbar: Plain English & Language Controls -->
          <div class="finlex-toolbar">
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
