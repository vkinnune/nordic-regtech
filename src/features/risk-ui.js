import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { S, allRisks, allControls, allPolicies, risk, policy, riskControls, isControlImpacted, regulationOfSection } from '../core/store.js';
import { empty, formatSecBadge } from '../ui/helpers.js';
import { isOverdue, today } from './governance-model.js';
import {
  riskStates,
  riskScore,
  riskBand,
  likelihoodLabels,
  impactLabels,
  treatmentLabels,
  riskNeedsReview,
  controlAssurance,
  filteredRisks,
} from './risk-model.js';
const date = value =>
  value
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : 'Not scheduled';
const scoreOf = r => riskScore(r.residualLikelihood, r.residualImpact);
const rating = score =>
  `<span class="risk-rating risk-${riskBand(score).toLowerCase()}"><span class="gov-status-dot"></span>${riskBand(score)}${score == null ? '' : ` <span class="mono">${score}/25</span>`}</span>`;
const stateBadge = r =>
  `<span class="gov-badge gov-status-${r.status === 'ACCEPTED' ? 'ok' : r.status === 'MITIGATING' ? 'alert' : 'draft'}">${esc(riskStates[r.status] || r.status)}</span>`;
const link = (type, x) =>
  `<button class="gov-record-link" data-a="openGovDrawer" data-type="${type}" data-id="${esc(x.id)}"><span class="mono faint">${esc(x.code)}</span><strong>${esc(x.title)}</strong></button>`;
const scorePair = r =>
  `<div class="risk-score-pair"><div><span>Inherent risk</span>${rating(riskScore(r.inherentLikelihood, r.inherentImpact))}<small>Before safeguards · ${r.inherentLikelihood} × ${r.inherentImpact}</small></div><div><span>Residual risk</span>${rating(scoreOf(r))}<small>${scoreOf(r) == null ? 'Record an assessment' : `Last assessed · ${r.residualLikelihood} × ${r.residualImpact}`}</small></div></div>`;
function matrix(risks, cell) {
  return `<section class="panel risk-matrix-panel"><div><h2>Residual risk matrix</h2><p>Likelihood × impact · select a cell to filter the register.</p><div class="risk-matrix-layout"><span class="risk-axis-y">Likelihood</span><div class="risk-matrix-grid">${[
    5, 4, 3, 2, 1,
  ]
    .map(
      l =>
        `<span class="risk-axis-number">${l}</span>${[1, 2, 3, 4, 5]
          .map(i => {
            const count = risks.filter(r => r.residualLikelihood === l && r.residualImpact === i).length;
            return `<button class="risk-matrix-cell risk-${riskBand(l * i).toLowerCase()} ${cell === `${l}-${i}` ? 'selected' : ''}" data-a="riskMatrixCell" data-cell="${l}-${i}" aria-pressed="${cell === `${l}-${i}`}" aria-label="Likelihood ${l}, impact ${i}: ${count} ${count === 1 ? 'risk' : 'risks'}">${count || '<span aria-hidden="true">·</span>'}</button>`;
          })
          .join('')}`,
    )
    .join(
      '',
    )}<span></span>${[1, 2, 3, 4, 5].map(i => `<span class="risk-axis-number">${i}</span>`).join('')}</div></div><div class="risk-axis-x">Impact</div></div><div class="risk-method"><h3>How to read the scores</h3><p>Inherent risk is the exposure before safeguards. Residual risk is an assessor’s recorded judgment after considering controls.</p><div class="risk-legend">${[
    [4, 'Low · 1–4'],
    [9, 'Moderate · 5–11'],
    [16, 'High · 12–19'],
    [25, 'Critical · 20–25'],
  ]
    .map(([s, l]) => `<span class="risk-rating risk-${riskBand(s).toLowerCase()}">${l}</span>`)
    .join(
      '',
    )}</div><p>${risks.filter(r => scoreOf(r) == null).length} not assessed. Control results never automatically lower the score.</p>${cell ? `<button class="btn btn-secondary btn-sm" data-a="riskMatrixCell" data-cell="">Clear cell selection</button>` : ''}</div></section>`;
}
export function riskRegistry() {
  const u = S.ui,
    all = allRisks(),
    active = all.filter(r => r.status !== 'RETIRED'),
    status = u.rskFilter || 'all';
  const filters = { q: u.rskQ, status, category: u.riskCategory, band: u.riskBand, sort: u.riskSort, cell: u.riskCell };
  const filtered = filteredRisks(all, filters),
    matrixRisks = filteredRisks(all, { ...filters, cell: '' });
  const openActions = active.flatMap(r => r.actions || []).filter(a => a.status !== 'DONE');
  const filtersList = [
    ['all', 'All', active.length],
    ['review', 'Needs review', active.filter(r => riskNeedsReview(r)).length],
    ['MITIGATING', 'In treatment', active.filter(r => r.status === 'MITIGATING').length],
    ['MONITORING', 'Monitoring', active.filter(r => r.status === 'MONITORING').length],
    ['ACCEPTED', 'Accepted', active.filter(r => r.status === 'ACCEPTED').length],
    ['RETIRED', 'Archived', all.filter(r => r.status === 'RETIRED').length],
  ];
  return `<div class="page wide governance-page risk-page"><div class="ph"><div><div class="gov-eyebrow">Governance <span class="pill">Demo data</span></div><h1>Risks</h1><p>Understand exposure, assign treatment, and keep decisions under review.</p></div><div class="acts"><button class="btn btn-primary" data-a="riskNew">${ic('plus', 14)} New risk</button></div></div>
  <div class="stats gov-stats"><div class="stat"><span class="k">Risk register</span><span class="v">${active.length}</span><span class="d">active risk scenarios</span></div><div class="stat"><span class="k">High or critical</span><span class="v gov-warn">${active.filter(r => scoreOf(r) >= 12).length}</span><span class="d">based on residual assessments</span></div><div class="stat"><span class="k">Needs review</span><span class="v">${active.filter(r => riskNeedsReview(r)).length}</span><span class="d">unassessed, overdue, or expired</span></div><div class="stat"><span class="k">Open actions</span><span class="v">${openActions.length}</span><span class="d">${openActions.filter(a => isOverdue(a.due)).length} past their target date</span></div></div>
  <div class="gov-toolbar"><div class="risk-toolbar-top"><div class="seg gov-segments" aria-label="Risk status">${filtersList.map(([v, label, n]) => `<button data-a="riskFilter" data-value="${v}" class="${status === v ? 'on' : ''}" aria-pressed="${status === v}">${label} <span class="faint">${n}</span></button>`).join('')}</div><button class="btn btn-secondary btn-sm" data-a="riskToggleMatrix" aria-expanded="${Boolean(u.riskMatrix)}">${ic('grid-2x2', 13)} Risk matrix</button></div><div class="gov-filter-row"><div class="inwrap">${ic('search', 14)}<input id="rsk-q" class="input search-sm" data-in="riskSearch" value="${esc(u.rskQ || '')}" aria-label="Search risks" placeholder="Search risks, owners, or scenarios…"></div><select class="input" id="risk-filter-category" data-in="riskFilter" data-key="riskCategory" aria-label="Risk category"><option value="">All categories</option>${[
    ...new Set(all.map(r => r.category)),
  ]
    .sort()
    .map(v => `<option ${u.riskCategory === v ? 'selected' : ''}>${esc(v)}</option>`)
    .join(
      '',
    )}</select><select class="input" id="risk-band" data-in="riskFilter" data-key="riskBand" aria-label="Risk rating"><option value="">All ratings</option>${['Critical', 'High', 'Moderate', 'Low', 'Unassessed'].map(v => `<option ${u.riskBand === v ? 'selected' : ''}>${v}</option>`).join('')}</select><select class="input" id="risk-sort" data-in="riskFilter" data-key="riskSort" aria-label="Sort risks">${[
    ['score', 'Highest exposure'],
    ['due', 'Next review'],
    ['title', 'Title'],
  ]
    .map(([v, l]) => `<option value="${v}" ${(u.riskSort || 'score') === v ? 'selected' : ''}>${l}</option>`)
    .join('')}</select><button class="btn btn-ghost btn-sm" data-a="riskClear">Reset</button></div></div>
  ${u.riskMatrix ? matrix(matrixRisks, u.riskCell) : ''}
  <div class="gov-results"><span>${filtered.length} ${filtered.length === 1 ? 'risk' : 'risks'}${u.riskCell ? ' · matrix cell selected' : ''}</span><span>Sample workspace · changes saved in this browser</span></div>
  ${
    filtered.length
      ? `<div class="panel gov-table-wrap"><table class="gov-table gov-registry-table risk-table"><thead><tr><th>Risk scenario</th><th>Residual rating</th><th>Owner</th><th>Next review</th><th>Control health</th></tr></thead><tbody>${filtered
          .map(r => {
            const controls = riskControls(r),
              current = controls.filter(c => controlAssurance(c, undefined, isControlImpacted(c)) === 'Current').length;
            return `<tr><td>${link('risk', r)}<span class="gov-row-sub">${esc(r.category)}</span><div class="risk-row-state">${stateBadge(r)}</div></td><td data-label="Residual rating">${rating(scoreOf(r))}<span class="gov-row-sub">Inherent ${riskScore(r.inherentLikelihood, r.inherentImpact)}/25</span></td><td data-label="Owner"><span class="gov-owner">${esc(r.owner)}</span></td><td data-label="Next review"><span class="${riskNeedsReview(r) ? 'gov-warn' : ''}">${date(r.nextReviewDue)}</span>${riskNeedsReview(r) ? `<span class="gov-row-sub gov-warn">${r.status === 'OPEN' ? 'Assessment needed' : r.status === 'ACCEPTED' && r.acceptedUntil <= today() ? 'Acceptance expired' : 'Overdue'}</span>` : ''}</td><td data-label="Control health"><span class="${controls.length && current < controls.length ? 'gov-warn' : ''}">${controls.length ? `${current} / ${controls.length} current` : 'No controls'}</span><span class="gov-row-sub">${(r.actions || []).filter(a => a.status !== 'DONE').length} open actions</span></td></tr>`;
          })
          .join('')}</tbody></table></div>`
      : `<div class="panel">${empty('search', 'No matching risks', 'Try another search or reset the selected filters.', `<button class="btn btn-secondary" data-a="riskClear">Reset filters</button>`)}</div>`
  }</div>`;
}
function field(name, label, value = '', kind = 'text', options = [], required = true) {
  const base = `id="risk-${name}" name="${name}" data-in="riskDraft" data-field="${name}" class="input" ${required ? 'required' : ''}`;
  return `<label class="gov-field" for="risk-${name}"><span>${label}</span>${kind === 'textarea' ? `<textarea ${base} rows="4">${esc(value)}</textarea>` : kind === 'select' ? `<select ${base}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input ${base} type="${kind}" value="${esc(value)}" ${kind === 'text' ? 'maxlength="200"' : ''}>`}</label>`;
}
const likelihoodOptions = likelihoodLabels.map((label, i) => [i + 1, `${i + 1} · ${label}`]);
const impactOptions = impactLabels.map((label, i) => [i + 1, `${i + 1} · ${label}`]);
function choices(name, label, items, selected = []) {
  return `<fieldset class="risk-links-picker"><legend>${label}</legend>${items.map(x => `<label><input type="checkbox" name="${name}" value="${esc(x.id)}" data-in="riskLinkDraft" ${selected.includes(x.id) ? 'checked' : ''}><span><span class="mono faint">${esc(x.code)}</span> ${esc(x.shortTitle || x.title)}${x.status === 'RETIRED' ? ' · Archived' : ''}</span></label>`).join('') || '<p class="muted">No records available.</p>'}</fieldset>`;
}
function riskEditor(r, mode) {
  const f = S.ui.riskDraft || {},
    assess = mode === 'assess',
    action = mode === 'action',
    complete = mode === 'complete';
  return `<form class="gov-form" data-submit="riskSave" data-id="${esc(r?.id || '')}" data-mode="${mode}"><h2 id="gov-d-h">${assess ? 'Record risk assessment' : action ? 'Add treatment action' : complete ? 'Complete treatment action' : r ? 'Edit risk' : 'New risk'}</h2><p class="muted">${assess ? 'Document your judgment and treatment decision. Scores do not change automatically when controls change.' : action ? 'Assign a concrete next step and target date.' : complete ? 'Capture the outcome before marking this action complete.' : 'Describe the scenario, ownership, and exposure before safeguards.'}</p>${S.ui.riskError ? `<div class="alert danger" role="alert" tabindex="-1">${esc(S.ui.riskError)}</div>` : ''}
  ${
    complete
      ? `<p class="gov-description">${esc(r.actions.find(a => a.id === S.ui.riskActionId)?.title)}</p>${field('completionNotes', 'Completion findings / evidence', f.completionNotes, 'textarea')}`
      : action
        ? `${field('title', 'Action', f.title)}<div class="gov-form-grid">${field('owner', 'Action owner', f.owner)}${field('due', 'Target date', f.due, 'date')}</div>${field('notes', 'Action details (optional)', f.notes, 'textarea', [], false)}`
        : assess
          ? `<div class="gov-form-grid">${field('reviewer', 'Reviewer', f.reviewer)}${field('date', 'Assessment date', f.date, 'date')}${field('residualLikelihood', 'Residual likelihood', f.residualLikelihood, 'select', likelihoodOptions)}${field('residualImpact', 'Residual impact', f.residualImpact, 'select', impactOptions)}</div><div class="risk-score-preview" aria-live="polite">Residual rating ${rating(riskScore(f.residualLikelihood, f.residualImpact))}</div>${field('rationale', 'Assessment rationale', f.rationale, 'textarea')}${field('evidence', 'Evidence reference', f.evidence)}<div class="gov-form-grid">${field('treatment', 'Treatment decision', f.treatment, 'select', Object.entries(treatmentLabels))}${field('nextReviewDue', 'Next review', f.nextReviewDue, 'date')}</div>${field('treatmentPlan', 'Treatment / monitoring plan', f.treatmentPlan, 'textarea')}${f.treatment === 'ACCEPT' ? `<div class="risk-acceptance"><h3>Time-limited acceptance</h3>${field('acceptedBy', 'Accountable approver', f.acceptedBy)}${field('acceptedUntil', 'Acceptance expires', f.acceptedUntil, 'date')}${field('acceptanceReason', 'Acceptance reason', f.acceptanceReason, 'textarea')}</div>` : ''}`
          : `${field('title', 'Title', f.title)}<div class="gov-form-grid">${field('owner', 'Risk owner', f.owner)}${field('category', 'Category', f.category)}${field('inherentLikelihood', 'Inherent likelihood', f.inherentLikelihood, 'select', likelihoodOptions)}${field('inherentImpact', 'Inherent impact', f.inherentImpact, 'select', impactOptions)}</div><div class="risk-score-preview" aria-live="polite">Inherent rating ${rating(riskScore(f.inherentLikelihood, f.inherentImpact))}</div>${field('consequence', 'Risk scenario and consequence', f.consequence, 'textarea')}${field('nextReviewDue', 'Next review', f.nextReviewDue, 'date')}${choices(
              'controlIds',
              'Linked controls',
              allControls().filter(c => c.status !== 'RETIRED' || f.controlIds?.includes(c.id)),
              f.controlIds,
            )}${choices(
              'policyIds',
              'Linked policies',
              allPolicies().filter(p => p.status !== 'RETIRED' || f.policyIds?.includes(p.id)),
              f.policyIds,
            )}`
  }
  <div class="gov-form-actions"><button type="button" class="btn btn-secondary" data-a="riskCancel">Cancel</button><button type="submit" class="btn btn-primary">${assess ? 'Save assessment' : action ? 'Add action' : complete ? 'Complete action' : r ? 'Save changes' : 'Create risk'}</button></div></form>`;
}
function overview(r) {
  const controls = riskControls(r);
  return `${scorePair(r)}<p class="gov-description">${esc(r.consequence)}</p><dl class="kv gov-properties"><dt>Risk owner</dt><dd>${esc(r.owner)}</dd><dt>Next review</dt><dd>${date(r.nextReviewDue)}</dd><dt>Last assessed</dt><dd>${r.lastAssessed ? date(r.lastAssessed) : 'Not assessed'}</dd><dt>Treatment</dt><dd>${esc(treatmentLabels[r.treatment] || 'Not decided')}</dd></dl>${riskNeedsReview(r) ? `<div class="gov-attention">${ic('alert-circle', 16)}<div><strong>${r.status === 'OPEN' ? 'Assessment needed' : r.status === 'ACCEPTED' && r.acceptedUntil <= today() ? 'Acceptance expired' : 'Review overdue'}</strong><p>Review the scenario, supporting evidence, and treatment decision.</p></div></div>` : ''}${r.status === 'ACCEPTED' ? `<div class="risk-acceptance"><strong>Accepted until ${date(r.acceptedUntil)}</strong><p>${esc(r.assessments[0]?.acceptedBy || '')} · ${esc(r.assessments[0]?.acceptanceReason || '')}</p></div>` : ''}
  <section class="gov-section"><h3>Linked controls <span class="faint">${controls.length}</span></h3><p class="muted">Current means a passing test with no outstanding impact or overdue test. It does not imply the risk is eliminated.</p>${controls.map(c => `<div class="gov-linked">${link('control', c)}<span class="gov-badge ${controlAssurance(c, undefined, isControlImpacted(c)) === 'Current' ? 'gov-status-ok' : 'gov-status-alert'}">${controlAssurance(c, undefined, isControlImpacted(c))}</span></div>`).join('') || '<p class="muted">No controls linked. Edit this risk to connect safeguards.</p>'}</section><section class="gov-section"><h3>Governing policies</h3>${
    (r.policyIds || [])
      .map(policy)
      .filter(Boolean)
      .map(p => `<div class="gov-linked">${link('policy', p)}</div>`)
      .join('') || '<p class="muted">No policies linked.</p>'
  }</section>${
    r.statuteSections?.length
      ? `<section class="gov-section"><h3>Regulatory references</h3><p class="muted">Illustrative mappings in this sample workspace.</p>${r.statuteSections
          .map(sec => {
            const reg = regulationOfSection(sec);
            return reg
              ? `<button class="pillbtn" data-a="go" data-r="regulations" data-id="${esc(reg.id)}" data-sec="${esc(sec)}">${ic('external-link', 12)} ${formatSecBadge(sec)}</button>`
              : '';
          })
          .join('')}</section>`
      : ''
  }`;
}
function treatment(r) {
  return `<section class="gov-section"><h3>Treatment plan</h3><p class="gov-description">${esc(r.treatmentPlan || 'Record an assessment to define the treatment decision and plan.')}</p><div class="risk-action-heading"><h3>Actions <span class="faint">${(r.actions || []).filter(a => a.status !== 'DONE').length} open</span></h3>${r.status !== 'RETIRED' ? `<button class="btn btn-secondary btn-sm" data-a="riskAddAction" data-id="${esc(r.id)}">${ic('plus', 13)} Add action</button>` : ''}</div>${(r.actions || []).map(a => `<article class="gov-assessment risk-action"><div class="row"><strong>${esc(a.title)}</strong><span class="sp"></span><span class="gov-badge gov-status-${a.status === 'DONE' ? 'ok' : 'draft'}">${a.status === 'DONE' ? 'Complete' : 'Open'}</span></div><p class="muted">${esc(a.owner)} · <span class="${a.status !== 'DONE' && isOverdue(a.due) ? 'gov-warn' : ''}">Due ${date(a.due)}${a.status !== 'DONE' && isOverdue(a.due) ? ' · Overdue' : ''}</span></p><p class="gov-description">${esc(a.notes || '')}</p>${a.status === 'DONE' ? `<div class="gov-evidence"><span>Completed ${date(a.completed)} by ${esc(a.completedBy)}<br>${esc(a.completionNotes)}</span></div>` : r.status !== 'RETIRED' ? `<button class="btn btn-secondary btn-sm" data-a="riskCompleteAction" data-id="${esc(r.id)}" data-action="${esc(a.id)}">${ic('check', 13)} Mark complete</button>` : ''}</article>`).join('') || empty('list-checks', 'No treatment actions', 'Add a specific next step with an owner and target date.')}</section>`;
}
function assessments(r) {
  return (
    (r.assessments || [])
      .map(
        a =>
          `<article class="gov-assessment"><div class="row">${rating(riskScore(a.residualLikelihood, a.residualImpact))}<span class="sp"></span><time>${date(a.date)}</time></div><p class="muted">${esc(a.reviewer)} · ${esc(treatmentLabels[a.treatment])}</p><p class="gov-description">${esc(a.rationale)}</p><div class="gov-evidence">${ic('paperclip', 13)}<span>${esc(a.evidence)}</span></div><details class="gov-snapshot"><summary>Assessment snapshot</summary><dl class="kv"><dt>Inherent rating</dt><dd>${a.inherentLikelihood} × ${a.inherentImpact} = ${riskScore(a.inherentLikelihood, a.inherentImpact)}/25</dd><dt>Residual rating</dt><dd>${a.residualLikelihood} × ${a.residualImpact} = ${riskScore(a.residualLikelihood, a.residualImpact)}/25</dd><dt>Next review</dt><dd>${date(a.nextReviewDue)}</dd></dl><p class="gov-description">${esc(a.scenario)}</p><h4>Plan</h4><p class="gov-description">${esc(a.treatmentPlan)}</p>${a.acceptedBy ? `<p>Accepted by ${esc(a.acceptedBy)} until ${date(a.acceptedUntil)}</p><p>${esc(a.acceptanceReason)}</p>` : ''}<h4>Control health at assessment</h4>${(a.controls || []).map(c => `<p>${esc(c.code)} · ${esc(c.assurance)}</p>`).join('') || '<p>No linked controls at assessment.</p>'}</details></article>`,
      )
      .join('') || empty('clipboard', 'No assessments yet', 'Record likelihood, impact, and the supporting rationale.')
  );
}
export function riskDrawer({ id, mode }) {
  const r = risk(id),
    tab = S.ui.riskTab || 'overview';
  if (!r && mode !== 'new') return '';
  return `<aside class="drawer gov-detail risk-detail ${S.ui.drawerFull ? 'full' : ''}" role="dialog" aria-modal="${S.ui.drawerFull}" aria-labelledby="gov-d-h" tabindex="-1"><div class="drawer-h"><span class="mono faint">${ic('triangle-alert', 14)} ${esc(r?.code || 'New risk')}</span><span class="sp"></span><span class="pill">Demo</span><button class="ibtn hide-m" data-a="toggleDrawerFull" aria-label="Toggle full page">${ic('maximize-2', 15)}</button><button class="ibtn" data-a="closeGovDrawer" aria-label="Close">${ic('x', 16)}</button></div><div class="drawer-b" data-keep="risk-${esc(id || 'new')}-${mode || tab}">${
    mode
      ? riskEditor(r, mode)
      : `<div class="gov-detail-heading">${stateBadge(r)}<h2 id="gov-d-h">${esc(r.title)}</h2><p>${esc(r.category)}</p></div><div class="gov-detail-actions"><button class="btn btn-primary btn-sm" data-a="riskAssess" data-id="${esc(id)}" ${r.status === 'RETIRED' ? 'disabled' : ''}>${ic('clipboard-check', 13)} Record assessment</button><button class="btn btn-secondary btn-sm" data-a="riskEdit" data-id="${esc(id)}" ${r.status === 'RETIRED' ? 'disabled' : ''}>${ic('pencil', 13)} Edit</button><button class="btn btn-ghost btn-sm" data-a="riskArchive" data-id="${esc(id)}">${ic('archive', 13)} ${r.status === 'RETIRED' ? 'Restore' : 'Archive'}</button></div><div class="seg gov-detail-tabs" aria-label="Risk sections">${[
          ['overview', 'Overview'],
          ['treatment', 'Treatment'],
          ['assessments', `Assessments (${r.assessments?.length || 0})`],
          ['history', 'Activity'],
        ]
          .map(([v, l]) => `<button class="${tab === v ? 'on' : ''}" aria-pressed="${tab === v}" data-a="set" data-k="riskTab" data-v="${v}">${l}</button>`)
          .join(
            '',
          )}</div>${tab === 'overview' ? overview(r) : tab === 'treatment' ? treatment(r) : tab === 'assessments' ? assessments(r) : `<ol class="gov-history">${(r.history || []).map(h => `<li><span class="gov-history-dot"></span><strong>${esc(h.text)}</strong><p>${esc(h.actor)} · ${date(h.date)}</p></li>`).join('')}</ol>`}`
  }</div></aside>`;
}
