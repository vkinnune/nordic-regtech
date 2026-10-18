import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichGovernance } from '../src/data/governance-demo.js';
import { POLICIES, CONTROLS, RISKS } from '../src/data/governance.js';
import { saveGovernanceRecord, recordAssessment, toggleArchive, displayStatus, isOverdue } from '../src/features/governance-model.js';
const fixture = () => enrichGovernance(structuredClone({ policies: POLICIES, controls: CONTROLS, risks: RISKS }));
const fields = {
  title: 'Access policy',
  owner: 'Security',
  category: 'Security',
  summary: 'A sample policy.',
  content: 'Review access quarterly.',
  nextReviewDue: '2027-01-01',
};
const assessment = {
  reviewer: 'Reviewer',
  date: '2026-10-18',
  nextDue: '2027-01-18',
  evidence: 'DEMO-001',
  notes: 'Sample satisfied all criteria.',
  sample: '25 accounts',
  outcome: 'PASS',
};

test('demo upgrade is additive, idempotent, and preserves existing user edits', () => {
  const d = fixture();
  d.policies[0].title = 'User edit';
  d.controls[0].tests.push({ ...assessment });
  const before = structuredClone(d);
  enrichGovernance(d);
  assert.deepEqual(d, before);
  assert.equal(d.policies.length, 8);
  assert.equal(d.controls.length, 12);
  assert.ok(d.policies.every(p => p.content && p.history));
  assert.ok(d.controls.every(c => c.testProcedure && c.history));
});
test('new records start in draft or untested states and keep reciprocal parent links', () => {
  const d = fixture();
  const p = saveGovernanceRecord(d, 'policy', fields, null);
  assert.equal(p.status, 'DRAFT');
  const c = saveGovernanceRecord(
    d,
    'control',
    {
      ...fields,
      specification: 'Check access.',
      testProcedure: 'Inspect evidence.',
      nextTestDue: '2027-01-01',
      type: 'MANUAL',
      frequency: 'Quarterly',
      policyId: p.id,
    },
    null,
  );
  assert.equal(c.status, 'UNIMPLEMENTED');
  assert.deepEqual(p.controlIds, [c.id]);
  saveGovernanceRecord(d, 'control', { ...c, policyId: 'pol-aml-01' }, c.id);
  assert.deepEqual(p.controlIds, []);
  assert.ok(d.policies.find(x => x.id === 'pol-aml-01').controlIds.includes(c.id));
});
test('validation failures do not mutate records or links', () => {
  const d = fixture(),
    before = structuredClone(d);
  assert.throws(() => saveGovernanceRecord(d, 'policy', { ...fields, title: '   ' }, null));
  assert.throws(() => saveGovernanceRecord(d, 'control', { ...fields, policyId: 'missing' }, null));
  assert.deepEqual(d, before);
});
test('passing and failed tests retain evidence and update current effectiveness', () => {
  const c = fixture().controls[0];
  recordAssessment(c, 'control', assessment, 'Owner', '2026-10-18');
  assert.equal(c.status, 'EFFECTIVE');
  assert.ok(c.signedOffAt);
  assert.equal(c.tests[0].evidence, 'DEMO-001');
  recordAssessment(c, 'control', { ...assessment, outcome: 'FAIL', notes: 'One exception.' }, 'Owner', '2026-10-18');
  assert.equal(c.status, 'DEFICIENT');
  assert.equal(c.signedOffAt, null);
  assert.equal(c.tests.length, 3);
});
test('assessment requires supporting evidence, notes, valid dates, and a sample', () => {
  for (const patch of [
    { evidence: '' },
    { notes: '  ' },
    { reviewer: '' },
    { sample: '' },
    { date: '2027-01-01' },
    { date: 'garbage' },
    { nextDue: '2026-10-18' },
    { outcome: 'maybe' },
  ]) {
    const c = fixture().controls[0],
      before = structuredClone(c);
    assert.throws(() => recordAssessment(c, 'control', { ...assessment, ...patch }, 'Owner', '2026-10-18'));
    assert.deepEqual(c, before);
  }
});
test('older assessments cannot overwrite a newer decision', () => {
  const c = fixture().controls[0];
  recordAssessment(c, 'control', assessment, 'Owner', '2026-10-18');
  assert.throws(() => recordAssessment(c, 'control', { ...assessment, date: '2026-10-17' }, 'Owner', '2026-10-18'));
});
test('policy approval captures review, version, dates; changes request does not approve', () => {
  const p = fixture().policies[0];
  recordAssessment(p, 'policy', { ...assessment, outcome: 'APPROVE' }, 'Owner', '2026-10-18');
  assert.equal(p.status, 'ACTIVE');
  assert.equal(p.version, '4.0');
  assert.equal(p.lastReviewDate, '2026-10-18');
  assert.equal(p.nextReviewDue, '2027-01-18');
  recordAssessment(p, 'policy', { ...assessment, outcome: 'CHANGES' }, 'Owner', '2026-10-18');
  assert.equal(p.status, 'NEEDS_REVIEW');
  assert.equal(p.reviewedAt, null);
  assert.equal(p.reviews.length, 2);
});
test('editing approved requirements requires a fresh review or test', () => {
  const d = fixture(),
    p = d.policies.find(p => p.id === 'pol-access-01'),
    c = d.controls.find(c => c.id === 'ctl-access-01');
  saveGovernanceRecord(d, 'policy', { ...p, content: p.content + '\nNew requirement.' }, p.id);
  assert.equal(p.status, 'NEEDS_REVIEW');
  saveGovernanceRecord(d, 'control', { ...c, testProcedure: 'New sample method.' }, c.id);
  assert.equal(c.status, 'UNIMPLEMENTED');
});
test('archiving preserves history and restoration requires reassessment', () => {
  const c = fixture().controls[0],
    tests = structuredClone(c.tests);
  toggleArchive(c, 'control', 'Owner');
  assert.equal(c.status, 'RETIRED');
  assert.deepEqual(c.tests, tests);
  assert.throws(() => recordAssessment(c, 'control', assessment, 'Owner', '2026-10-18'));
  toggleArchive(c, 'control', 'Owner');
  assert.equal(c.status, 'UNIMPLEMENTED');
  assert.deepEqual(c.tests, tests);
});
test('draft, archived and untested records are never relabeled as effective or impacted', () => {
  for (const status of ['DRAFT', 'RETIRED', 'UNIMPLEMENTED']) assert.equal(displayStatus({ status }, 'control', true), status);
  assert.equal(displayStatus({ status: 'EFFECTIVE' }, 'control', true), 'DEFICIENT');
  assert.equal(isOverdue('2026-10-17', '2026-10-18'), true);
  assert.equal(isOverdue('2026-10-18', '2026-10-18'), false);
});

test('assessment snapshots preserve the reviewed content after later edits', () => {
  const d = fixture(),
    p = d.policies[0];
  const original = p.content;
  recordAssessment(p, 'policy', { ...assessment, outcome: 'APPROVE' }, 'Owner', '2026-10-18');
  saveGovernanceRecord(d, 'policy', { ...p, content: 'Revised requirements.' }, p.id);
  assert.equal(p.reviews[0].snapshot, original);
  assert.equal(p.reviews[0].version, '4.0');
  assert.equal(p.status, 'NEEDS_REVIEW');
});
test('invalid calendar dates and edits to archived records are rejected', () => {
  const d = fixture();
  assert.throws(() => saveGovernanceRecord(d, 'policy', { ...fields, nextReviewDue: '2027-02-31' }, null));
  const p = d.policies[0];
  toggleArchive(p, 'policy', 'Owner');
  const before = structuredClone(p);
  assert.throws(() => saveGovernanceRecord(d, 'policy', { ...p, title: 'Changed' }, p.id));
  assert.deepEqual(p, before);
});
