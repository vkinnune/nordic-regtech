// Fictional risk assessments and treatment actions for the sample workspace.
const examples = [
  [
    'access',
    'Unauthorized privileged access',
    'Information security',
    'Security Operations',
    4,
    5,
    2,
    4,
    'MITIGATING',
    '2026-11-15',
    'Excessive or stale administrator access could permit unauthorized changes to critical systems.',
    'Remove dormant privileged accounts and introduce independent exception review.',
    ['ctl-access-01'],
    ['pol-access-01'],
  ],
  [
    'recovery',
    'Critical service recovery failure',
    'Operational resilience',
    'Operations',
    4,
    5,
    3,
    5,
    'MITIGATING',
    '2026-10-12',
    'A service interruption could exceed recovery targets and delay client transactions.',
    'Repeat the recovery exercise after resolving backup validation exceptions.',
    ['ctl-bcp-01'],
    ['pol-bcp-01'],
  ],
  [
    'conduct',
    'Undisclosed conflicts of interest',
    'Market conduct',
    'Compliance',
    3,
    4,
    null,
    null,
    'OPEN',
    '2026-11-30',
    'Undisclosed interests could influence client decisions and undermine fair treatment.',
    'Complete the conflicts declaration campaign and assess exceptions.',
    ['ctl-conduct-01'],
    ['pol-conduct-01'],
  ],
  [
    'vendor',
    'Concentration in critical suppliers',
    'Third-party risk',
    'Vendor Management',
    3,
    4,
    2,
    3,
    'ACCEPTED',
    '2026-11-15',
    'Dependence on a single specialist provider could limit continuity options during an outage.',
    'Monitor service indicators monthly while an alternative provider is evaluated.',
    ['ctl-vendor-01'],
    ['pol-vendor-01'],
  ],
  [
    'records',
    'Legacy records migration',
    'Information security',
    'Data Governance',
    2,
    3,
    1,
    2,
    'RETIRED',
    '2026-09-01',
    'Incomplete migration of legacy records could affect retrieval and retention.',
    'Migration reconciled and the legacy platform retired.',
    ['ctl-records-01'],
    ['pol-records-01'],
  ],
];
export function enrichRisks(data) {
  if (data.riskDemoVersion === 1) return data;
  data.risks ||= [];
  for (const [key, title, category, owner, il, ii, rl, ri, status, due, consequence, plan, controlIds, policyIds] of examples) {
    if (data.risks.some(r => r.id === `rsk-${key}-01`)) continue;
    data.risks.push({
      id: `rsk-${key}-01`,
      code: `RSK-${key.toUpperCase()}-01`,
      title,
      category,
      owner,
      inherentLikelihood: il,
      inherentImpact: ii,
      residualLikelihood: rl,
      residualImpact: ri,
      status,
      nextReviewDue: due,
      consequence,
      treatmentPlan: plan,
      controlIds,
      policyIds,
      statuteSections: [],
      demo: true,
    });
  }
  const legacy = {
    'rsk-alg-01': ['Trading Operations', 4, 5, 4, 5, 'MITIGATING', '2026-10-25', 'Recalibrate pre-trade limits and repeat the emergency stop exercise.'],
    'rsk-dora-01': ['Technology Risk', 4, 4, 3, 4, 'MITIGATING', '2026-11-05', 'Complete supplier exit plans and validate service recovery dependencies.'],
    'rsk-aml-01': ['Financial Crime', 3, 5, 2, 4, 'MONITORING', '2026-12-01', 'Monitor screening exceptions and review detection scenarios each quarter.'],
  };
  for (const r of data.risks) {
    const values = legacy[r.id];
    if (values) {
      for (const [i, key] of [
        'owner',
        'inherentLikelihood',
        'inherentImpact',
        'residualLikelihood',
        'residualImpact',
        'status',
        'nextReviewDue',
        'treatmentPlan',
      ].entries())
        r[key] ??= values[i];
    }
    r.status ||= 'OPEN';
    r.owner ||= 'Risk Management';
    r.nextReviewDue ||= '2026-11-30';
    r.inherentLikelihood ??= 3;
    r.inherentImpact ??= 3;
    r.residualLikelihood ??= null;
    r.residualImpact ??= null;
    r.treatment ||= r.status === 'ACCEPTED' ? 'ACCEPT' : r.status === 'MONITORING' ? 'MONITOR' : 'MITIGATE';
    r.actions ??=
      r.status === 'MITIGATING'
        ? [
            {
              id: `action-${r.id}`,
              title: r.treatmentPlan,
              owner: r.owner,
              due: r.nextReviewDue,
              notes: 'Record the outcome and supporting evidence after completing this sample action.',
              status: 'OPEN',
              created: '2026-09-15',
            },
          ]
        : [];
    r.assessments ??=
      r.residualLikelihood && r.residualImpact
        ? [
            {
              id: `assessment-${r.id}`,
              date: '2026-09-15',
              reviewer: r.owner,
              inherentLikelihood: r.inherentLikelihood,
              inherentImpact: r.inherentImpact,
              residualLikelihood: r.residualLikelihood,
              residualImpact: r.residualImpact,
              treatment: r.treatment,
              treatmentPlan: r.treatmentPlan,
              nextReviewDue: r.nextReviewDue,
              rationale:
                'Sample assessment based on the scenario, existing safeguards, and recorded control tests. Residual exposure remains subject to periodic review.',
              evidence: `DEMO-RISK / ${r.code} / Q3-2026`,
              scenario: r.consequence,
              controls: (data.controls || [])
                .filter(c => r.controlIds?.includes(c.id))
                .map(c => ({ id: c.id, code: c.code, title: c.title, assurance: c.status === 'EFFECTIVE' ? 'Current' : 'Needs attention' })),
              ...(r.status === 'ACCEPTED'
                ? {
                    acceptedBy: 'Risk Committee',
                    acceptedUntil: '2026-12-15',
                    acceptanceReason: 'Time-limited sample acceptance while the alternative supplier is evaluated.',
                  }
                : {}),
              demo: true,
            },
          ]
        : [];
    r.lastAssessed ??= r.assessments[0]?.date || null;
    if (r.status === 'ACCEPTED') r.acceptedUntil ??= '2026-12-15';
    r.history ??= [{ date: '2026-09-15T09:00:00Z', actor: 'Risk Management', text: 'Sample risk added to the register.' }];
    r.demo = true;
    for (const p of data.policies || []) if (r.policyIds?.includes(p.id)) p.riskIds = [...new Set([...(p.riskIds || []), r.id])];
  }
  data.riskDemoVersion = 1;
  return data;
}
