import { enrichRisks } from './risk-demo.js';
// Fictional workspace examples. These are not legal requirements or live assurance results.
const examples = [
  [
    'access',
    'Access management',
    'Information security',
    'Security Operations',
    'ACTIVE',
    '2026-12-15',
    'Access is granted on a least-privilege basis, approved by the system owner, and reviewed quarterly.',
    'Privileged access review',
    'MANUAL',
    'EFFECTIVE',
    'Quarterly',
    'Sample 25 privileged accounts; reconcile approved access, leavers, and exceptions against the access register.',
  ],
  [
    'bcp',
    'Business continuity',
    'Operational resilience',
    'Operations',
    'ACTIVE',
    '2026-11-20',
    'Critical services maintain recovery plans, named deputies, and tested recovery procedures. Exceptions are tracked to closure.',
    'Service recovery exercise',
    'MANUAL',
    'DEFICIENT',
    'Quarterly',
    'Restore the sample payments service in an isolated environment and compare recovery time and data loss with the approved targets.',
  ],
  [
    'conduct',
    'Conflicts of interest',
    'Market conduct',
    'Compliance',
    'DRAFT',
    '2026-11-30',
    'Staff disclose actual and potential conflicts. Compliance reviews disclosures before activities proceed and maintains the conflicts register.',
    'Conflict declaration review',
    'MANUAL',
    'UNIMPLEMENTED',
    'Annual',
    'Reconcile employee declarations with the staff roster and inspect the treatment of each disclosed conflict.',
  ],
  [
    'vendor',
    'Third-party oversight',
    'Operational resilience',
    'Vendor Management',
    'NEEDS_REVIEW',
    '2026-10-10',
    'Service owners classify suppliers, review assurance evidence, and document exit arrangements before onboarding and at renewal.',
    'Supplier assurance review',
    'REPORTING',
    'EFFECTIVE',
    'Quarterly',
    'Review the critical supplier register for current assurance reports, accountable owners, and approved exit arrangements.',
  ],
  [
    'records',
    'Records retention',
    'Information security',
    'Data Governance',
    'RETIRED',
    '2026-09-01',
    'Previous records handling standard, retained for historical reference. Current requirements are managed in the information security policy.',
    'Retention exception report',
    'AUTOMATED',
    'RETIRED',
    'Monthly',
    'Historical control: report records exceeding the approved retention schedule for review by data owners.',
  ],
];

export function enrichGovernance(data) {
  if (data.governanceDemoVersion === 1) return enrichRisks(data);
  data.policies ||= [];
  data.controls ||= [];
  for (const [key, title, category, owner, status, due, summary, ctlTitle, type, ctlStatus, frequency, specification] of examples) {
    const pid = `pol-${key}-01`,
      cid = `ctl-${key}-01`;
    if (!data.policies.some(p => p.id === pid))
      data.policies.push({
        id: pid,
        code: `POL-${key.toUpperCase()}-01`,
        title,
        shortTitle: title,
        category,
        owner,
        status,
        nextReviewDue: due,
        lastReviewDate: status === 'DRAFT' ? '' : '2026-07-15',
        version: '1.0',
        summary,
        statuteSections: [],
        controlIds: [cid],
        riskIds: [],
      });
    if (!data.controls.some(c => c.id === cid))
      data.controls.push({
        id: cid,
        code: `CTL-${key.toUpperCase()}-01`,
        title: ctlTitle,
        category,
        owner,
        status: ctlStatus,
        policyId: pid,
        type,
        frequency,
        specification,
        statuteSections: [],
      });
  }
  for (const p of data.policies) {
    p.content ??= `Purpose\n${p.summary || 'Document the purpose and scope of this policy.'}\n\nScope\nApplies to the relevant business teams, supporting systems, and service providers in this sample workspace.\n\nResponsibilities\nThe policy owner maintains this standard. Team leads implement the requirements and escalate exceptions to Compliance.\n\nRequirements\nMaintain documented procedures, assign accountable owners, and retain evidence of completed checks. Record exceptions with an owner and target resolution date.\n\nReview cycle\nReview at least annually and when material business or regulatory changes are identified.`;
    p.reviews ??= [];
    p.history ??= [{ date: '2026-09-15T09:00:00Z', actor: 'Compliance', text: 'Sample policy added to the register.' }];
    p.demo = true;
  }
  for (const c of data.controls) {
    c.testProcedure ??= `Select a representative sample from the review period. ${c.specification || 'Compare evidence with the control objective.'} Record the sample size, exceptions, and evidence reference. Escalate failures to the control owner.`;
    c.nextTestDue ??= c.status === 'DEFICIENT' ? '2026-10-12' : '2026-11-20';
    c.tests ??= ['EFFECTIVE', 'DEFICIENT'].includes(c.status)
      ? [
          {
            id: `sample-${c.id}`,
            date: '2026-09-15',
            outcome: c.status === 'EFFECTIVE' ? 'PASS' : 'FAIL',
            reviewer: 'Assurance Team',
            evidence: `DEMO-EVIDENCE / ${c.code} / Q3-2026`,
            notes:
              c.status === 'EFFECTIVE'
                ? 'Sample of 25 items met the documented criteria. No exceptions identified.'
                : 'Two exceptions in a sample of 25. Owner assigned to update the procedure and repeat the test.',
            sample: '25 items',
            demo: true,
          },
        ]
      : [];
    c.history ??= [{ date: '2026-09-15T09:00:00Z', actor: 'Assurance Team', text: 'Sample control added to the register.' }];
    c.demo = true;
  }
  data.governanceDemoVersion = 1;
  return enrichRisks(data);
}
