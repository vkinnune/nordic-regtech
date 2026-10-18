import test from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/data/seed.js';
import { enrichRisks } from '../src/data/risk-demo.js';
import {
  riskScore,
  riskBand,
  controlAssurance,
  riskNeedsReview,
  filteredRisks,
  saveRisk,
  assessRisk,
  addRiskAction,
  completeRiskAction,
  archiveRisk,
  linkedRiskControls,
} from '../src/features/risk-model.js';
import { GovernanceMatrix } from '../src/data/governance.js';
const fields = {
  title: 'Service dependency failure',
  owner: 'Operations',
  category: 'Operational resilience',
  consequence: 'A dependency outage could interrupt client services.',
  inherentLikelihood: '4',
  inherentImpact: '5',
  nextReviewDue: '2026-12-01',
  controlIds: ['ctl-bcp-01'],
  policyIds: ['pol-bcp-01'],
};
const assessment = {
  reviewer: 'Risk Owner',
  date: '2026-10-18',
  residualLikelihood: '2',
  residualImpact: '4',
  nextReviewDue: '2027-01-18',
  treatment: 'MITIGATE',
  treatmentPlan: 'Validate recovery arrangements.',
  rationale: 'Recovery testing supports a lower likelihood; impact remains major.',
  evidence: 'DEMO-RISK-REVIEW-01',
};
const newRisk = () => {
  const data = seed();
  return { data, r: saveRisk(data, fields, null, 'Risk Owner') };
};
test('risk scores and bands have explicit boundaries and no zero-score fallback', () => {
  for (const [l, i, s] of [
    [1, 1, 1],
    [2, 2, 4],
    [1, 5, 5],
    [3, 4, 12],
    [4, 5, 20],
    [5, 5, 25],
  ])
    assert.equal(riskScore(l, i), s);
  for (const value of [null, undefined, '', 0, 6, 1.5, 'invalid']) assert.equal(riskScore(value, 3), null);
  assert.deepEqual([null, 1, 4, 5, 11, 12, 19, 20, 25].map(riskBand), [
    'Unassessed',
    'Low',
    'Low',
    'Moderate',
    'Moderate',
    'High',
    'High',
    'Critical',
    'Critical',
  ]);
});
test('risk demo migration preserves records and is idempotent', () => {
  const data = seed();
  assert.equal(data.risks.length, 8);
  data.risks[0].owner = 'Custom owner';
  const before = structuredClone(data);
  enrichRisks(data);
  assert.deepEqual(data, before);
  assert.ok(data.risks.every(r => r.owner && r.history && Array.isArray(r.assessments)));
});
test('risk creation is unassessed and maintains bidirectional multi-risk links', () => {
  const { data, r } = newRisk();
  assert.equal(r.status, 'OPEN');
  assert.equal(riskScore(r.residualLikelihood, r.residualImpact), null);
  assert.ok(data.controls.find(c => c.id === 'ctl-bcp-01').riskIds.includes(r.id));
  assert.ok(data.policies.find(p => p.id === 'pol-bcp-01').riskIds.includes(r.id));
  const matrix = new GovernanceMatrix(data.policies, data.controls, data.risks);
  assert.equal(matrix.getRiskControls(r.id).length, 1);
  saveRisk(data, { ...fields, controlIds: ['ctl-access-01'], policyIds: ['pol-access-01'] }, r.id, 'Owner');
  assert.deepEqual(
    linkedRiskControls(r, data.controls).map(c => c.id),
    ['ctl-access-01'],
  );
  assert.equal(data.policies.find(p => p.id === 'pol-bcp-01').riskIds.includes(r.id), false);
});
test('unlinking a legacy single-risk control removes the reverse link', () => {
  const data = seed(),
    r = data.risks[0];
  saveRisk(data, { ...r, controlIds: [], policyIds: [] }, r.id, 'Owner');
  assert.equal(linkedRiskControls(r, data.controls).length, 0);
  assert.equal(new GovernanceMatrix(data.policies, data.controls, data.risks).getRiskControls(r.id).length, 0);
});
test('invalid risk drafts do not mutate the store', () => {
  for (const patch of [
    { title: ' ' },
    { inherentLikelihood: 6 },
    { nextReviewDue: '2027-02-31' },
    { controlIds: ['missing'] },
    { policyIds: ['pol-records-01'] },
  ]) {
    const data = seed(),
      before = structuredClone(data);
    assert.throws(() => saveRisk(data, { ...fields, ...patch }, null, 'Owner'));
    assert.deepEqual(data, before);
  }
});
test('assessment records manual scores and immutable scenario/control snapshots', () => {
  const { data, r } = newRisk();
  const entry = assessRisk(r, assessment, data.controls, 'Owner', '2026-10-18');
  assert.equal(r.status, 'MITIGATING');
  assert.equal(riskScore(r.residualLikelihood, r.residualImpact), 8);
  const snapshot = structuredClone(entry);
  data.controls.find(c => c.id === 'ctl-bcp-01').status = 'EFFECTIVE';
  assert.deepEqual(entry, snapshot);
  assert.equal(riskScore(r.residualLikelihood, r.residualImpact), 8);
  saveRisk(data, { ...r, consequence: 'Updated scenario' }, r.id, 'Owner');
  assert.equal(r.status, 'OPEN');
  assert.equal(r.residualLikelihood, null);
  assert.deepEqual(entry, snapshot);
});
test('assessment validates evidence, numeric levels, chronology, and dates atomically', () => {
  for (const patch of [
    { reviewer: '' },
    { rationale: '' },
    { evidence: '' },
    { residualImpact: 7 },
    { date: '2026-10-19' },
    { date: '2026-02-31' },
    { nextReviewDue: '2026-10-18' },
    { treatment: 'OTHER' },
    { treatmentPlan: '' },
  ]) {
    const { data, r } = newRisk(),
      before = structuredClone(r);
    assert.throws(() => assessRisk(r, { ...assessment, ...patch }, data.controls, 'Owner', '2026-10-18'));
    assert.deepEqual(r, before);
  }
  const { data, r } = newRisk();
  assessRisk(r, assessment, data.controls, 'Owner', '2026-10-18');
  assert.throws(() => assessRisk(r, { ...assessment, date: '2026-10-17' }, data.controls, 'Owner', '2026-10-18'));
});
test('acceptance requires an approver, justification and expiry covering the review date', () => {
  const { data, r } = newRisk();
  const f = {
    ...assessment,
    treatment: 'ACCEPT',
    acceptedBy: 'Risk Committee',
    acceptanceReason: 'Time-limited monitoring approved.',
    acceptedUntil: '2027-02-01',
  };
  for (const patch of [{ acceptedBy: '' }, { acceptanceReason: '' }, { acceptedUntil: '2026-10-18' }, { acceptedUntil: '2026-11-01' }])
    assert.throws(() => assessRisk(r, { ...f, ...patch }, data.controls, 'Owner', '2026-10-18'));
  assessRisk(r, f, data.controls, 'Owner', '2026-10-18');
  assert.equal(r.status, 'ACCEPTED');
  assert.equal(riskNeedsReview(r, '2027-02-01'), true);
  assessRisk(r, { ...assessment, treatment: 'MONITOR' }, data.controls, 'Owner', '2026-10-18');
  assert.equal(r.status, 'MONITORING');
  assert.equal(r.acceptedUntil, null);
});
test('control assurance distinguishes stale, untested, failed and impacted safeguards', () => {
  const c = { status: 'EFFECTIVE', tests: [{ outcome: 'PASS' }], nextTestDue: '2026-11-01' };
  assert.equal(controlAssurance(c, '2026-10-18'), 'Current');
  assert.equal(controlAssurance(c, '2026-11-02'), 'Test overdue');
  assert.equal(controlAssurance(c, '2026-10-18', true), 'Needs attention');
  assert.equal(controlAssurance({ ...c, tests: [] }, '2026-10-18'), 'Not tested');
  assert.equal(controlAssurance({ ...c, status: 'RETIRED' }, '2026-10-18'), 'Archived');
  assert.equal(controlAssurance({ ...c, status: 'DEFICIENT' }, '2026-10-18'), 'Needs attention');
});
test('treatment action completion needs evidence and does not automatically lower exposure', () => {
  const { data, r } = newRisk();
  assessRisk(r, assessment, data.controls, 'Owner', '2026-10-18');
  const a = addRiskAction(r, { title: 'Run recovery exercise', owner: 'Operations', due: '2026-11-15', notes: 'Include dependencies' }, 'Owner');
  assert.throws(() => completeRiskAction(r, a.id, ' ', 'Owner'));
  assert.equal(a.status, 'OPEN');
  completeRiskAction(r, a.id, 'DEMO-RECOVERY-01 confirms target met.', 'Owner');
  assert.equal(a.status, 'DONE');
  assert.ok(a.completed);
  assert.equal(riskScore(r.residualLikelihood, r.residualImpact), 8);
  assert.throws(() => completeRiskAction(r, a.id, 'duplicate', 'Owner'));
});
test('archive preserves assessments and actions, restoration requires reassessment', () => {
  const { data, r } = newRisk();
  assessRisk(r, assessment, data.controls, 'Owner', '2026-10-18');
  const previous = structuredClone(r.assessments);
  archiveRisk(r, 'Owner');
  assert.equal(r.status, 'RETIRED');
  assert.throws(() => assessRisk(r, assessment, data.controls, 'Owner', '2026-10-18'));
  assert.throws(() => addRiskAction(r, { title: 'x', owner: 'x', due: '2026-11-15' }, 'Owner'));
  archiveRisk(r, 'Owner');
  assert.equal(r.status, 'OPEN');
  assert.equal(r.residualImpact, null);
  assert.deepEqual(r.assessments, previous);
});
test('register filters combine status, rating, category, search and matrix cell; sorting is deterministic', () => {
  const { risks } = seed();
  assert.equal(filteredRisks(risks).length, 7);
  assert.equal(filteredRisks(risks, { status: 'RETIRED' }).length, 1);
  assert.equal(filteredRisks(risks, { band: 'Unassessed' })[0].id, 'rsk-conduct-01');
  assert.equal(filteredRisks(risks, { q: 'Security Operations', category: 'Information security', cell: '2-4' })[0].id, 'rsk-access-01');
  assert.equal(filteredRisks(risks, { cell: '5-5' }).length, 0);
  assert.deepEqual(
    filteredRisks(risks, { status: 'review' }, '2026-10-18')
      .map(r => r.id)
      .sort(),
    ['rsk-conduct-01', 'rsk-recovery-01'],
  );
  assert.equal(filteredRisks(risks, { sort: 'score' })[0].id, 'rsk-alg-01');
});
