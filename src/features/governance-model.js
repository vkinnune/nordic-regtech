// Pure domain operations shared by the UI and behavioral tests.
export const policyStatuses = ['DRAFT', 'NEEDS_REVIEW', 'ACTIVE', 'RETIRED'];
export const controlStatuses = ['UNIMPLEMENTED', 'EFFECTIVE', 'DEFICIENT', 'RETIRED'];
export const statusNames = {
  DRAFT: 'Draft',
  NEEDS_REVIEW: 'Needs review',
  ACTIVE: 'Active',
  RETIRED: 'Archived',
  UNIMPLEMENTED: 'Not tested',
  EFFECTIVE: 'Effective',
  DEFICIENT: 'Needs attention',
};
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const today = () => new Date().toISOString().slice(0, 10);
export const isOverdue = (date, now = today()) => Boolean(date && date < now);
export function displayStatus(item, type, impacted = false) {
  if (item.status === 'RETIRED' || item.status === 'DRAFT' || item.status === 'UNIMPLEMENTED') return item.status;
  return impacted ? (type === 'policy' ? 'NEEDS_REVIEW' : 'DEFICIENT') : item.status;
}
export function addHistory(item, text, actor, now = new Date().toISOString()) {
  item.history ||= [];
  item.history.unshift({ date: now, actor, text });
}
export function saveGovernanceRecord(data, type, fields, id, actor = 'Workspace Owner') {
  if (!['policy', 'control'].includes(type)) throw new Error('Invalid record type.');
  const list = type === 'policy' ? data.policies : data.controls;
  const existing = id ? list.find(x => x.id === id) : null;
  if (id && !existing) throw new Error('This record is no longer available.');
  if (existing?.status === 'RETIRED') throw new Error('Restore this record before editing.');
  const clean = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
  for (const key of ['title', 'owner', 'category', type === 'policy' ? 'summary' : 'specification'])
    if (!clean[key]) throw new Error('Add a title, owner, category, and description.');
  if (type === 'control' && !data.policies.some(p => p.id === clean.policyId && (p.status !== 'RETIRED' || p.id === existing?.policyId)))
    throw new Error('Choose an active or draft parent policy.');
  const due = clean[type === 'policy' ? 'nextReviewDue' : 'nextTestDue'];
  if (!validDate(due)) throw new Error('Choose a valid next review or test date.');
  if (type === 'policy' && !clean.content) throw new Error('Add the policy requirements.');
  if (type === 'control' && (!clean.testProcedure || !clean.frequency || !['MANUAL', 'AUTOMATED', 'REPORTING'].includes(clean.type)))
    throw new Error('Add a test procedure, frequency, and control type.');
  const item = existing || {
    id: `${type}-${crypto.randomUUID()}`,
    code: `${type === 'policy' ? 'POL' : 'CTL'}-${String(Math.max(100, ...list.map(x => Number(x.code.split('-').at(-1)) || 0)) + 1).padStart(3, '0')}`,
    status: type === 'policy' ? 'DRAFT' : 'UNIMPLEMENTED',
    version: type === 'policy' ? '1.0' : undefined,
    statuteSections: [],
    controlIds: [],
    riskIds: [],
    reviews: [],
    tests: [],
    history: [],
    demo: true,
  };
  const keys =
    type === 'policy'
      ? ['title', 'owner', 'category', 'summary', 'content', 'nextReviewDue']
      : ['title', 'owner', 'category', 'specification', 'testProcedure', 'nextTestDue', 'type', 'frequency', 'policyId'];
  const materiallyChanged = existing && keys.filter(k => !['nextReviewDue', 'nextTestDue'].includes(k)).some(k => item[k] !== clean[k]);
  for (const key of keys) item[key] = clean[key];
  if (type === 'policy') item.shortTitle = item.title;
  if (materiallyChanged && type === 'policy' && item.status === 'ACTIVE') item.status = 'NEEDS_REVIEW';
  if (materiallyChanged && type === 'control' && item.status === 'EFFECTIVE') item.status = 'UNIMPLEMENTED';
  if (!existing) list.push(item);
  if (type === 'control')
    for (const p of data.policies)
      p.controlIds = [...new Set([...(p.controlIds || []).filter(cid => cid !== item.id), ...(p.id === item.policyId ? [item.id] : [])])];
  addHistory(item, existing ? 'Record updated.' : 'Record created.', actor);
  return item;
}
export function recordAssessment(item, type, fields, actor, now = today()) {
  if (item.status === 'RETIRED') throw new Error('Restore this record before recording an assessment.');
  const f = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v).trim()]));
  if (!f.notes || !f.evidence || !f.reviewer) throw new Error('Add a reviewer, evidence reference, and findings.');
  if (!validDate(f.date) || f.date > now) throw new Error('Assessment date must be today or earlier.');
  if (!validDate(f.nextDue) || f.nextDue <= now) throw new Error('The next review or test must be in the future.');
  const outcomes = type === 'policy' ? ['APPROVE', 'CHANGES'] : ['PASS', 'FAIL'];
  if (!outcomes.includes(f.outcome)) throw new Error('Choose a valid outcome.');
  if (type === 'control' && !f.sample) throw new Error('Describe the test sample or period.');
  const records = type === 'policy' ? (item.reviews ||= []) : (item.tests ||= []);
  if (records[0] && f.date < records[0].date) throw new Error('Use a date on or after the latest assessment.');
  const entry = { ...f, id: crypto.randomUUID(), demo: true, snapshot: type === 'policy' ? item.content : item.testProcedure };
  records.unshift(entry);
  if (type === 'policy') {
    item.status = f.outcome === 'APPROVE' ? 'ACTIVE' : 'NEEDS_REVIEW';
    item.lastReviewDate = f.date;
    item.nextReviewDue = f.nextDue;
    item.reviewedAt = f.outcome === 'APPROVE' ? Date.now() : null;
    item.reviewedBy = f.reviewer;
    if (f.outcome === 'APPROVE') item.version = `${Number.parseInt(item.version || '0', 10) + 1}.0`;
    entry.version = item.version;
  } else {
    item.status = f.outcome === 'PASS' ? 'EFFECTIVE' : 'DEFICIENT';
    item.nextTestDue = f.nextDue;
    item.signedOffAt = f.outcome === 'PASS' ? Date.now() : null;
    item.signedOffBy = f.reviewer;
  }
  addHistory(item, `${type === 'policy' ? 'Review' : 'Test'} recorded: ${f.outcome.toLowerCase()}. ${f.notes}`, actor);
}
export function toggleArchive(item, type, actor) {
  if (item.status === 'RETIRED') {
    item.status = type === 'policy' ? 'DRAFT' : 'UNIMPLEMENTED';
    addHistory(item, 'Restored for reassessment.', actor);
  } else {
    item.status = 'RETIRED';
    addHistory(item, 'Archived. History retained.', actor);
  }
}
