import { A, IN } from './actions.js';
import { S, D, policy, control, save, logAct } from '../core/store.js';
import { focusKey, render } from '../shell/render.js';
import { toast } from '../ui/toast.js';
import { saveGovernanceRecord, recordAssessment, toggleArchive, today } from '../features/governance-model.js';
import { assessmentDefaults } from '../features/governance-ui.js';
const find = (type, id) => (type === 'policy' ? policy(id) : control(id));
const actor = () => D().members.find(m => m.id === D().me)?.name || 'Workspace Owner';
function open(type, id, mode, draft) {
  if (!S.ui.govDrawer) S.ui.drawerOpener = focusKey(document.activeElement);
  S.ui.drawer = null;
  S.ui.changeDrawer = null;
  S.ui.govDrawer = { type, id, mode };
  S.ui.govDraft = draft;
  S.ui.govError = '';
  S.ui.govTab = 'overview';
  render();
  document.querySelector('.gov-form input')?.focus();
}
A.govNew = el => {
  const type = el.dataset.type;
  open(type, null, 'new', {
    title: '',
    owner: '',
    category: '',
    summary: '',
    content: '',
    specification: '',
    testProcedure: '',
    nextReviewDue: today(),
    nextTestDue: today(),
    type: 'MANUAL',
    frequency: 'Quarterly',
    policyId: el.dataset.policy || '',
  });
};
A.govEdit = el => {
  const item = find(el.dataset.type, el.dataset.id);
  if (item) open(el.dataset.type, item.id, 'edit', { ...item });
};
A.govAssess = el => {
  const item = find(el.dataset.type, el.dataset.id);
  if (item) open(el.dataset.type, item.id, 'assess', assessmentDefaults(el.dataset.type, item));
};
A.govCancel = () => {
  const g = S.ui.govDrawer;
  if (g.id) S.ui.govDrawer = { type: g.type, id: g.id };
  else delete S.ui.govDrawer;
  S.ui.govDraft = null;
  S.ui.govError = '';
  render();
};
IN.govDraft = el => {
  S.ui.govDraft ||= {};
  S.ui.govDraft[el.dataset.field] = el.value;
};
IN.govFilter = el => {
  S.ui[el.dataset.key] = el.value;
  render();
};
A.govClear = el => {
  const policy = el.dataset.type === 'policy';
  Object.assign(
    S.ui,
    policy
      ? { polQ: '', polStatus: 'all', policyCategory: '', policySort: 'due' }
      : { ctlQ: '', ctlFilter: 'all', controlCategory: '', controlType: '', controlSort: 'due' },
  );
  render();
};
A.govSave = form => {
  const { type, id, mode } = form.dataset,
    fields = Object.fromEntries(new FormData(form));
  S.ui.govDraft = fields;
  try {
    let item;
    if (mode === 'assess') {
      item = find(type, id);
      if (!item) throw new Error('Record not found.');
      recordAssessment(item, type, fields, actor());
    } else item = saveGovernanceRecord(D(), type, fields, id, actor());
    logAct('updated', null, `${item.code}: ${mode === 'assess' ? 'assessment recorded' : mode === 'new' ? 'created' : 'updated'}`);
    save();
    S.ui.govDrawer = { type, id: item.id };
    S.ui.govTab = mode === 'assess' ? 'assessments' : 'overview';
    S.ui.govDraft = null;
    S.ui.govError = '';
    render();
    toast(mode === 'assess' ? 'Assessment recorded.' : 'Record saved.');
  } catch (error) {
    S.ui.govError = error.message;
    render();
    document.querySelector('.gov-form [role=alert]')?.focus();
  }
};
A.govArchive = el => {
  const type = el.dataset.type,
    item = find(type, el.dataset.id);
  if (!item) return;
  toggleArchive(item, type, actor());
  logAct('updated', null, `${item.code}: ${item.status === 'RETIRED' ? 'archived' : 'restored'}`);
  save();
  render();
  toast(item.status === 'RETIRED' ? 'Archived. You can restore this record.' : 'Restored for reassessment.');
};
// Existing entry points now require a documented assessment instead of a one-click sign-off.
A.resolveGap = el => A.govAssess({ dataset: { type: 'control', id: el.dataset.id } });
A.signOffPolicy = el => A.govAssess({ dataset: { type: 'policy', id: el.dataset.id } });
