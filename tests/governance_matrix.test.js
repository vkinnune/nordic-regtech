import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POLICIES,
  CONTROLS,
  RISKS,
  GovernanceMatrix,
  createGovernanceMatrix,
} from '../src/data/governance.js';

test('GovernanceMatrix: initialization and index creation', () => {
  const matrix = createGovernanceMatrix(POLICIES, CONTROLS, RISKS);
  assert.ok(matrix instanceof GovernanceMatrix, 'Should instantiate GovernanceMatrix');
  assert.equal(typeof matrix.getSectionObligations, 'function');
  assert.equal(typeof matrix.getComplianceGap, 'function');
});

test('GovernanceMatrix: O(1) section obligations lookup', () => {
  const matrix = createGovernanceMatrix(POLICIES, CONTROLS, RISKS);

  // SFS 2007:528 14 kap. 1 § is covered by Algorithmic Trading policy and controls
  const secId = 'riksdagen_sfs-2007-528_k14_p1';
  const ob = matrix.getSectionObligations(secId);

  assert.ok(ob.policies.length >= 1, 'Should find linked policies');
  assert.ok(ob.policies.some(p => p.id === 'pol-alg-01'), 'Should contain pol-alg-01');

  assert.ok(ob.controls.length >= 1, 'Should find linked controls');
  assert.ok(ob.controls.some(c => c.id === 'ctl-alg-01'), 'Should contain ctl-alg-01');

  assert.ok(ob.risks.length >= 1, 'Should find linked risks');
  assert.ok(ob.risks.some(r => r.id === 'rsk-alg-01'), 'Should contain rsk-alg-01');

  // Non-existent or unlinked section returns empty arrays safely
  const emptySec = matrix.getSectionObligations('non-existent-section-id');
  assert.deepEqual(emptySec.policies, []);
  assert.deepEqual(emptySec.controls, []);
  assert.deepEqual(emptySec.risks, []);
});

test('GovernanceMatrix: compliance gap evaluation', () => {
  const matrix = createGovernanceMatrix(POLICIES, CONTROLS, RISKS);

  // Covered section
  const coveredSec = 'riksdagen_sfs-2017-630_k3_p1';
  const gapCovered = matrix.getComplianceGap(coveredSec);
  assert.equal(gapCovered.isCovered, true);
  assert.equal(gapCovered.hasControls, true);
  assert.equal(gapCovered.hasPolicies, true);
  assert.equal(gapCovered.gapStatus, 'COVERED');

  // Unlinked section
  const unlinkedSec = 'sfs-1999-999-sec-1';
  const gapUnlinked = matrix.getComplianceGap(unlinkedSec);
  assert.equal(gapUnlinked.isCovered, false);
  assert.equal(gapUnlinked.hasControls, false);
  assert.equal(gapUnlinked.gapStatus, 'OPEN_GAPS');
});

test('GovernanceMatrix: dynamic linking and unlinking with index consistency', () => {
  const testPolicies = [{ id: 'pol-t1', statuteSections: [] }];
  const testControls = [{ id: 'ctl-t1', statuteSections: [] }];
  const testRisks = [{ id: 'rsk-t1', statuteSections: [] }];
  const matrix = createGovernanceMatrix(testPolicies, testControls, testRisks);

  const testSec = 'test-sec-1';
  assert.deepEqual(matrix.getSectionObligations(testSec).controls, []);

  // Link control
  const linked = matrix.linkSection(testSec, { type: 'control', id: 'ctl-t1' });
  assert.equal(linked, true);
  assert.equal(matrix.getSectionObligations(testSec).controls.length, 1);
  assert.equal(matrix.getSectionObligations(testSec).controls[0].id, 'ctl-t1');

  // Idempotency: re-linking same control returns false / does not duplicate
  const reLinked = matrix.linkSection(testSec, { type: 'control', id: 'ctl-t1' });
  assert.equal(reLinked, false);
  assert.equal(matrix.getSectionObligations(testSec).controls.length, 1);

  // Unlink control
  const unlinked = matrix.unlinkSection(testSec, { type: 'control', id: 'ctl-t1' });
  assert.equal(unlinked, true);
  assert.equal(matrix.getSectionObligations(testSec).controls.length, 0);
});

test('GovernanceMatrix: policy and risk relationships', () => {
  const matrix = createGovernanceMatrix(POLICIES, CONTROLS, RISKS);

  const polCtls = matrix.getPolicyControls('pol-alg-01');
  assert.ok(polCtls.length >= 2, 'Should resolve controls for pol-alg-01');

  const rskCtls = matrix.getRiskControls('rsk-dora-01');
  assert.ok(rskCtls.length >= 2, 'Should resolve controls for rsk-dora-01');

  const doraRisk = RISKS.find(r => r.id === 'rsk-dora-01');
  const exposure = matrix.getRiskExposure(doraRisk);
  assert.ok(exposure.score > 0, 'Risk exposure score should be calculated');
  assert.ok(['COVERED', 'OPEN_GAPS', 'AT_RISK'].includes(exposure.gapStatus));
});
