import { A, IN } from './actions.js';
import { S, D, risk, riskControls, isControlImpacted, logAct, save } from '../core/store.js';
import { focusKey, render } from '../shell/render.js';
import { toast } from '../ui/toast.js';
import { today } from '../features/governance-model.js';
import { saveRisk, assessRisk, addRiskAction, completeRiskAction, archiveRisk } from '../features/risk-model.js';
const actor = () => D().members.find(m => m.id === D().me)?.name || 'Workspace Owner';
const nextReview = () => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d.toISOString().slice(0, 10);
};
function open(id, mode, draft) {
  if (!S.ui.govDrawer) S.ui.drawerOpener = focusKey(document.activeElement);
  S.ui.drawer = null;
  S.ui.changeDrawer = null;
  S.ui.govDrawer = { type: 'risk', id, mode };
  S.ui.riskDraft = draft;
  S.ui.riskError = '';
  render();
  document.querySelector('.risk-detail .gov-form input')?.focus();
}
A.riskNew = () =>
  open(null, 'new', {
    title: '',
    owner: '',
    category: '',
    consequence: '',
    inherentLikelihood: 3,
    inherentImpact: 3,
    nextReviewDue: nextReview(),
    controlIds: [],
    policyIds: [],
  });
A.riskEdit = el => {
  const r = risk(el.dataset.id);
  if (r) open(r.id, 'edit', { ...r, controlIds: riskControls(r).map(c => c.id), policyIds: [...(r.policyIds || [])] });
};
A.riskAssess = el => {
  const r = risk(el.dataset.id);
  if (r)
    open(r.id, 'assess', {
      reviewer: r.owner,
      date: today(),
      residualLikelihood: r.residualLikelihood || r.inherentLikelihood,
      residualImpact: r.residualImpact || r.inherentImpact,
      treatment: r.treatment || 'MITIGATE',
      treatmentPlan: r.treatmentPlan || '',
      nextReviewDue: nextReview(),
      rationale: '',
      evidence: '',
      acceptedBy: '',
      acceptedUntil: '',
      acceptanceReason: '',
    });
};
A.riskAddAction = el => {
  const r = risk(el.dataset.id);
  if (r) open(r.id, 'action', { title: '', owner: r.owner, due: nextReview(), notes: '' });
};
A.riskCompleteAction = el => {
  S.ui.riskActionId = el.dataset.action;
  open(el.dataset.id, 'complete', { completionNotes: '' });
};
A.riskCancel = () => {
  const g = S.ui.govDrawer;
  if (g.id) S.ui.govDrawer = { type: 'risk', id: g.id };
  else delete S.ui.govDrawer;
  S.ui.riskDraft = null;
  S.ui.riskError = '';
  render();
};
IN.riskDraft = el => {
  S.ui.riskDraft[el.dataset.field] = el.value;
  if (['inherentLikelihood', 'inherentImpact', 'residualLikelihood', 'residualImpact', 'treatment'].includes(el.dataset.field)) render();
};
IN.riskLinkDraft = el => {
  const ids = S.ui.riskDraft[el.name] || [];
  S.ui.riskDraft[el.name] = el.checked ? [...new Set([...ids, el.value])] : ids.filter(id => id !== el.value);
};
IN.riskSearch = el => {
  S.ui.rskQ = el.value;
  S.ui.riskCell = '';
  render();
};
IN.riskFilter = el => {
  S.ui[el.dataset.key] = el.value;
  S.ui.riskCell = '';
  render();
};
A.riskFilter = el => {
  S.ui.rskFilter = el.dataset.value;
  S.ui.riskCell = '';
  render();
};
A.riskMatrixCell = el => {
  S.ui.riskCell = S.ui.riskCell === el.dataset.cell ? '' : el.dataset.cell;
  render();
};
A.riskToggleMatrix = () => {
  S.ui.riskMatrix = !S.ui.riskMatrix;
  S.ui.riskCell = '';
  render();
};
A.riskClear = () => {
  Object.assign(S.ui, { rskQ: '', rskFilter: 'all', riskCategory: '', riskBand: '', riskSort: 'score', riskCell: '' });
  render();
};
A.riskSave = form => {
  const { id, mode } = form.dataset,
    fd = new FormData(form),
    f = Object.fromEntries(fd);
  if (mode === 'new' || mode === 'edit') {
    f.controlIds = fd.getAll('controlIds');
    f.policyIds = fd.getAll('policyIds');
  }
  S.ui.riskDraft = f;
  try {
    let r = risk(id);
    if (mode === 'new' || mode === 'edit') r = saveRisk(D(), f, id, actor());
    else {
      if (!r) throw new Error('Risk not found.');
      if (mode === 'assess') assessRisk(r, f, D().controls, actor(), undefined, isControlImpacted);
      else if (mode === 'action') addRiskAction(r, f, actor());
      else if (mode === 'complete') completeRiskAction(r, S.ui.riskActionId, f.completionNotes, actor());
    }
    logAct(
      'updated',
      null,
      `${r.code}: ${mode === 'assess' ? 'assessment recorded' : mode === 'action' ? 'treatment action added' : mode === 'complete' ? 'treatment action completed' : 'risk saved'}`,
    );
    save();
    S.ui.govDrawer = { type: 'risk', id: r.id };
    S.ui.riskTab = mode === 'assess' ? 'assessments' : ['action', 'complete'].includes(mode) ? 'treatment' : 'overview';
    S.ui.riskError = '';
    S.ui.riskDraft = null;
    render();
    toast(mode === 'assess' ? 'Assessment recorded.' : mode === 'complete' ? 'Treatment action completed.' : 'Risk saved.');
  } catch (error) {
    S.ui.riskError = error.message;
    render();
    document.querySelector('.risk-detail [role=alert]')?.focus();
  }
};
A.riskArchive = el => {
  const r = risk(el.dataset.id);
  if (!r) return;
  archiveRisk(r, actor());
  save();
  logAct('updated', null, `${r.code}: ${r.status === 'RETIRED' ? 'archived' : 'restored'}`);
  render();
  toast(r.status === 'RETIRED' ? 'Risk archived. History retained.' : 'Risk restored for reassessment.');
};
