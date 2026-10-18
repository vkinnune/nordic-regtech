import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allPolicies, allControls, policy, control, isPolicyImpacted, isControlImpacted, regulationOfSection } from '../core/store.js';
import { empty, formatSecBadge } from '../ui/helpers.js';
import { displayStatus, statusNames, isOverdue, today } from './governance-model.js';

const config = {
  policy: {
    plural: 'Policies',
    icon: 'file-text',
    query: 'polQ',
    filter: 'polStatus',
    due: 'nextReviewDue',
    statuses: ['all', 'NEEDS_REVIEW', 'ACTIVE', 'DRAFT', 'RETIRED'],
  },
  control: {
    plural: 'Controls',
    icon: 'shield-check',
    query: 'ctlQ',
    filter: 'ctlFilter',
    due: 'nextTestDue',
    statuses: ['all', 'DEFICIENT', 'EFFECTIVE', 'UNIMPLEMENTED', 'RETIRED'],
  },
};
const statusOf = (x, type) =>
  displayStatus(x, type, type === 'policy' ? isPolicyImpacted(x) || (x.status === 'ACTIVE' && isOverdue(x.nextReviewDue)) : isControlImpacted(x));
const listFor = type => (type === 'policy' ? allPolicies() : allControls());
const itemFor = (type, id) => (type === 'policy' ? policy(id) : control(id));
const dateText = date =>
  date
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date.slice(0, 10)}T12:00:00`))
    : 'Not scheduled';
export function governanceBadge(status) {
  const tone = ['ACTIVE', 'EFFECTIVE'].includes(status) ? 'ok' : ['DEFICIENT', 'NEEDS_REVIEW'].includes(status) ? 'alert' : 'draft';
  return `<span class="gov-badge gov-status-${tone}"><span class="gov-status-dot"></span>${esc(statusNames[status] || status)}</span>`;
}
const recordButton = (type, item) =>
  `<button class="gov-record-link" data-a="openGovDrawer" data-type="${type}" data-id="${esc(item.id)}"><span class="mono faint">${esc(item.code)}</span><strong>${esc(item.shortTitle || item.title)}</strong></button>`;
export function governanceRegistry(type) {
  const c = config[type],
    all = listFor(type),
    u = S.ui;
  const filter = u[c.filter] || 'all',
    q = (u[c.query] || '').trim().toLowerCase();
  const sort = u[`${type}Sort`] || 'due';
  const active = all.filter(x => x.status !== 'RETIRED');
  const attention = active.filter(x => ['NEEDS_REVIEW', 'DEFICIENT'].includes(statusOf(x, type)) || isOverdue(x[c.due]));
  const filtered = all.filter(
    x =>
      (filter === 'all' ? x.status !== 'RETIRED' : filter === 'due' ? x.status !== 'RETIRED' && isOverdue(x[c.due]) : statusOf(x, type) === filter) &&
      (!u[`${type}Category`] || x.category === u[`${type}Category`]) &&
      (!u[`${type}Type`] || x.type === u[`${type}Type`]) &&
      (!q || [x.code, x.title, x.owner, x.category, x.summary, x.specification, ...(x.statuteSections || [])].join(' ').toLowerCase().includes(q)),
  );
  filtered.sort((a, b) =>
    sort === 'title'
      ? a.title.localeCompare(b.title)
      : sort === 'owner'
        ? a.owner.localeCompare(b.owner)
        : (a[c.due] || '9999').localeCompare(b[c.due] || '9999') || a.title.localeCompare(b.title),
  );
  const categories = [...new Set(all.map(x => x.category))].sort();
  const tested = active.filter(x => statusOf(x, type) === (type === 'policy' ? 'ACTIVE' : 'EFFECTIVE')).length;
  const totalLinked =
    type === 'policy'
      ? allControls().filter(x => x.status !== 'RETIRED' && active.some(p => p.id === x.policyId)).length
      : new Set(active.map(x => x.policyId).filter(Boolean)).size;
  return `<div class="page wide governance-page">
    <div class="ph"><div><div class="gov-eyebrow">Governance <span class="pill">Demo data</span></div><h1>${c.plural}</h1><p>${type === 'policy' ? 'Keep standards current, accountable, and connected to your controls.' : 'Track safeguards, test their effectiveness, and retain the evidence.'}</p></div><div class="acts"><button class="btn btn-primary" data-a="govNew" data-type="${type}">${ic('plus', 14)} New ${type}</button></div></div>
    <div class="stats gov-stats">
      <div class="stat"><span class="k">${type === 'policy' ? 'Policy register' : 'Control library'}</span><span class="v">${active.length}</span><span class="d">${type === 'policy' ? 'policies in circulation' : 'operational safeguards'}</span></div>
      <div class="stat"><span class="k">${type === 'policy' ? 'Active policies' : 'Effective controls'}</span><span class="v">${tested}<small> / ${active.length}</small></span><span class="d">${type === 'policy' ? 'approved and current' : 'recorded as passing'}</span></div>
      <div class="stat"><span class="k">Needs attention</span><span class="v gov-warn">${attention.length}</span><span class="d">review required or overdue</span></div>
      <div class="stat"><span class="k">Linked ${type === 'policy' ? 'controls' : 'policies'}</span><span class="v">${totalLinked}</span><span class="d">connected across the register</span></div>
    </div>
    <div class="gov-toolbar"><div class="seg gov-segments" aria-label="${c.plural} status">${c.statuses.map(s => `<button aria-pressed="${s === filter}" class="${s === filter ? 'on' : ''}" data-a="set" data-k="${c.filter}" data-v="${s}">${s === 'all' ? 'All' : statusNames[s]} <span class="faint">${all.filter(x => (s === 'all' ? x.status !== 'RETIRED' : statusOf(x, type) === s)).length}</span></button>`).join('')}<button class="${filter === 'due' ? 'on' : ''}" aria-pressed="${filter === 'due'}" data-a="set" data-k="${c.filter}" data-v="due">Overdue</button></div>
    <div class="gov-filter-row"><div class="inwrap">${ic('search', 14)}<input id="${c.query}" class="input search-sm" data-in="${c.query}" value="${esc(u[c.query] || '')}" placeholder="Search ${c.plural.toLowerCase()}…" aria-label="Search ${c.plural.toLowerCase()}"></div><select id="${type}-category" class="input" aria-label="Category" data-in="govFilter" data-key="${type}Category"><option value="">All categories</option>${categories.map(v => `<option ${u[`${type}Category`] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>${type === 'control' ? `<select id="control-type-filter" class="input" aria-label="Control type" data-in="govFilter" data-key="controlType"><option value="">All types</option>${['MANUAL', 'AUTOMATED', 'REPORTING'].map(v => `<option value="${v}" ${u.controlType === v ? 'selected' : ''}>${v[0] + v.slice(1).toLowerCase()}</option>`).join('')}</select>` : ''}<select id="${type}-sort" class="input" aria-label="Sort records" data-in="govFilter" data-key="${type}Sort">${[
      ['due', 'Next due'],
      ['title', 'Title'],
      ['owner', 'Owner'],
    ]
      .map(([v, label]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>Sort: ${label}</option>`)
      .join('')}</select><button class="btn btn-ghost btn-sm" data-a="govClear" data-type="${type}">Reset</button></div></div>
    <div class="gov-results"><span>${filtered.length} ${filtered.length === 1 ? type : c.plural.toLowerCase()}</span><span>Sample workspace · changes saved in this browser</span></div>
    ${filtered.length ? `<div class="panel gov-table-wrap"><table class="gov-table gov-registry-table"><thead><tr><th>${type === 'policy' ? 'Policy' : 'Control'}</th><th>Status</th><th>Owner</th><th>${type === 'policy' ? 'Next review' : 'Next test'}</th><th>${type === 'policy' ? 'Controls' : 'Policy / type'}</th></tr></thead><tbody>${filtered.map(x => `<tr><td>${recordButton(type, x)}<span class="gov-row-sub">${esc(x.category)}</span></td><td data-label="Status">${governanceBadge(statusOf(x, type))}</td><td data-label="Owner"><span class="gov-owner">${esc(x.owner)}</span></td><td data-label="${type === 'policy' ? 'Next review' : 'Next test'}"><span class="${x.status !== 'RETIRED' && isOverdue(x[c.due]) ? 'gov-warn' : ''}">${dateText(x[c.due])}</span>${x.status !== 'RETIRED' && isOverdue(x[c.due]) ? '<span class="gov-row-sub gov-warn">Overdue</span>' : ''}</td><td data-label="${type === 'policy' ? 'Controls' : 'Policy / type'}">${type === 'policy' ? `<span class="pill">${allControls().filter(ctl => ctl.policyId === x.id && ctl.status !== 'RETIRED').length} linked</span><span class="gov-row-sub">Version ${esc(x.version)}</span>` : `<span class="mono">${esc(policy(x.policyId)?.code || 'No policy')}</span><span class="gov-row-sub">${esc(x.type[0] + x.type.slice(1).toLowerCase())}</span>`}</td></tr>`).join('')}</tbody></table></div>` : `<div class="panel">${empty('search', 'No matching ' + c.plural.toLowerCase(), 'Try another search or reset your filters.', `<button class="btn btn-secondary" data-a="govClear" data-type="${type}">Reset filters</button>`)}</div>`}
  </div>`;
}
function field(name, label, value = '', kind = 'text', options = []) {
  const base = `id="gov-${name}" name="${name}" data-in="govDraft" data-field="${name}" class="input" required`;
  return `<label class="gov-field" for="gov-${name}"><span>${label}</span>${kind === 'textarea' ? `<textarea ${base} rows="${name === 'content' ? 12 : 4}">${esc(value)}</textarea>` : kind === 'select' ? `<select ${base}>${options.map(([v, l]) => `<option value="${esc(v)}" ${v === value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input ${base} type="${kind}" value="${esc(value)}" ${kind === 'text' ? 'maxlength="200"' : ''}>`}</label>`;
}
function editor(type, item, mode) {
  const f = S.ui.govDraft || {},
    isPolicy = type === 'policy',
    assessment = mode === 'assess';
  return `<form data-submit="govSave" class="gov-form" data-type="${type}" data-id="${esc(item?.id || '')}" data-mode="${mode}"><h2 id="gov-d-h">${assessment ? (isPolicy ? 'Record policy review' : 'Record control test') : item ? 'Edit ' + type : 'New ' + type}</h2><p class="muted">${assessment ? 'Capture the decision, supporting reference, and next due date.' : 'Define ownership, scope, and the next review point.'}</p>${S.ui.govError ? `<div class="alert danger" role="alert" tabindex="-1">${esc(S.ui.govError)}</div>` : ''}
    ${
      assessment
        ? `<div class="gov-form-grid">${field('reviewer', 'Reviewer', f.reviewer)}${field('date', 'Assessment date', f.date, 'date')}${field(
            'outcome',
            'Outcome',
            f.outcome,
            'select',
            isPolicy
              ? [
                  ['APPROVE', 'Approve policy'],
                  ['CHANGES', 'Changes required'],
                ]
              : [
                  ['PASS', 'Pass — effective'],
                  ['FAIL', 'Fail — needs attention'],
                ],
          )}${field('nextDue', isPolicy ? 'Next review' : 'Next test', f.nextDue, 'date')}</div>${!isPolicy ? field('sample', 'Test sample / period', f.sample) : ''}${field('evidence', 'Evidence reference', f.evidence)}<p class="gov-field-hint">Reference a sample report or document ID. No files are uploaded.</p>${field('notes', 'Findings and rationale', f.notes, 'textarea')}`
        : `${field('title', 'Title', f.title)}<div class="gov-form-grid">${field('owner', 'Accountable owner', f.owner)}${field('category', 'Category', f.category)}${field(isPolicy ? 'nextReviewDue' : 'nextTestDue', isPolicy ? 'Next review' : 'Next test', f[isPolicy ? 'nextReviewDue' : 'nextTestDue'], 'date')}${
            !isPolicy
              ? field('type', 'Control type', f.type, 'select', [
                  ['MANUAL', 'Manual'],
                  ['AUTOMATED', 'Automated'],
                  ['REPORTING', 'Reporting'],
                ])
              : ''
          }</div>${
            !isPolicy
              ? field('policyId', 'Parent policy', f.policyId, 'select', [
                  ['', 'Select a policy'],
                  ...allPolicies()
                    .filter(p => p.status !== 'RETIRED' || p.id === item?.policyId)
                    .map(p => [p.id, `${p.code} · ${p.shortTitle || p.title}`]),
                ]) +
                field(
                  'frequency',
                  'Frequency',
                  f.frequency,
                  'select',
                  ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'Continuous']
                    .map(v => [v, v])
                    .concat(
                      f.frequency && !['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Semi-annual', 'Annual', 'Continuous'].includes(f.frequency)
                        ? [[f.frequency, f.frequency]]
                        : [],
                    ),
                )
              : ''
          }${field(isPolicy ? 'summary' : 'specification', isPolicy ? 'Summary' : 'Control objective', f[isPolicy ? 'summary' : 'specification'], 'textarea')}${field(isPolicy ? 'content' : 'testProcedure', isPolicy ? 'Policy requirements' : 'Test procedure', f[isPolicy ? 'content' : 'testProcedure'], 'textarea')}`
    }
    <div class="gov-form-actions"><button type="button" class="btn btn-secondary" data-a="govCancel">Cancel</button><button type="submit" class="btn btn-primary">${assessment ? 'Save ' + (isPolicy ? 'review' : 'test') : item ? 'Save changes' : 'Create ' + type}</button></div></form>`;
}
export function governanceDrawer({ type, id, mode }) {
  const item = itemFor(type, id),
    isPolicy = type === 'policy',
    cfg = config[type];
  if (!item && mode !== 'new') return '';
  const tab = S.ui.govTab || 'overview';
  const assessments = item ? (isPolicy ? item.reviews : item.tests) || [] : [];
  const linked = isPolicy ? allControls().filter(c => c.policyId === id) : [policy(item?.policyId)].filter(Boolean);
  return `<aside class="drawer gov-detail ${S.ui.drawerFull ? 'full' : ''}" role="dialog" aria-modal="${S.ui.drawerFull}" aria-labelledby="gov-d-h" tabindex="-1"><div class="drawer-h"><span class="mono faint">${ic(cfg.icon, 14)} ${esc(item?.code || 'New ' + type)}</span><span class="sp"></span><span class="pill">Demo</span><button class="ibtn hide-m" data-a="toggleDrawerFull" aria-label="Toggle full page">${ic('maximize-2', 15)}</button><button class="ibtn" data-a="closeGovDrawer" aria-label="Close">${ic('x', 16)}</button></div><div class="drawer-b" data-keep="gov-${type}-${esc(id || 'new')}-${mode || tab}">
  ${
    mode
      ? editor(type, item, mode)
      : `<div class="gov-detail-heading">${governanceBadge(statusOf(item, type))}<h2 id="gov-d-h">${esc(item.title)}</h2><p>${esc(item.category)}</p></div><div class="gov-detail-actions"><button class="btn btn-primary btn-sm" data-a="govAssess" data-type="${type}" data-id="${esc(id)}" ${item.status === 'RETIRED' ? 'disabled' : ''}>${ic(isPolicy ? 'clipboard-check' : 'play', 13)}${isPolicy ? 'Record review' : 'Record test'}</button><button class="btn btn-secondary btn-sm" data-a="govEdit" data-type="${type}" data-id="${esc(id)}" ${item.status === 'RETIRED' ? 'disabled' : ''}>${ic('pencil', 13)} Edit</button><button class="btn btn-ghost btn-sm" data-a="govArchive" data-type="${type}" data-id="${esc(id)}">${ic('archive', 13)} ${item.status === 'RETIRED' ? 'Restore' : 'Archive'}</button></div>
  <div class="seg gov-detail-tabs" aria-label="Record sections">${[
    ['overview', 'Overview'],
    ['document', isPolicy ? 'Policy content' : 'Test procedure'],
    ['assessments', isPolicy ? 'Reviews' : 'Test history'],
    ['history', 'Activity'],
  ]
    .map(
      ([v, label]) =>
        `<button class="${v === tab ? 'on' : ''}" aria-pressed="${v === tab}" data-a="set" data-k="govTab" data-v="${v}">${label}${v === 'assessments' ? ` (${assessments.length})` : ''}</button>`,
    )
    .join('')}</div>
  ${
    tab === 'overview'
      ? `<p class="gov-description">${esc(item.summary || item.specification)}</p><dl class="kv gov-properties"><dt>Accountable owner</dt><dd>${esc(item.owner)}</dd><dt>${isPolicy ? 'Version' : 'Frequency'}</dt><dd>${esc(isPolicy ? 'v' + item.version : item.frequency)}</dd><dt>${isPolicy ? 'Next review' : 'Next test'}</dt><dd class="${isOverdue(item[cfg.due]) ? 'gov-warn' : ''}">${dateText(item[cfg.due])}${isOverdue(item[cfg.due]) && item.status !== 'RETIRED' ? ' · Overdue' : ''}</dd><dt>${isPolicy ? 'Last reviewed' : 'Last test'}</dt><dd>${isPolicy ? (item.lastReviewDate ? dateText(item.lastReviewDate) : 'Not reviewed') : assessments[0] ? `${dateText(assessments[0].date)} · ${assessments[0].outcome === 'PASS' ? 'Pass' : 'Fail'}` : 'Not tested'}</dd></dl>
  ${['NEEDS_REVIEW', 'DEFICIENT'].includes(statusOf(item, type)) ? `<div class="gov-attention">${ic('alert-circle', 16)}<div><strong>${isPolicy ? 'Review required' : 'Follow-up required'}</strong><p>${esc(!isPolicy && assessments[0]?.outcome === 'FAIL' ? assessments[0].notes : 'Check the current requirements, document your assessment, and record the outcome.')}</p></div></div>` : ''}
  <section class="gov-section"><h3>${isPolicy ? 'Linked controls' : 'Parent policy'} <span class="faint">${linked.length}</span></h3>${linked.length ? linked.map(x => `<div class="gov-linked">${recordButton(isPolicy ? 'control' : 'policy', x)}${governanceBadge(statusOf(x, isPolicy ? 'control' : 'policy'))}</div>`).join('') : '<p class="muted">No controls linked yet.</p>'}${isPolicy && item.status !== 'RETIRED' ? `<button class="btn btn-ghost btn-sm" data-a="govNew" data-type="control" data-policy="${esc(id)}">${ic('plus', 13)} Add control</button>` : ''}</section>
  <section class="gov-section"><h3>Regulatory references</h3><p class="muted">Illustrative mappings in this sample workspace.</p>${
    (item.statuteSections || [])
      .map(sec => {
        const reg = regulationOfSection(sec);
        return reg
          ? `<button class="pillbtn" data-a="go" data-r="regulations" data-id="${esc(reg.id)}" data-sec="${esc(sec)}">${ic('external-link', 12)} ${formatSecBadge(sec)}</button>`
          : '';
      })
      .join('') || '<p class="faint">No regulatory references linked.</p>'
  }</section>`
      : tab === 'document'
        ? `<section class="gov-section"><h3>${isPolicy ? 'Policy requirements' : 'Test procedure'}</h3><div class="gov-document">${esc(isPolicy ? item.content : item.testProcedure)}</div></section>`
        : tab === 'assessments'
          ? `${assessments.length ? assessments.map(a => `<article class="gov-assessment"><div class="row"><strong>${isPolicy ? (a.outcome === 'APPROVE' ? 'Approved' : 'Changes required') : a.outcome === 'PASS' ? 'Passed' : 'Failed'}</strong><span class="sp"></span><time>${dateText(a.date)}</time></div><p class="muted">${esc(a.reviewer)}${a.version ? ` · Version ${esc(a.version)}` : ''}</p>${a.sample ? `<p><strong>Sample:</strong> ${esc(a.sample)}</p>` : ''}<p class="gov-description">${esc(a.notes)}</p><div class="gov-evidence">${ic('paperclip', 13)}<span>${esc(a.evidence)}</span></div>${a.snapshot ? `<details class="gov-snapshot"><summary>${isPolicy ? 'Reviewed policy content' : 'Tested procedure'}</summary><div class="gov-document">${esc(a.snapshot)}</div></details>` : ''}</article>`).join('') : empty('clipboard', 'No ' + (isPolicy ? 'reviews' : 'tests') + ' recorded', 'Record an assessment to capture findings and supporting evidence.')}`
          : `<ol class="gov-history">${(item.history || []).map(h => `<li><span class="gov-history-dot"></span><strong>${esc(h.text)}</strong><p>${esc(h.actor)} · ${dateText(h.date)}</p></li>`).join('')}</ol>`
  }
  `
  }</div></aside>`;
}
export function assessmentDefaults(type, item) {
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + (type === 'policy' ? 12 : 3));
  return {
    reviewer: item.owner || 'Assurance Team',
    date: today(),
    nextDue: next.toISOString().slice(0, 10),
    outcome: type === 'policy' ? 'APPROVE' : 'PASS',
    notes: '',
    evidence: '',
    sample: '',
  };
}
