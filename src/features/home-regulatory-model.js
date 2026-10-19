import { getRegulationCountry, getRegulationDomain } from '../data/regulations.js';

export const HOME_MARKETS = ['Sweden', 'Finland', 'European Union'];
export const HOME_TOPICS = {
  banking: 'Banking & credit',
  securities: 'Securities & markets',
  funds: 'Funds',
  aml: 'Financial crime',
  ict: 'ICT & resilience',
  payments: 'Payments',
  insurance: 'Insurance & pensions',
  esg: 'Sustainability',
  general: 'General regulation',
};
export const DEFAULT_HOME_SCOPE = { markets: HOME_MARKETS, topics: ['banking', 'securities', 'funds', 'aml', 'ict', 'payments', 'general'] };
export function sourceDate(value) {
  const date = typeof value === 'string' ? value.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null;
}
const daysBetween = (date, now) => Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
const unique = values => [...new Set(values)];
const canonical = value =>
  String(value || '')
    .toLowerCase()
    .replace(/^reg-/, '');
export function normalizeHomeScope(scope = DEFAULT_HOME_SCOPE) {
  return {
    markets: unique((scope.markets || []).filter(v => HOME_MARKETS.includes(v))),
    topics: unique((scope.topics || []).filter(v => Object.hasOwn(HOME_TOPICS, v))),
  };
}
export function buildHomeBriefing({
  regulations,
  events,
  projects = [],
  policies = [],
  controls = [],
  scope = DEFAULT_HOME_SCOPE,
  now = new Date().toISOString().slice(0, 10),
}) {
  scope = normalizeHomeScope(scope);
  const byId = new Map();
  for (const reg of regulations) for (const id of [reg.id, reg.code]) if (id) byId.set(canonical(id), reg);
  const lookup = id => byId.get(canonical(id));
  const liveProjects = projects.filter(p => !p.archived);
  const livePolicies = policies.filter(p => p.status !== 'RETIRED');
  const liveControls = controls.filter(c => c.status !== 'RETIRED');
  const matchesSection = (record, reg) => (record.statuteSections || []).some(id => id === reg.id || id.startsWith(`${reg.id}_`) || id.includes(`_${reg.id}_`));
  const matchesProject = (project, reg) =>
    (project.regulationIds || []).includes(reg.id) ||
    (reg.code && new RegExp(`(^|[^\\w])${reg.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w:])`, 'i').test(project.name || ''));
  const contexts = new Map();
  function context(reg) {
    if (contexts.has(reg.id)) return contexts.get(reg.id);
    const base = lookup(reg.amendsId || reg.amends);
    const candidates = base ? [reg, base] : [reg];
    const linkedPolicies = livePolicies.filter(p => candidates.some(r => matchesSection(p, r)));
    const linkedControls = liveControls.filter(c => candidates.some(r => matchesSection(c, r)));
    const linkedProjects = liveProjects.filter(p => candidates.some(r => matchesProject(p, r)) || linkedPolicies.some(x => x.projectId === p.id));
    const country = getRegulationCountry(reg),
      topic = getRegulationDomain(base || reg);
    const linked = Boolean(linkedPolicies.length || linkedControls.length || linkedProjects.length);
    const profile = scope.markets.includes(country) && scope.topics.includes(topic);
    const result = {
      country,
      topic,
      linked,
      relevant: linked || profile,
      policies: linkedPolicies,
      controls: linkedControls,
      projects: linkedProjects,
      reason: linked
        ? 'Linked to workspace projects or governance records.'
        : `${country} · ${HOME_TOPICS[topic] || 'General regulation'} matches your monitoring scope.`,
    };
    contexts.set(reg.id, result);
    return result;
  }
  const groups = new Map(),
    additions = new Map();
  for (const event of events) {
    const reg = lookup(event.docId) || lookup(event.code);
    if (!reg) continue;
    const date = sourceDate(event.amendedDate);
    if (event.level === 'document' && event.status === 'ADDED') {
      const added = sourceDate(event.fetchedAt),
        previous = additions.get(reg.id);
      // First recorded import is not a publication date or an amendment.
      if (added && (!previous || added < previous.added))
        additions.set(reg.id, {
          key: `library:${reg.id}`,
          kind: 'library',
          reg,
          added,
          date: sourceDate(reg.effectiveDate) || sourceDate(reg.inForce),
          context: context(reg),
          events: [],
        });
      continue;
    }
    const key = JSON.stringify([reg.id, event.amendingAct || '', date]);
    if (!groups.has(key)) groups.set(key, { key, kind: 'change', reg, date, amendingAct: event.amendingAct || '', context: context(reg), events: [] });
    const group = groups.get(key);
    if (!group.events.some(e => String(e.id) === String(event.id))) group.events.push(event);
  }
  const changes = [...groups.values()].filter(g => g.context.relevant);
  for (const group of changes) {
    group.days = group.date ? daysBetween(group.date, now) : null;
    group.phase = group.days == null ? 'undated' : group.days > 0 ? 'upcoming' : group.days >= -90 ? 'recent' : 'earlier';
  }
  changes.sort((a, b) => {
    const rank = g => (g.phase === 'upcoming' && g.days <= 90 ? 0 : g.phase === 'recent' ? 1 : g.phase === 'upcoming' ? 2 : g.phase === 'undated' ? 3 : 4);
    return (
      rank(a) - rank(b) ||
      (a.phase === 'upcoming' && b.phase === 'upcoming' ? a.date.localeCompare(b.date) : (b.date || '').localeCompare(a.date || '')) ||
      a.key.localeCompare(b.key)
    );
  });
  const newRegulations = regulations
    .filter(r => !r.amendsId && !r.amends && !/\bom (?:ändring|upphävande)\b|^(?:amending|repealing)\b/i.test(r.title || ''))
    .map(reg => ({
      key: `new:${reg.id}`,
      kind: 'new',
      reg,
      date: sourceDate(reg.effectiveDate) || sourceDate(reg.inForce),
      issueDate: sourceDate(reg.issueDate),
      context: context(reg),
      events: [],
    }))
    .filter(g => g.context.relevant && g.date && daysBetween(g.date, now) >= -365 && daysBetween(g.date, now) <= 365)
    .sort((a, b) => a.date.localeCompare(b.date));
  const library = [...additions.values()]
    .filter(g => g.context.relevant)
    .sort((a, b) => b.added.localeCompare(a.added) || a.reg.code.localeCompare(b.reg.code));
  const upcoming = [...changes.filter(g => g.phase === 'upcoming'), ...newRegulations.filter(g => g.date > now)].sort(
    (a, b) => a.date.localeCompare(b.date) || a.reg.code.localeCompare(b.reg.code),
  );
  return {
    changes,
    newRegulations,
    library,
    upcoming,
    scope,
    monitored: regulations.filter(r => context(r).relevant).length,
    latestFetch:
      events
        .map(e => sourceDate(e.fetchedAt))
        .filter(Boolean)
        .sort()
        .at(-1) || null,
    soon: upcoming.filter(g => daysBetween(g.date, now) <= 90).length,
    recent: changes.filter(g => g.phase === 'recent').length,
  };
}
export function filterHomeBriefing(briefing, { tab = 'changes', period = 'focus', query = '' } = {}) {
  const source = tab === 'new' ? briefing.newRegulations : tab === 'library' ? briefing.library : briefing.changes;
  const q = query.trim().toLowerCase();
  return source.filter(
    g =>
      (tab !== 'changes' || period === 'all' || (period === 'focus' ? ['upcoming', 'recent', 'undated'].includes(g.phase) : g.phase === period)) &&
      (!q || [g.reg.code, g.reg.title, g.amendingAct, g.context.country, HOME_TOPICS[g.context.topic]].join(' ').toLowerCase().includes(q)),
  );
}
