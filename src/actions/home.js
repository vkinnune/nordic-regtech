import { A, IN } from './actions.js';
import { S } from '../core/store.js';
import { render } from '../shell/render.js';
A.homeRegTab = el => {
  S.ui.homeRegTab = el.dataset.value;
  S.ui.homeRegLimit = 3;
  render();
};
IN.homeRegSearch = el => {
  S.ui.homeRegQuery = el.value;
  S.ui.homeRegLimit = 3;
  render();
};
IN.homeRegPeriod = el => {
  S.ui.homeRegPeriod = el.value;
  S.ui.homeRegLimit = 3;
  render();
};
A.homeRegMore = () => {
  S.ui.homeRegLimit = (S.ui.homeRegLimit || 3) + 3;
  render();
};
A.homeRegReset = () => {
  Object.assign(S.ui, { homeRegQuery: '', homeRegPeriod: 'focus', homeRegLimit: 3 });
  render();
};
A.homeShowUpcoming = () => {
  Object.assign(S.ui, { homeRegTab: 'changes', homeRegPeriod: 'upcoming', homeRegQuery: '', homeRegLimit: 3 });
  render();
};
A.homeAllChanges = () => {
  Object.assign(S.ui, { changesView: 'feed', changesQ: '', changesSource: 'all', changesStatus: 'all' });
  A.go({ dataset: { r: 'changes' } });
};
