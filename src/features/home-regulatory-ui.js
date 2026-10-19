import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allRegulations, allChanges, visibleProjects, canSee, allPolicies, allControls, formatChangeSecLabel } from '../core/store.js';
import { empty } from '../ui/helpers.js';
import { buildHomeBriefing, filterHomeBriefing } from './home-regulatory-model.js';
const date = value =>
  value ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)) : 'Date not supplied';
const reader = reg => `data-a="go" data-r="regulations" data-id="${esc(reg.id)}"`;
const record = (type, item) =>
  `<button class="pillbtn" ${type === 'project' ? `data-a="go" data-r="project" data-tab="overview"` : `data-a="openGovDrawer" data-type="${type}"`} data-id="${esc(item.id)}">${ic(type === 'project' ? 'folder' : type === 'policy' ? 'file-text' : 'shield-check', 12)}${esc(item.shortTitle || item.name || item.title)}</button>`;
function sourceLink(reg) {
  const url = reg.sourceUrl || reg.pdfUrl;
  return /^https?:\/\//i.test(url || '')
    ? `<a class="home-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Official source ${ic('external-link', 11)}</a>`
    : '';
}
function row(g) {
  const c = g.context,
    reg = g.reg,
    change = g.kind === 'change';
  const label =
    g.kind === 'library'
      ? 'Added to library'
      : g.kind === 'new'
        ? 'New regulation'
        : g.phase === 'upcoming'
          ? 'Upcoming change'
          : g.phase === 'recent'
            ? 'Recently effective'
            : g.phase === 'undated'
              ? 'Date to confirm'
              : 'Earlier change';
  const when = g.kind === 'library' ? `Added ${date(g.added)}` : g.date ? `Effective ${date(g.date)}` : 'Effective date not supplied';
  const status = change
    ? `${g.events.length} ${g.events.length === 1 ? 'change' : 'changes'}${g.amendingAct ? ` · ${g.amendingAct}` : ''}`
    : g.kind === 'library'
      ? `Effective ${date(g.date)}`
      : g.issueDate
        ? `Issued ${date(g.issueDate)}`
        : '';
  return `<article class="home-reg-item"><div class="home-reg-meta"><span class="home-reg-kind ${g.phase === 'upcoming' || (g.kind === 'new' && g.date > new Date().toISOString().slice(0, 10)) ? 'is-upcoming' : ''}">${ic(change ? 'git-compare-arrows' : 'book-open', 12)}${label}</span><span>${esc(c.country)}</span><span class="mono">${esc(reg.code)}</span></div><button class="home-reg-title" ${change ? `data-a="openChangeDrawer" data-id="${esc(g.events[0].id)}"` : reader(reg)}>${esc(reg.title)}</button><div class="home-reg-dates"><span>${when}</span>${status ? `<span>${esc(status)}</span>` : ''}</div><details class="home-reg-context"><summary>${ic('link', 12)}${c.linked ? 'Related work' : 'Details'}${c.projects.length ? `<span>${c.projects.length} ${c.projects.length === 1 ? 'project' : 'projects'}</span>` : ''}${ic('chevron-down', 12)}</summary><div class="home-reg-context-body">${c.projects.length || c.policies.length || c.controls.length ? `<div class="home-context-links">${c.projects.map(p => record('project', p)).join('')}${c.policies.map(p => record('policy', p)).join('')}${c.controls.map(p => record('control', p)).join('')}</div>` : ''}${change ? `<div class="home-change-sections">${g.events.map(e => `<button class="pillbtn" data-a="openChangeDrawer" data-id="${esc(e.id)}">${esc(formatChangeSecLabel(e))} · ${esc({ MODIFIED: 'Changed', ADDED: 'Added', REPEALED: 'Repealed' }[e.status] || e.status)}</button>`).join('')}</div>` : ''}<div class="home-reg-links"><button class="btn btn-secondary btn-sm" ${reader(reg)}>Open regulation ${ic('arrow-up-right', 12)}</button>${sourceLink(reg)}</div></div></details></article>`;
}
export function homeRegulatoryBriefing() {
  const b = buildHomeBriefing({
    regulations: allRegulations(),
    events: allChanges(),
    projects: visibleProjects().filter(canSee),
    policies: allPolicies(),
    controls: allControls(),
  });
  const tab = S.ui.homeRegTab || 'changes',
    period = S.ui.homeRegPeriod || 'focus';
  const filtered = filterHomeBriefing(b, { tab, period, query: S.ui.homeRegQuery || '' });
  const limit = S.ui.homeRegLimit || 3;
  return `<section class="panel home-briefing" aria-labelledby="home-reg-heading"><div class="home-brief-heading"><h2 id="home-reg-heading">Regulatory updates</h2></div><div class="home-brief-grid"><div class="home-brief-main"><div class="home-reg-tabs" role="tablist" aria-label="Regulatory update views">${[
    ['changes', 'Changes', filterHomeBriefing(b, { period }).length],
    ['new', 'New regulations', b.newRegulations.length],
    ['library', 'Added to library', b.library.length],
  ]
    .map(
      ([v, l, n]) =>
        `<button id="home-reg-tab-${v}" role="tab" aria-controls="home-reg-results" aria-selected="${tab === v}" class="${tab === v ? 'on' : ''}" data-a="homeRegTab" data-value="${v}">${l}<span>${n}</span></button>`,
    )
    .join(
      '',
    )}</div><div class="home-reg-filters"><div class="inwrap">${ic('search', 13)}<input class="input search-sm" id="home-reg-search" aria-label="Search regulatory updates" placeholder="Search regulations or amendments…" data-in="homeRegSearch" value="${esc(S.ui.homeRegQuery || '')}"></div>${
    tab === 'changes'
      ? `<select class="input" id="home-reg-period" aria-label="Change period" data-in="homeRegPeriod">${[
          ['focus', 'Recent & upcoming'],
          ['upcoming', 'Upcoming'],
          ['recent', 'Effective in last 90 days'],
          ['all', 'All recorded changes'],
        ]
          .map(([v, l]) => `<option value="${v}" ${period === v ? 'selected' : ''}>${l}</option>`)
          .join('')}</select>`
      : ''
  }</div><div id="home-reg-results" role="tabpanel" aria-labelledby="home-reg-tab-${tab}">${filtered.length ? filtered.slice(0, limit).map(row).join('') : empty('search', 'No matching regulatory items', 'Try another search or date range.', `<button class="btn btn-secondary btn-sm" data-a="homeRegReset">Reset view</button>`, 'sm')}</div><div class="home-brief-footer"><span>${Math.min(limit, filtered.length)} of ${filtered.length} items</span>${filtered.length > limit ? '<button class="btn btn-ghost btn-sm" data-a="homeRegMore">Show more</button>' : ''}<button class="btn btn-ghost btn-sm" data-a="homeAllChanges">All changes ${ic('arrow-up-right', 13)}</button></div></div><aside class="home-brief-side" aria-label="Regulatory dates"><div class="home-horizon-heading">${ic('calendar-clock', 16)}<h3>Coming into effect</h3></div><p class="home-horizon-summary"><strong>${b.soon}</strong> ${b.soon === 1 ? 'item' : 'items'} in the next 90 days</p><div class="home-horizon">${
    b.upcoming
      .slice(0, 3)
      .map(
        g =>
          `<button data-a="${g.kind === 'change' ? 'openChangeDrawer' : 'go'}" ${g.kind === 'change' ? `data-id="${esc(g.events[0].id)}"` : `data-r="regulations" data-id="${esc(g.reg.id)}"`}><span class="home-horizon-dot"></span><time>${date(g.date)}</time><strong>${esc(g.amendingAct || g.reg.code)}</strong><span>${esc(g.reg.shortTitle || g.reg.title)}</span></button>`,
      )
      .join('') || '<p class="muted">No upcoming dates.</p>'
  }</div>${b.upcoming.length ? '<button class="btn btn-secondary btn-sm" data-a="homeShowUpcoming">View upcoming changes</button>' : ''}</aside></div></section>`;
}
