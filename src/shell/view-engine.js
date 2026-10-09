/* ---------- filter engine ---------- */
import { DAY, TODAY, diffD, esc, parse } from '../core/utils.js';
import { ic } from '../core/icons.js';
import { LABELS, PR, PRIOS, STATUSES } from '../core/constants.js';
import {
  D,
  S,
  canSee,
  isOver,
  mem,
  pColor,
  proj,
  visibleProjects,
  REGULATION_DOMAINS,
  REGULATION_TIERS,
  REGULATION_AUTHORITIES,
  REGULATION_STATUSES,
  REGULATION_ERAS,
} from '../core/store.js';
import { av, prIcon, stIcon } from '../ui/helpers.js';

export const FIELDS = {
  status: { name: 'Status', icon: 'circle-dot', opts: () => STATUSES.map(s => ({ id: s.id, name: s.name, html: stIcon(s.id) })) },
  assignee: {
    name: 'Assignee',
    icon: 'user',
    opts: () => [
      { id: 'none', name: 'Unassigned', html: av(null, 'sm', false) },
      ...D().members.map(m => ({ id: m.id, name: m.name + (m.id === D().me ? ' (you)' : ''), html: av(m.id, 'sm', false) })),
    ],
  },
  priority: { name: 'Priority', icon: 'signal-high', opts: () => PRIOS.map(p => ({ id: p.id, name: p.name, html: prIcon(p.id) })) },
  due: {
    name: 'Due date',
    icon: 'calendar',
    opts: () => [
      { id: 'overdue', name: 'Overdue' },
      { id: 'today', name: 'Today' },
      { id: 'week', name: 'Next 7 days' },
      { id: 'later', name: 'Later' },
      { id: 'nodate', name: 'No due date' },
    ],
  },
  project: {
    name: 'Project',
    icon: 'folder',
    opts: () =>
      visibleProjects()
        .filter(canSee)
        .map(p => ({ id: p.id, name: p.name, html: `<span class="pdot" style="--c:${pColor(p)}"></span>` })),
  },
  labels: { name: 'Labels', icon: 'tag', opts: () => LABELS.map(l => ({ id: l.id, name: l.name, html: `<span class="pdot" style="--c:${l.c}"></span>` })) },
  created: {
    name: 'Created date',
    icon: 'calendar-plus',
    opts: () => [
      { id: '1', name: 'Last 24 hours' },
      { id: '7', name: 'Last 7 days' },
      { id: '30', name: 'Last 30 days' },
    ],
  },
  updated: {
    name: 'Updated date',
    icon: 'history',
    opts: () => [
      { id: '1', name: 'Last 24 hours' },
      { id: '7', name: 'Last 7 days' },
      { id: '30', name: 'Last 30 days' },
    ],
  },
};
export const REG_FIELDS = {
  domain: {
    name: 'Sector',
    icon: 'briefcase',
    opts: () => REGULATION_DOMAINS.filter(d => d.id !== 'all').map(d => ({ id: d.id, name: d.label })),
  },
  tier: {
    name: 'Legal Tier',
    icon: 'layers',
    opts: () => REGULATION_TIERS.filter(t => t.id !== 'all').map(t => ({ id: t.id, name: t.label })),
  },
  authority: {
    name: 'Authority',
    icon: 'landmark',
    opts: () => REGULATION_AUTHORITIES.filter(a => a.id !== 'all').map(a => ({ id: a.id, name: a.label })),
  },
  status: {
    name: 'Status',
    icon: 'file-check',
    opts: () => REGULATION_STATUSES.filter(s => s.id !== 'all').map(s => ({ id: s.id, name: s.label })),
  },
  era: {
    name: 'Era',
    icon: 'calendar',
    opts: () => REGULATION_ERAS.filter(e => e.id !== 'all').map(e => ({ id: e.id, name: e.label })),
  },
};

export function viewOf(key) {
  if (!S.views[key])
    S.views[key] = {
      filters: [],
      sort: key === 'regulations' ? { f: 'relevance', dir: 1 } : { f: 'manual', dir: 1 },
      group: key === 'tasks' || key === 'mytasks' ? 'status' : 'status',
      q: '',
      hidden: ['start', 'created', 'deps'],
      colW: {},
      showDone: true,
    };
  // Sanitize legacy filters
  if (S.views[key].filters) {
    S.views[key].filters = S.views[key].filters.filter(f => f.f !== 'jurisdiction' && f.f !== 'gov');
  }
  return S.views[key];
}
export function matchF(t, f) {
  if (!f.v || !f.v.length) return true;
  let hit;
  if (f.f === 'labels') hit = f.v.some(v => t.labels.includes(v));
  else if (f.f === 'assignee') hit = f.v.includes(t.assignee || 'none');
  else if (f.f === 'due') {
    hit = f.v.some(v => {
      if (v === 'nodate') return !t.due;
      if (!t.due) return false;
      const n = diffD(parse(t.due), TODAY);
      return v === 'overdue' ? isOver(t) : v === 'today' ? n === 0 : v === 'week' ? n >= 0 && n <= 7 : n > 7;
    });
  } else if (f.f === 'created' || f.f === 'updated') {
    const ts = f.f === 'created' ? t.created : t.updated;
    hit = f.v.some(v => Date.now() - ts <= +v * DAY);
  } else hit = f.v.includes(t[f.f]);
  return f.op === 'not' ? !hit : hit;
}
export function applyView(ts, v) {
  let out = ts.filter(t => v.filters.every(f => matchF(t, f)));
  if (v.q) {
    const q = v.q.toLowerCase();
    out = out.filter(t => t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q));
  }
  return sortTasks(out, v.sort);
}
export function sortTasks(ts, s) {
  const d = s.dir || 1;
  const a = [...ts];
  const key =
    {
      manual: t => t.order,
      title: t => t.title.toLowerCase(),
      due: t => t.due || '9999',
      start: t => t.start || '9999',
      priority: t => -PR[t.priority || 'none'].w,
      status: t => STATUSES.findIndex(x => x.id === t.status),
      assignee: t => mem(t.assignee)?.name || 'zzz',
      created: t => -t.created,
      updated: t => -t.updated,
      estimate: t => t.estimate || 'zzz',
      project: t => proj(t.project)?.name,
    }[s.f] || (t => t.order);
  return a.sort((x, y) => {
    const p = key(x),
      q = key(y);
    return (p > q ? 1 : p < q ? -1 : 0) * d;
  });
}
export function groupTasks(ts, g) {
  if (g === 'none') return [{ key: 'all', name: 'All tasks', html: '', tasks: ts }];
  let groups;
  if (g === 'status') groups = STATUSES.map(s => ({ key: s.id, name: s.name, html: stIcon(s.id), set: { status: s.id } }));
  else if (g === 'priority') groups = PRIOS.map(p => ({ key: p.id, name: p.name, html: prIcon(p.id), set: { priority: p.id } }));
  else if (g === 'assignee')
    groups = [
      ...D().members.map(m => ({ key: m.id, name: m.name, html: av(m.id, 'sm', false), set: { assignee: m.id } })),
      { key: 'none', name: 'Unassigned', html: av(null, 'sm', false), set: { assignee: null } },
    ];
  else if (g === 'project')
    groups = visibleProjects()
      .filter(canSee)
      .map(p => ({ key: p.id, name: p.name, html: `<span class="pdot" style="--c:${pColor(p)}"></span>`, set: { project: p.id } }));
  else if (g === 'due')
    groups = [
      { key: 'overdue', name: 'Overdue' },
      { key: 'today', name: 'Today' },
      { key: 'week', name: 'Next 7 days' },
      { key: 'later', name: 'Later' },
      { key: 'nodate', name: 'No due date' },
    ].map(x => ({ ...x, html: ic('calendar', 14) }));
  groups.forEach(G => {
    G.tasks = ts.filter(t => {
      if (g === 'assignee') return (t.assignee || 'none') === G.key;
      if (g === 'due') return matchF(t, { f: 'due', op: 'is', v: [G.key] });
      return t[g] === G.key;
    });
  });
  return g === 'status' || g === 'priority' ? groups : groups.filter(G => G.tasks.length);
}
export function filterChips(key) {
  const v = viewOf(key);
  if (!v.filters.length) return '';
  const fields = key === 'regulations' ? REG_FIELDS : FIELDS;
  const chips = v.filters
    .map((f, i) => {
      const F = fields[f.f] || FIELDS[f.f];
      if (!F) return '';
      const opts = F.opts();
      const names = f.v.map(id => opts.find(o => o.id === id)?.name || id);
      const val = names.length ? (names.length > 2 ? `${names.length} selected` : names.join(', ')) : 'any';
      return `${i ? '<span>and</span>' : ''}<span class="chip"><button data-a="pop" data-pop="fvals" data-key="${key}" data-i="${i}" style="display:inline-flex;gap:5px;align-items:center">${ic(F.icon, 12)}<b>${F.name}</b> ${f.op === 'not' ? 'is not' : 'is'} <span>${esc(val)}</span></button><button class="ibtn" data-a="rmFilter" data-key="${key}" data-i="${i}" aria-label="Remove filter">${ic('x', 12)}</button></span>`;
    })
    .join('');
  return `<div class="chipsbar">${ic('list-filter', 13)}${chips}<button class="btn btn-sm btn-ghost" data-a="pop" data-pop="filter" data-key="${key}">${ic('plus', 12)}Add</button><span class="sp"></span><button class="btn btn-sm btn-ghost" data-a="clearFilters" data-key="${key}">Clear all</button></div>`;
}

export function viewToolbar(key, opt = {}) {
  const v = viewOf(key);
  const sortName =
    key === 'regulations'
      ? {
          relevance: 'Relevance',
          year_desc: 'Newest',
          year_asc: 'Oldest',
          title_asc: 'Title (A–Z)',
          sections_desc: 'Most Sections',
        }[v.sort.f] || 'Relevance'
      : {
          manual: 'Manual',
          title: 'Title',
          due: 'Due date',
          priority: 'Priority',
          status: 'Status',
          created: 'Created',
          updated: 'Updated',
          assignee: 'Assignee',
          start: 'Start date',
          estimate: 'Estimate',
          project: 'Project',
        }[v.sort.f] || 'Manual';
  const searchPlaceholder = opt.placeholder || (key === 'regulations' ? 'Search regulations…' : 'Search tasks');
  return `<div class="toolbar" role="toolbar">
    <div class="inwrap">${ic('search', 13)}<input class="input search-sm" id="vq-${key}" data-in="viewQ" data-key="${key}" placeholder="${searchPlaceholder}" value="${esc(v.q)}" aria-label="${searchPlaceholder}">${v.q ? `<button class="pillbtn" data-a="clearViewQ" data-key="${key}" style="padding:2px 5px;position:absolute;right:6px;top:50%;transform:translateY(-50%)" aria-label="Clear search">${ic('x', 11)}</button>` : ''}</div>
    <button class="btn btn-ghost ${v.filters.length ? 'on' : ''}" data-a="pop" data-pop="filter" data-key="${key}">${ic('list-filter', 14)}Filter${v.filters.length ? ` <span class="badge accent" style="height:16px;padding:0 5px">${v.filters.length}</span>` : ''}</button>
    <button class="btn btn-ghost" data-a="pop" data-pop="sort" data-key="${key}">${ic('arrow-up-down', 14)}<span class="hide-m">Sort:</span> ${sortName}</button>
    ${opt.group !== false ? `<button class="btn btn-ghost" data-a="pop" data-pop="group" data-key="${key}">${ic('rows-3', 14)}<span class="hide-m">Group:</span> ${{ status: 'Status', priority: 'Priority', assignee: 'Assignee', project: 'Project', due: 'Due date', none: 'None' }[v.group]}</button>` : ''}
    ${opt.cols ? `<button class="btn btn-ghost" data-a="pop" data-pop="cols" data-key="${key}">${ic('columns-3', 14)}Columns</button>` : ''}
    ${opt.extra || ''}
    <span class="sp"></span>
    ${opt.right || ''}
  </div>${filterChips(key)}`;
}

export function matchRegFilter(item, f) {
  if (!f.v || !f.v.length) return true;
  let hit = false;
  if (f.f === 'domain') {
    hit = f.v.includes(item.regDomain);
  } else if (f.f === 'tier') {
    hit = f.v.includes(item.regTier);
  } else if (f.f === 'authority') {
    hit = f.v.includes(item.regAuth);
  } else if (f.f === 'status') {
    hit = f.v.some(val => {
      if (val === 'substantive') return !item.isRepeal;
      if (val === 'repeal') return item.isRepeal;
      if (val === 'amended') return item.hasAmended;
      return false;
    });
  } else if (f.f === 'era') {
    hit = f.v.some(val => {
      if (val === '2020s') return item.year >= 2020;
      if (val === '2010s') return item.year >= 2010 && item.year <= 2019;
      if (val === '2000s') return item.year >= 2000 && item.year <= 2009;
      if (val === '1990s') return item.year >= 1990 && item.year <= 1999;
      return false;
    });
  }
  return f.op === 'not' ? !hit : hit;
}

export function applyRegView(decorated, v, auth = 'all') {
  let out = decorated;
  if (auth && auth !== 'all') {
    out = out.filter(item => item.regAuth === auth);
  }
  if (v.filters && v.filters.length) {
    const activeFilters = v.filters.filter(f => f.f !== 'jurisdiction' && f.f !== 'gov');
    if (activeFilters.length) {
      out = out.filter(item => activeFilters.every(f => matchRegFilter(item, f)));
    }
  }
  if (v.q) {
    const q = v.q.toLowerCase().trim();
    out = out.filter(item => {
      const r = item.r;
      const matchCode = r.code && r.code.toLowerCase().includes(q);
      const matchTitle = r.title && r.title.toLowerCase().includes(q);
      const matchShort = r.shortTitle && r.shortTitle.toLowerCase().includes(q);
      const matchAuth = r.authority && r.authority.toLowerCase().includes(q);
      const matchSum = r.summary && r.summary.toLowerCase().includes(q);
      const matchJuris = r.jurisdiction && r.jurisdiction.toLowerCase().includes(q);
      const matchYear = String(item.year).includes(q);
      const matchTag = r.tags && r.tags.some(t => t.toLowerCase().includes(q));
      return matchCode || matchTitle || matchShort || matchAuth || matchSum || matchJuris || matchYear || matchTag;
    });
  }
  return sortRegulations(out, v.sort);
}

export function sortRegulations(items, s = { f: 'relevance', dir: 1 }) {
  const f = s?.f || 'relevance';
  const d = s?.dir || 1;
  const a = [...items];
  return a.sort((x, y) => {
    let diff = 0;
    if (f === 'year_desc') {
      diff = y.year - x.year || x.r.code.localeCompare(y.r.code);
    } else if (f === 'year_asc') {
      diff = x.year - y.year || x.r.code.localeCompare(y.r.code);
    } else if (f === 'title_asc') {
      const tA = (x.r.shortTitle || x.r.title || x.r.code).toLowerCase();
      const tB = (y.r.shortTitle || y.r.title || y.r.code).toLowerCase();
      diff = tA.localeCompare(tB);
    } else if (f === 'sections_desc') {
      diff = y.secs.length - x.secs.length || y.year - x.year;
    } else {
      // relevance
      const score = item => {
        let sc = 0;
        if (item.hasAmended) sc += 2000;
        if (item.regTier === 'act') sc += 1000;
        else if (item.regTier === 'ordinance') sc += 400;
        if (!item.isRepeal) sc += 200;
        sc += item.year;
        sc += Math.min(item.secs.length, 50);
        return sc;
      };
      diff = score(y) - score(x);
    }
    return diff * (d < 0 && f !== 'relevance' ? -1 : 1);
  });
}
