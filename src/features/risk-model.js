import { addHistory, isOverdue, today } from './governance-model.js';

export const riskStates = { OPEN: 'Not assessed', MONITORING: 'Monitoring', MITIGATING: 'In treatment', ACCEPTED: 'Accepted', RETIRED: 'Archived' };
export const likelihoodLabels = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost certain'];
export const impactLabels = ['Minor', 'Limited', 'Moderate', 'Major', 'Severe'];
export const treatmentLabels = { MITIGATE: 'Mitigate', MONITOR: 'Monitor', ACCEPT: 'Accept', TRANSFER: 'Transfer', AVOID: 'Avoid' };
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const level = value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 5;
export function riskScore(likelihood, impact) {
  return level(likelihood) && level(impact) ? Number(likelihood) * Number(impact) : null;
}
export function riskBand(score) {
  return score == null ? 'Unassessed' : score >= 20 ? 'Critical' : score >= 12 ? 'High' : score >= 5 ? 'Moderate' : 'Low';
}
export function linkedRiskControls(risk, controls) {
  return controls.filter(c => (risk.controlIds || []).includes(c.id) || c.riskId === risk.id || (c.riskIds || []).includes(risk.id));
}
export function controlAssurance(control, now = today(), impacted = false) {
  if (control.status === 'RETIRED') return 'Archived';
  if (control.status === 'DEFICIENT' || impacted) return 'Needs attention';
  if (control.status !== 'EFFECTIVE' || control.tests?.[0]?.outcome !== 'PASS') return 'Not tested';
  if (!control.nextTestDue || isOverdue(control.nextTestDue, now)) return 'Test overdue';
  return 'Current';
}
export function riskNeedsReview(risk, now = today()) {
  return (
    risk.status !== 'RETIRED' &&
    (risk.status === 'OPEN' || isOverdue(risk.nextReviewDue, now) || (risk.status === 'ACCEPTED' && (!risk.acceptedUntil || risk.acceptedUntil <= now)))
  );
}
export function filteredRisks(risks, filters = {}, now = today()) {
  const q = (filters.q || '').toLowerCase().trim();
  return risks
    .filter(r => {
      if (filters.status === 'RETIRED' ? r.status !== 'RETIRED' : r.status === 'RETIRED') return false;
      if (filters.status === 'review' && !riskNeedsReview(r, now)) return false;
      if (filters.status && !['all', 'review', 'RETIRED'].includes(filters.status) && r.status !== filters.status) return false;
      if (filters.category && r.category !== filters.category) return false;
      const score = riskScore(r.residualLikelihood, r.residualImpact);
      if (filters.band && riskBand(score) !== filters.band) return false;
      if (filters.cell && `${r.residualLikelihood}-${r.residualImpact}` !== filters.cell) return false;
      return !q || [r.code, r.title, r.category, r.owner, r.consequence, r.treatmentPlan].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) =>
      filters.sort === 'title'
        ? a.title.localeCompare(b.title)
        : filters.sort === 'due'
          ? (a.nextReviewDue || '9999').localeCompare(b.nextReviewDue || '9999')
          : (riskScore(b.residualLikelihood, b.residualImpact) ?? -1) - (riskScore(a.residualLikelihood, a.residualImpact) ?? -1) ||
            a.title.localeCompare(b.title),
    );
}
export function saveRisk(data, fields, id, actor) {
  const old = id ? data.risks.find(r => r.id === id) : null;
  if (id && !old) throw new Error('Risk not found.');
  if (old?.status === 'RETIRED') throw new Error('Restore this risk before editing.');
  const f = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  for (const key of ['title', 'category', 'owner', 'consequence']) if (!f[key]) throw new Error('Add a title, category, owner, and risk scenario.');
  if (!level(f.inherentLikelihood) || !level(f.inherentImpact)) throw new Error('Choose likelihood and impact from 1 to 5.');
  if (!validDate(f.nextReviewDue)) throw new Error('Choose a valid review date.');
  const controlIds = [...new Set(f.controlIds || [])],
    policyIds = [...new Set(f.policyIds || [])];
  for (const [ids, list, previous] of [
    [controlIds, data.controls, old?.controlIds],
    [policyIds, data.policies, old?.policyIds],
  ]) {
    if (ids.some(id => !list.some(x => x.id === id && (x.status !== 'RETIRED' || previous?.includes(id)))))
      throw new Error('A linked record is unavailable. Choose an existing policy or control.');
  }
  const item = old || {
    id: `risk-${crypto.randomUUID()}`,
    code: `RSK-${Math.max(100, ...data.risks.map(r => Number(r.code.split('-').at(-1)) || 0)) + 1}`,
    status: 'OPEN',
    residualLikelihood: null,
    residualImpact: null,
    assessments: [],
    actions: [],
    history: [],
    statuteSections: [],
    demo: true,
  };
  const changed =
    old &&
    (['title', 'consequence', 'inherentLikelihood', 'inherentImpact'].some(k => String(old[k]) !== String(f[k])) ||
      JSON.stringify([...(old.controlIds || [])].sort()) !== JSON.stringify([...controlIds].sort()));
  for (const k of ['title', 'category', 'owner', 'consequence', 'nextReviewDue']) item[k] = f[k];
  item.inherentLikelihood = Number(f.inherentLikelihood);
  item.inherentImpact = Number(f.inherentImpact);
  item.controlIds = controlIds;
  item.policyIds = policyIds;
  if (changed) {
    item.status = 'OPEN';
    item.residualLikelihood = null;
    item.residualImpact = null;
    item.acceptedUntil = null;
  }
  if (!old) data.risks.push(item);
  for (const c of data.controls) {
    if (c.riskId === item.id) delete c.riskId;
    c.riskIds = [...new Set([...(c.riskIds || []).filter(r => r !== item.id), ...(controlIds.includes(c.id) ? [item.id] : [])])];
  }
  for (const p of data.policies) p.riskIds = [...new Set([...(p.riskIds || []).filter(r => r !== item.id), ...(policyIds.includes(p.id) ? [item.id] : [])])];
  addHistory(item, old ? `Risk updated.${changed ? ' Reassessment required.' : ''}` : 'Risk created.', actor);
  return item;
}
export function assessRisk(risk, fields, controls, actor, now = today(), impacted = () => false) {
  if (risk.status === 'RETIRED') throw new Error('Restore this risk before assessing.');
  const f = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v).trim()]));
  if (!f.reviewer || !f.rationale || !f.evidence) throw new Error('Add a reviewer, assessment rationale, and evidence reference.');
  if (!level(f.residualLikelihood) || !level(f.residualImpact)) throw new Error('Choose residual likelihood and impact from 1 to 5.');
  if (!validDate(f.date) || f.date > now) throw new Error('Assessment date must be today or earlier.');
  if (risk.assessments?.[0] && f.date < risk.assessments[0].date) throw new Error('Use a date on or after the latest assessment.');
  if (!validDate(f.nextReviewDue) || f.nextReviewDue <= now) throw new Error('The next review must be in the future.');
  if (!Object.hasOwn(treatmentLabels, f.treatment)) throw new Error('Choose a treatment decision.');
  if (!f.treatmentPlan) throw new Error('Describe the treatment or monitoring plan.');
  if (
    f.treatment === 'ACCEPT' &&
    (!f.acceptedBy || !f.acceptanceReason || !validDate(f.acceptedUntil) || f.acceptedUntil <= now || f.nextReviewDue > f.acceptedUntil)
  )
    throw new Error('Acceptance needs an accountable approver, a reason, and a future expiry on or after the next review.');
  const entry = {
    ...f,
    id: crypto.randomUUID(),
    inherentLikelihood: risk.inherentLikelihood,
    inherentImpact: risk.inherentImpact,
    residualLikelihood: Number(f.residualLikelihood),
    residualImpact: Number(f.residualImpact),
    scenario: risk.consequence,
    controls: linkedRiskControls(risk, controls).map(c => ({ id: c.id, code: c.code, title: c.title, assurance: controlAssurance(c, now, impacted(c)) })),
    demo: true,
  };
  if (f.treatment !== 'ACCEPT') {
    delete entry.acceptedBy;
    delete entry.acceptanceReason;
    delete entry.acceptedUntil;
  }
  risk.assessments ||= [];
  risk.assessments.unshift(entry);
  Object.assign(risk, {
    residualLikelihood: entry.residualLikelihood,
    residualImpact: entry.residualImpact,
    treatment: f.treatment,
    treatmentPlan: f.treatmentPlan,
    nextReviewDue: f.nextReviewDue,
    lastAssessed: f.date,
    status: f.treatment === 'ACCEPT' ? 'ACCEPTED' : f.treatment === 'MONITOR' ? 'MONITORING' : 'MITIGATING',
    acceptedUntil: entry.acceptedUntil || null,
  });
  // Legacy consumers use a 0–100 scale; the register shows the explicit 1–25 assessment.
  risk.exposureScore = riskScore(entry.residualLikelihood, entry.residualImpact) * 4;
  risk.severity = riskBand(riskScore(entry.residualLikelihood, entry.residualImpact)).toUpperCase();
  addHistory(
    risk,
    `Assessment recorded: ${riskBand(riskScore(entry.residualLikelihood, entry.residualImpact))}, ${treatmentLabels[f.treatment].toLowerCase()}.`,
    actor,
  );
  return entry;
}
export function addRiskAction(risk, fields, actor) {
  if (risk.status === 'RETIRED') throw new Error('Restore this risk before adding actions.');
  const f = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v).trim()]));
  if (!f.title || !f.owner || !validDate(f.due)) throw new Error('Add an action, accountable owner, and valid due date.');
  const action = { id: crypto.randomUUID(), title: f.title, owner: f.owner, due: f.due, notes: f.notes || '', status: 'OPEN', created: today() };
  risk.actions ||= [];
  risk.actions.push(action);
  addHistory(risk, `Treatment action added: ${action.title}`, actor);
  return action;
}
export function completeRiskAction(risk, id, notes, actor) {
  const action = risk.actions?.find(a => a.id === id);
  if (!action || risk.status === 'RETIRED') throw new Error('Action is unavailable.');
  if (!notes?.trim()) throw new Error('Add completion findings or an evidence reference.');
  if (action.status === 'DONE') throw new Error('This action is already complete.');
  Object.assign(action, { status: 'DONE', completed: today(), completedBy: actor, completionNotes: notes.trim() });
  addHistory(risk, `Treatment action completed: ${action.title}. ${notes.trim()}`, actor);
}
export function archiveRisk(risk, actor) {
  const restoring = risk.status === 'RETIRED';
  risk.status = restoring ? 'OPEN' : 'RETIRED';
  if (restoring) {
    risk.residualLikelihood = null;
    risk.residualImpact = null;
    risk.acceptedUntil = null;
  }
  addHistory(risk, restoring ? 'Risk restored for reassessment.' : 'Risk archived. Assessment and action history retained.', actor);
}
