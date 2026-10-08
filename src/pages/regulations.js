/* ---------- REGULATIONS EXPLORER (Starting Screen: Grid Library -> 2nd Screen: Reader) ---------- */
import { esc } from '../core/utils.js';
import { ic } from '../core/icons.js';
import {
  S,
  REGULATIONS,
  allChaptersOf,
  allRegulations,
  allSectionsOf,
  regulation,
  policiesForSection,
  controlsForSection,
  risksForSection,
  allPolicies,
  allControls,
  allRisks,
  isControlImpacted,
  isPolicyImpacted,
  isSectionAmended,
  getRegulationYear,
  getRegulationDomain,
  getRegulationTier,
  getRegulationAuthority,
  isRegulationRepeal,
  REGULATION_DOMAINS,
  REGULATION_TIERS,
  REGULATION_AUTHORITIES,
  REGULATION_GOV_SCOPES,
  REGULATION_STATUSES,
  REGULATION_ERAS,
  REGULATION_SORTS,
} from '../core/store.js';
import { empty } from '../ui/helpers.js';

export function pageRegulations() {
  const u = S.ui;
  // Starting screen is the clean Grid Library view; Reader view is opened on card selection
  if (u.regView === 'reader') {
    return renderRegulationsReader(u);
  }
  return renderRegulationsLibrary(u);
}

/* ============================================================
   1. STARTING SCREEN: REGULATIONS LIBRARY (GRID & LIST)
   ============================================================ */
function renderRegulationsLibrary(u) {
  const libQ = (u.regLibQ || '').toLowerCase().trim();
  const juris = u.regLibJuris || 'all'; // 'all', 'fi', 'se', 'eu'
  const domain = u.regLibDomain || 'all';
  const tier = u.regLibTier || 'all';
  const auth = u.regLibAuth || 'all';
  const gov = u.regLibGov || 'all';
  const status = u.regLibStatus || 'all';
  const era = u.regLibEra || 'all';
  const sort = u.regLibSort || 'relevance';
  const layout = u.regLibLayout || 'grid'; // 'grid' or 'list'

  const policies = allPolicies();
  const controls = allControls();
  const risks = allRisks();

  const polSecSet = new Set(policies.flatMap(p => p.statuteSections || []));
  const ctlSecSet = new Set(controls.flatMap(c => c.statuteSections || []));
  const rskSecSet = new Set(risks.flatMap(r => r.statuteSections || []));

  const allActs = allRegulations();
  const totalSections = allActs.reduce((sum, a) => sum + allSectionsOf(a).length, 0);
  const totalPoliciesCount = policies.length;
  const totalControlsCount = controls.length;

  // Decorate all acts with precomputed metadata for fast multi-dimensional evaluation
  const decorated = allActs.map(r => {
    const secs = allSectionsOf(r);
    const year = getRegulationYear(r);
    const regDomain = getRegulationDomain(r);
    const regTier = getRegulationTier(r);
    const regAuth = getRegulationAuthority(r);
    const isRepeal = isRegulationRepeal(r);
    const hasLinkedPolicies = secs.some(s => polSecSet.has(s.id));
    const hasLinkedControls = secs.some(s => ctlSecSet.has(s.id));
    const hasLinkedRisks = secs.some(s => rskSecSet.has(s.id));
    const hasAmended = secs.some(isSectionAmended);
    const linkedControlsCount = secs.reduce((acc, s) => acc + controlsForSection(s.id).length, 0);
    const linkedPoliciesCount = secs.reduce((acc, s) => acc + policiesForSection(s.id).length, 0);

    return {
      r,
      secs,
      year,
      regDomain,
      regTier,
      regAuth,
      isRepeal,
      hasLinkedPolicies,
      hasLinkedControls,
      hasLinkedRisks,
      hasAmended,
      linkedControlsCount,
      linkedPoliciesCount,
    };
  });

  // Base subset scoped by jurisdiction
  const jurisScoped = decorated.filter(item => {
    if (juris === 'fi' && !item.r.jurisdiction.includes('Finland')) return false;
    if (juris === 'se' && !item.r.jurisdiction.includes('Sweden')) return false;
    if (juris === 'eu' && !item.r.jurisdiction.includes('European Union')) return false;
    return true;
  });

  // Compute live match counts for current jurisdiction scope
  const domainCounts = {};
  const tierCounts = {};
  const authCounts = {};
  const govCounts = { all: jurisScoped.length, controls: 0, policies: 0, any_gov: 0, amended: 0 };
  const statusCounts = { all: jurisScoped.length, substantive: 0, repeal: 0 };
  const eraCounts = { all: jurisScoped.length, '2020s': 0, '2010s': 0, '2000s': 0, '1990s': 0 };

  jurisScoped.forEach(item => {
    domainCounts[item.regDomain] = (domainCounts[item.regDomain] || 0) + 1;
    tierCounts[item.regTier] = (tierCounts[item.regTier] || 0) + 1;
    authCounts[item.regAuth] = (authCounts[item.regAuth] || 0) + 1;
    if (item.hasLinkedControls) govCounts.controls++;
    if (item.hasLinkedPolicies) govCounts.policies++;
    if (item.hasLinkedControls || item.hasLinkedPolicies || item.hasLinkedRisks) govCounts.any_gov++;
    if (item.hasAmended) govCounts.amended++;
    if (item.isRepeal) statusCounts.repeal++;
    else statusCounts.substantive++;
    if (item.year >= 2020) eraCounts['2020s']++;
    else if (item.year >= 2010) eraCounts['2010s']++;
    else if (item.year >= 2000) eraCounts['2000s']++;
    else if (item.year >= 1990) eraCounts['1990s']++;
  });

  // Multi-dimensional filtering
  const filtered = jurisScoped.filter(item => {
    const { r, year, regDomain, regTier, regAuth, isRepeal, hasLinkedControls, hasLinkedPolicies, hasLinkedRisks, hasAmended } = item;

    // Sector / domain
    if (domain !== 'all' && regDomain !== domain) return false;

    // Legal tier
    if (tier !== 'all' && regTier !== tier) return false;

    // Supervisory authority
    if (auth !== 'all' && regAuth !== auth) return false;

    // Governance linkage
    if (gov === 'controls' && !hasLinkedControls) return false;
    if (gov === 'policies' && !hasLinkedPolicies) return false;
    if (gov === 'any_gov' && !hasLinkedControls && !hasLinkedPolicies && !hasLinkedRisks) return false;
    if (gov === 'amended' && !hasAmended) return false;

    // Rule status
    if (status === 'substantive' && isRepeal) return false;
    if (status === 'repeal' && !isRepeal) return false;

    // Era / Year range
    if (era === '2020s' && year < 2020) return false;
    if (era === '2010s' && (year < 2010 || year > 2019)) return false;
    if (era === '2000s' && (year < 2000 || year > 2009)) return false;
    if (era === '1990s' && (year < 1990 || year > 1999)) return false;

    // Free-text search query
    if (libQ) {
      const matchCode = r.code && r.code.toLowerCase().includes(libQ);
      const matchTitle = r.title && r.title.toLowerCase().includes(libQ);
      const matchShort = r.shortTitle && r.shortTitle.toLowerCase().includes(libQ);
      const matchAuth = r.authority && r.authority.toLowerCase().includes(libQ);
      const matchSum = r.summary && r.summary.toLowerCase().includes(libQ);
      const matchJuris = r.jurisdiction && r.jurisdiction.toLowerCase().includes(libQ);
      const matchYear = String(year).includes(libQ);
      const matchTag = r.tags && r.tags.some(t => t.toLowerCase().includes(libQ));
      if (!matchCode && !matchTitle && !matchShort && !matchAuth && !matchSum && !matchJuris && !matchYear && !matchTag) {
        return false;
      }
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sort === 'year_desc') {
      return b.year - a.year || a.r.code.localeCompare(b.r.code);
    }
    if (sort === 'year_asc') {
      return a.year - b.year || a.r.code.localeCompare(b.r.code);
    }
    if (sort === 'title_asc') {
      const tA = (a.r.shortTitle || a.r.title || a.r.code).toLowerCase();
      const tB = (b.r.shortTitle || b.r.title || b.r.code).toLowerCase();
      return tA.localeCompare(tB);
    }
    if (sort === 'sections_desc') {
      return b.secs.length - a.secs.length || b.year - a.year;
    }
    // Default: 'relevance' (governance linked + core acts first, then newest)
    const score = item => {
      let s = 0;
      if (item.linkedControlsCount > 0 || item.linkedPoliciesCount > 0) s += 10000;
      if (item.hasAmended) s += 2000;
      if (item.regTier === 'act' || item.regTier === 'eu') s += 1000;
      else if (item.regTier === 'ordinance') s += 400;
      if (!item.isRepeal) s += 200;
      s += item.year;
      s += Math.min(item.secs.length, 50);
      return s;
    };
    return score(b) - score(a);
  });

  const hasActiveFilters =
    Boolean(libQ) ||
    juris !== 'all' ||
    domain !== 'all' ||
    tier !== 'all' ||
    auth !== 'all' ||
    gov !== 'all' ||
    status !== 'all' ||
    era !== 'all' ||
    sort !== 'relevance';

  // Build active filter tags
  const activePills = [];
  if (libQ) {
    activePills.push({ label: `Query: "${libQ}"`, key: 'regLibQ' });
  }
  if (juris !== 'all') {
    const jName = juris === 'fi' ? 'Finland' : juris === 'se' ? 'Sweden' : 'European Union';
    activePills.push({ label: `Jurisdiction: ${jName}`, key: 'regLibJuris' });
  }
  if (domain !== 'all') {
    const dObj = REGULATION_DOMAINS.find(d => d.id === domain);
    activePills.push({ label: `Sector: ${dObj ? dObj.label : domain}`, key: 'regLibDomain' });
  }
  if (tier !== 'all') {
    const tObj = REGULATION_TIERS.find(t => t.id === tier);
    activePills.push({ label: `Tier: ${tObj ? tObj.label : tier}`, key: 'regLibTier' });
  }
  if (auth !== 'all') {
    const aObj = REGULATION_AUTHORITIES.find(a => a.id === auth);
    activePills.push({ label: `Authority: ${aObj ? aObj.label : auth}`, key: 'regLibAuth' });
  }
  if (gov !== 'all') {
    const gObj = REGULATION_GOV_SCOPES.find(g => g.id === gov);
    activePills.push({ label: `Governance: ${gObj ? gObj.label : gov}`, key: 'regLibGov' });
  }
  if (status !== 'all') {
    const sObj = REGULATION_STATUSES.find(s => s.id === status);
    activePills.push({ label: `Status: ${sObj ? sObj.label : status}`, key: 'regLibStatus' });
  }
  if (era !== 'all') {
    const eObj = REGULATION_ERAS.find(e => e.id === era);
    activePills.push({ label: `Era: ${eObj ? eObj.label : era}`, key: 'regLibEra' });
  }
  if (sort !== 'relevance') {
    const srtObj = REGULATION_SORTS.find(s => s.id === sort);
    activePills.push({ label: `Sort: ${srtObj ? srtObj.label : sort}`, key: 'regLibSort' });
  }

  let body;
  if (!allActs.length) {
    body = `<div class="panel">${empty('scale', 'No regulations found', 'No statutory regulations in the library.')}</div>`;
  } else if (!filtered.length) {
    body = `<div class="panel">${empty(
      'search-x',
      'No matching regulations found',
      'Try adjusting your search query, sector, document type, or active filters.',
      `<button class="btn btn-secondary btn-sm" data-a="clearRegLibFilters">${ic('rotate-ccw', 13)} Reset all filters</button>`,
    )}</div>`;
  } else if (layout === 'list') {
    body = `<div class="panel" style="overflow-x:auto">${renderRegulationsList(filtered)}</div>`;
  } else {
    body = renderRegulationsGrid(filtered);
  }

  return `<div class="page wide">
    <div class="ph">
      <div>
        <h1>Regulations Library</h1>
        <p>Nordic financial statutory library and EU directives</p>
      </div>
      <div class="acts">
        <div class="seg" role="tablist">
          <button class="${layout !== 'list' ? 'on' : ''}" data-a="set" data-k="regLibLayout" data-v="grid" title="Cards view">${ic('layout-grid', 14)} Cards</button>
          <button class="${layout === 'list' ? 'on' : ''}" data-a="set" data-k="regLibLayout" data-v="list" title="List view">${ic('list', 14)} List</button>
        </div>
      </div>
    </div>

    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><span class="k">Statutes</span><span class="v">${allActs.length}</span><span class="d">Nordic & EU directives</span></div>
      <div class="stat"><span class="k">Statutory Sections</span><span class="v">${totalSections}</span><span class="d">indexed legal provisions</span></div>
      <div class="stat"><span class="k">Governing Policies</span><span class="v">${totalPoliciesCount}</span><span class="d">linked compliance standards</span></div>
      <div class="stat"><span class="k">Enforcing Controls</span><span class="v">${totalControlsCount}</span><span class="d">operational safeguards</span></div>
    </div>

    <!-- Multi-Dimensional Filter Toolbar -->
    <div class="finlex-filter-toolbar">
      <!-- Search & Primary Jurisdiction Row -->
      <div class="finlex-filter-main-row">
        <div class="inwrap" style="flex:1;min-width:280px">
          ${ic('search', 13)}
          <input class="input search-sm" id="reg-lib-q" data-in="regLibQ" placeholder="Search regulations by title, code, topic, or year (e.g. 747/2012, DORA, 2024)..." value="${esc(u.regLibQ || '')}" aria-label="Search regulations">
          ${u.regLibQ ? `<button class="pillbtn" data-a="clearRegLibQ" style="padding:2px 6px">${ic('x', 12)}Clear</button>` : ''}
        </div>
        <div class="seg" role="tablist">
          <button class="${juris === 'all' ? 'on' : ''}" data-a="set" data-k="regLibJuris" data-v="all">All (${allActs.length})</button>
          <button class="${juris === 'fi' ? 'on' : ''}" data-a="set" data-k="regLibJuris" data-v="fi">Finland</button>
          <button class="${juris === 'se' ? 'on' : ''}" data-a="set" data-k="regLibJuris" data-v="se">Sweden</button>
          <button class="${juris === 'eu' ? 'on' : ''}" data-a="set" data-k="regLibJuris" data-v="eu">European Union</button>
        </div>
      </div>

      <!-- Secondary Multi-dimensional Selects Grid -->
      <div class="finlex-filter-controls-row">
        <!-- Sector / Domain -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-domain">${ic('briefcase', 11)} Sector</label>
          <select id="reg-filter-domain" class="finlex-filter-select ${domain !== 'all' ? 'is-active' : ''}" data-in="regLibDomain">
            ${REGULATION_DOMAINS.map(d => `<option value="${d.id}" ${domain === d.id ? 'selected' : ''}>${esc(d.label)}${d.id === 'all' ? ` (${jurisScoped.length})` : domainCounts[d.id] ? ` (${domainCounts[d.id]})` : ' (0)'}</option>`).join('')}
          </select>
        </div>

        <!-- Document Type / Legal Tier -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-tier">${ic('layers', 11)} Legal Tier</label>
          <select id="reg-filter-tier" class="finlex-filter-select ${tier !== 'all' ? 'is-active' : ''}" data-in="regLibTier">
            ${REGULATION_TIERS.map(t => `<option value="${t.id}" ${tier === t.id ? 'selected' : ''}>${esc(t.label)}${t.id === 'all' ? ` (${jurisScoped.length})` : tierCounts[t.id] ? ` (${tierCounts[t.id]})` : ' (0)'}</option>`).join('')}
          </select>
        </div>

        <!-- Supervisory Authority -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-auth">${ic('landmark', 11)} Authority</label>
          <select id="reg-filter-auth" class="finlex-filter-select ${auth !== 'all' ? 'is-active' : ''}" data-in="regLibAuth">
            ${REGULATION_AUTHORITIES.map(a => `<option value="${a.id}" ${auth === a.id ? 'selected' : ''}>${esc(a.label)}${a.id === 'all' ? ` (${jurisScoped.length})` : authCounts[a.id] ? ` (${authCounts[a.id]})` : ' (0)'}</option>`).join('')}
          </select>
        </div>

        <!-- Governance Scope -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-gov">${ic('shield-check', 11)} Governance</label>
          <select id="reg-filter-gov" class="finlex-filter-select ${gov !== 'all' ? 'is-active' : ''}" data-in="regLibGov">
            ${REGULATION_GOV_SCOPES.map(g => `<option value="${g.id}" ${gov === g.id ? 'selected' : ''}>${esc(g.label)}${g.id === 'all' ? ` (${jurisScoped.length})` : ` (${govCounts[g.id] || 0})`}</option>`).join('')}
          </select>
        </div>

        <!-- Rule Status -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-status">${ic('file-check', 11)} Status</label>
          <select id="reg-filter-status" class="finlex-filter-select ${status !== 'all' ? 'is-active' : ''}" data-in="regLibStatus">
            ${REGULATION_STATUSES.map(s => `<option value="${s.id}" ${status === s.id ? 'selected' : ''}>${esc(s.label)}${s.id === 'all' ? ` (${jurisScoped.length})` : ` (${statusCounts[s.id] || 0})`}</option>`).join('')}
          </select>
        </div>

        <!-- Era / Year Range -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-era">${ic('calendar', 11)} Era</label>
          <select id="reg-filter-era" class="finlex-filter-select ${era !== 'all' ? 'is-active' : ''}" data-in="regLibEra">
            ${REGULATION_ERAS.map(e => `<option value="${e.id}" ${era === e.id ? 'selected' : ''}>${esc(e.label)}${e.id === 'all' ? ` (${jurisScoped.length})` : ` (${eraCounts[e.id] || 0})`}</option>`).join('')}
          </select>
        </div>

        <!-- Sort Order -->
        <div class="finlex-filter-field">
          <label class="finlex-filter-field-label" for="reg-filter-sort">${ic('arrow-down-up', 11)} Sort By</label>
          <select id="reg-filter-sort" class="finlex-filter-select ${sort !== 'relevance' ? 'is-active' : ''}" data-in="regLibSort">
            ${REGULATION_SORTS.map(s => `<option value="${s.id}" ${sort === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Quick Fast-Filter Chips -->
      <div class="finlex-quick-strip">
        <span class="finlex-quick-label">Quick:</span>
        <button class="finlex-quick-chip ${domain === 'all' && tier === 'all' && gov === 'all' && status === 'all' ? 'on' : ''}" data-a="clearRegLibFilters">All</button>
        <button class="finlex-quick-chip ${tier === 'act' ? 'on' : ''}" data-a="set" data-k="regLibTier" data-v="${tier === 'act' ? 'all' : 'act'}">Acts & Statutes <span class="chip-cnt">(${tierCounts.act || 0})</span></button>
        <button class="finlex-quick-chip ${gov === 'controls' ? 'on' : ''}" data-a="set" data-k="regLibGov" data-v="${gov === 'controls' ? 'all' : 'controls'}">With Controls <span class="chip-cnt">(${govCounts.controls || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'securities' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'securities' ? 'all' : 'securities'}">Securities <span class="chip-cnt">(${domainCounts.securities || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'banking' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'banking' ? 'all' : 'banking'}">Banking <span class="chip-cnt">(${domainCounts.banking || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'funds' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'funds' ? 'all' : 'funds'}">Funds <span class="chip-cnt">(${domainCounts.funds || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'aml' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'aml' ? 'all' : 'aml'}">AML <span class="chip-cnt">(${domainCounts.aml || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'ict' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'ict' ? 'all' : 'ict'}">DORA / ICT <span class="chip-cnt">(${domainCounts.ict || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'insurance' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'insurance' ? 'all' : 'insurance'}">Insurance <span class="chip-cnt">(${domainCounts.insurance || 0})</span></button>
        <button class="finlex-quick-chip ${domain === 'payments' ? 'on' : ''}" data-a="set" data-k="regLibDomain" data-v="${domain === 'payments' ? 'all' : 'payments'}">Payments <span class="chip-cnt">(${domainCounts.payments || 0})</span></button>
        <button class="finlex-quick-chip ${status === 'substantive' ? 'on' : ''}" data-a="set" data-k="regLibStatus" data-v="${status === 'substantive' ? 'all' : 'substantive'}">Substantive Only <span class="chip-cnt">(${statusCounts.substantive || 0})</span></button>
      </div>

      <!-- Active Filters Strip & Results Counter -->
      ${
        hasActiveFilters
          ? `<div class="finlex-active-bar">
        <div class="finlex-active-list">
          <span class="finlex-count-text">Showing <b>${filtered.length}</b> of <b>${allActs.length}</b> regulations</span>
          ${activePills
            .map(
              p => `<span class="finlex-active-pill">
            <span>${esc(p.label)}</span>
            <button class="finlex-active-pill-remove" data-a="removeRegLibFilter" data-k="${p.key}" title="Remove filter">${ic('x', 11)}</button>
          </span>`,
            )
            .join('')}
        </div>
        <button class="btn btn-secondary btn-sm" data-a="clearRegLibFilters" style="padding:2px 8px;font-size:11.5px">
          ${ic('rotate-ccw', 12)} Clear all filters
        </button>
      </div>`
          : `<div class="finlex-active-bar">
        <span class="finlex-count-text">Showing <b>${filtered.length}</b> regulations</span>
      </div>`
      }
    </div>

    ${body}
  </div>`;
}

function renderRegulationsGrid(decoratedActs) {
  return `<div class="finlex-lib-grid">
    ${decoratedActs
      .map(item => {
        const { r, secs, year, regDomain, regTier, isRepeal, hasAmended, linkedControlsCount, linkedPoliciesCount } = item;
        const displayTitle = r.shortTitle && r.shortTitle !== r.code ? r.shortTitle : r.title;
        const domainObj = REGULATION_DOMAINS.find(d => d.id === regDomain);
        const tierObj = REGULATION_TIERS.find(t => t.id === regTier);
        const tierLabel = tierObj ? tierObj.label.replace('Parliamentary ', '').replace('Supervisory ', '').replace('Government ', '') : regTier;

        return `<article class="finlex-lib-card" data-a="openRegInReader" data-id="${r.id}" title="Open regulation in reader">
        <div class="finlex-lib-card-top">
          <div class="row" style="gap:6px;align-items:center">
            <span class="finlex-jurisdiction-tag">${esc(r.jurisdiction)}</span>
            <span class="finlex-tier-badge ${regTier}">${esc(tierLabel)}</span>
          </div>
          <span class="finlex-code-badge">${esc(r.code)}</span>
        </div>

        <div>
          <h2 class="finlex-lib-card-title">${esc(displayTitle)}</h2>
          ${r.shortTitle && r.shortTitle !== r.code && r.title && r.title !== r.shortTitle ? `<div class="faint trunc" style="font-size:11.5px;margin-top:2px" title="${esc(r.title)}">${esc(r.title)}</div>` : ''}
        </div>

        <p class="finlex-lib-card-desc">${esc(r.summary)}</p>

        <div class="finlex-lib-card-meta">
          <span class="finlex-domain-badge">${esc(domainObj ? domainObj.label : regDomain)}</span>
          <span>·</span>
          <span>${esc(r.authority)}</span>
          <span>·</span>
          <span>${year || esc(r.inForce || 'In force')}</span>
          <span>·</span>
          <span>${secs.length} sections</span>
          ${isRepeal ? `<span class="finlex-repeal-badge">Repeal</span>` : ''}
          ${hasAmended ? `<span class="pill" style="font-size:10px;background:var(--amber-soft);color:var(--amber);border-color:var(--amber)">Amended</span>` : ''}
          ${linkedControlsCount ? `<span class="finlex-gov-badge" title="${linkedControlsCount} linked controls">${ic('shield-check', 11)} ${linkedControlsCount} ${linkedControlsCount === 1 ? 'control' : 'controls'}</span>` : ''}
          ${linkedPoliciesCount ? `<span class="finlex-gov-badge" title="${linkedPoliciesCount} linked policies">${ic('file-text', 11)} ${linkedPoliciesCount} ${linkedPoliciesCount === 1 ? 'policy' : 'policies'}</span>` : ''}
        </div>

        ${
          r.tags && r.tags.length
            ? `<div class="finlex-lib-card-foot">
          <div class="row" style="gap:4px;flex-wrap:wrap">
            ${r.tags
              .slice(0, 3)
              .map(t => `<span class="pill" style="font-size:10.5px;padding:1px 6px">${esc(t)}</span>`)
              .join('')}
          </div>
        </div>`
            : ''
        }
      </article>`;
      })
      .join('')}
  </div>`;
}

function renderRegulationsList(decoratedActs) {
  return `<table class="finlex-lib-table">
      <thead>
        <tr>
          <th style="width:320px">Regulation & Title</th>
          <th>Sector</th>
          <th>Legal Tier</th>
          <th>Authority</th>
          <th>In Force</th>
          <th>Governance</th>
          <th>Sections</th>
        </tr>
      </thead>
      <tbody>
        ${decoratedActs
          .map(item => {
            const { r, secs, year, regDomain, regTier, isRepeal, hasAmended, linkedControlsCount, linkedPoliciesCount } = item;
            const displayTitle = r.shortTitle && r.shortTitle !== r.code ? r.shortTitle : r.title;
            const domainObj = REGULATION_DOMAINS.find(d => d.id === regDomain);
            const tierObj = REGULATION_TIERS.find(t => t.id === regTier);
            const tierLabel = tierObj ? tierObj.label.replace('Parliamentary ', '').replace('Supervisory ', '').replace('Government ', '') : regTier;

            return `<tr data-a="openRegInReader" data-id="${r.id}" title="Open ${esc(r.code)}">
            <td>
              <div style="font-weight:700;display:flex;align-items:center;gap:6px">
                <span class="mono" style="font-size:11.5px;background:var(--surface-3);padding:1px 5px;border-radius:3px">${esc(r.code)}</span>
                <span class="trunc" style="max-width:260px">${esc(displayTitle)}</span>
              </div>
            </td>
            <td><span class="finlex-domain-badge">${esc(domainObj ? domainObj.label : regDomain)}</span></td>
            <td><span class="finlex-tier-badge ${regTier}">${esc(tierLabel)}</span></td>
            <td><span style="font-size:12px;font-weight:500">${esc(r.authority)}</span></td>
            <td><span class="mono faint" style="font-size:11.5px">${year || esc(r.inForce || 'In force')}</span></td>
            <td>
              <div class="row" style="gap:4px;align-items:center">
                ${linkedControlsCount ? `<span class="finlex-gov-badge">${ic('shield-check', 11)} ${linkedControlsCount}</span>` : ''}
                ${linkedPoliciesCount ? `<span class="finlex-gov-badge">${ic('file-text', 11)} ${linkedPoliciesCount}</span>` : ''}
                ${hasAmended ? `<span class="pill" style="font-size:10px;background:var(--amber-soft);color:var(--amber)">Amended</span>` : ''}
                ${isRepeal ? `<span class="finlex-repeal-badge">Repeal</span>` : ''}
                ${!linkedControlsCount && !linkedPoliciesCount && !hasAmended && !isRepeal ? `<span class="faint" style="font-size:12px">—</span>` : ''}
              </div>
            </td>
            <td><span style="font-size:12px">${secs.length}</span></td>
          </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;
}

/* ============================================================
   2. SECOND SCREEN: FINLEX DOCUMENT READER VIEW
   ============================================================ */
function renderRegulationsReader(u) {
  const selActId = u.regSel || 'reg-finlex-747-2012';
  const curAct = regulation(selActId) || REGULATIONS[0];
  const q = (u.regQ || '').toLowerCase().trim();
  const showPlain = u.regPlain !== false;

  const allSecs = allSectionsOf(curAct);
  const activeSecId = u.regSec || (allSecs[0] ? allSecs[0].id : null);
  const chapters = allChaptersOf(curAct);

  return `<div class="page flush">
    <div class="finlex-container">

      <!-- LEFT SIDEBAR: Finlex Sisällysluettelo (TOC) -->
      <aside class="finlex-toc" aria-label="Table of Contents">
        <div class="finlex-toc-top">
          <!-- Back to Library Button -->
          <button class="finlex-toc-back-btn" data-a="setRegView" data-view="library" title="Back to regulations library">
            ${ic('arrow-left', 13)}
            <span>Back to Regulations</span>
          </button>

          <!-- Current Act Title in Sidebar -->
          <div class="finlex-toc-act-label">
            <span class="mono" style="font-size:11px;color:var(--text-3)">${esc(curAct.code)}</span>
            <span class="trunc" style="font-weight:700;font-size:13px;color:var(--text)">${esc(curAct.shortTitle || curAct.title)}</span>
          </div>

          <!-- Sisällysluettelo Title -->
          <div class="finlex-toc-hdr-row">
            <h2 class="finlex-toc-title">
              ${ic('book-open', 13)}
              <span>Table of Contents</span>
            </h2>
          </div>

          <!-- Section Search -->
          <div class="inwrap finlex-toc-search">
            ${ic('search', 13)}
            <input class="input search-sm" id="reg-toc-q" data-in="regQ" placeholder="Search sections..." value="${esc(u.regQ || '')}" aria-label="Search sections">
          </div>
        </div>

        <!-- TOC Hierarchical Tree -->
        <div class="finlex-toc-tree" data-keep="finlex-tree">
          ${!allSecs.length ? `<div style="padding:16px;font-size:12px;color:var(--text-3);text-align:center">No chapters indexed</div>` : renderFinlexTree(curAct, chapters, activeSecId, q)}
        </div>
      </aside>

      <!-- RIGHT MAIN CONTENT: Finlex Document Reader -->
      <main class="finlex-reader" id="finlex-doc-content" tabindex="-1">
        <div class="finlex-reader-inner">

          <!-- Act Document Header -->
          <header class="finlex-doc-head">
            <div class="finlex-doc-act-no">${esc(curAct.jurisdiction)} · ${esc(curAct.code)}</div>
            <h1 class="finlex-doc-title">${esc(curAct.shortTitle || curAct.title)}</h1>
            <div class="finlex-doc-meta">
              <span>In force: <b>${esc(curAct.inForce || 'In force')}</b></span>
              <span>·</span>
              <span>Supervisory authority: <b>${esc(curAct.authority)}</b></span>
              ${curAct.amendedBy ? `<span>·</span><span>Amended by: <b>${esc(curAct.amendedBy)}</b></span>` : ''}
            </div>
          </header>

          <!-- Simple Toolbar: Plain English Toggle & Clear Search -->
          <div class="finlex-toolbar">
            <button class="btn btn-sm ${showPlain ? 'btn-primary' : 'btn-ghost'}" data-a="toggleRegPlain" title="Toggle Plain English summary">
              ${ic('sparkles', 13)}
              <span>Plain English</span>
            </button>
            <span class="sp"></span>
            ${
              q
                ? `<button class="pillbtn" data-a="set" data-k="regQ" data-v="" style="font-size:11.5px">
                    ${ic('x', 12)}Clear search
                  </button>`
                : ''
            }
          </div>

          <!-- Statutory Sections Stream -->
          <div class="finlex-sections-stream">
            ${
              !allSecs.length
                ? `<div class="panel" style="margin-top:20px;padding:36px 24px;text-align:center">
                    <div style="max-width:500px;margin:0 auto">
                      <div style="font-size:14px;font-weight:600;margin-bottom:8px">No section provisions indexed for this rule</div>
                      <p class="faint" style="font-size:13px;line-height:1.5;margin-bottom:16px">${esc(curAct.summary || 'This regulation is registered in the supervisory database without individual section breakdowns.')}</p>
                      <button class="btn btn-secondary btn-sm" data-a="setRegView" data-view="library">${ic('arrow-left', 13)} Back to Regulations</button>
                    </div>
                  </div>`
                : renderFinlexSections(chapters, activeSecId, showPlain, q)
            }
          </div>
        </div>
      </main>

    </div>
  </div>`;
}

function renderFinlexTree(act, chapters, activeSecId, q) {
  let lastPart = null;

  return chapters
    .map(ch => {
      let partHtml = '';
      if (ch.partTitle && ch.partTitle !== lastPart) {
        lastPart = ch.partTitle;
        partHtml = `<div class="finlex-tree-part">
          ${ic('chevron-down', 11)}
          <span>${esc(ch.partNumber ? ch.partNumber + ' - ' : '')}${esc(ch.partTitle)}</span>
        </div>`;
      }

      const matchingSecs = (ch.sections || []).filter(s => {
        if (!q) return true;
        return (
          s.number.toLowerCase().includes(q) ||
          s.heading.toLowerCase().includes(q) ||
          (s.headingEn && s.headingEn.toLowerCase().includes(q)) ||
          s.text.toLowerCase().includes(q) ||
          (s.textEn && s.textEn.toLowerCase().includes(q)) ||
          (s.plainEnglish && s.plainEnglish.summary.toLowerCase().includes(q))
        );
      });

      if (q && !matchingSecs.length) return '';

      const secItems = matchingSecs
        .map(s => {
          const isActive = s.id === activeSecId;
          const heading = s.headingEn || s.heading;
          return `<button class="finlex-tree-sec ${isActive ? 'active' : ''}" data-a="selectSec" data-id="${s.id}" title="${esc(s.number)} ${esc(heading)}">
          ${esc(s.number)} - ${esc(heading)}
        </button>`;
        })
        .join('');

      return `
        ${partHtml}
        <div class="finlex-tree-chap">
          ${ic('chevron-down', 11)}
          <span>${esc(ch.number)} - ${esc(ch.title)}</span>
        </div>
        ${secItems}
      `;
    })
    .join('');
}

function renderFinlexSections(chapters, activeSecId, showPlain, q) {
  return chapters
    .map(ch => {
      const matchingSecs = (ch.sections || []).filter(s => {
        if (!q) return true;
        return (
          s.number.toLowerCase().includes(q) ||
          s.heading.toLowerCase().includes(q) ||
          (s.headingEn && s.headingEn.toLowerCase().includes(q)) ||
          s.text.toLowerCase().includes(q) ||
          (s.textEn && s.textEn.toLowerCase().includes(q)) ||
          (s.plainEnglish && s.plainEnglish.summary.toLowerCase().includes(q))
        );
      });

      if (!matchingSecs.length) return '';

      return `
        <div class="finlex-chap-divider">
          <h3 class="finlex-chap-no">${esc(ch.number)}</h3>
          <h2 class="finlex-chap-name">${esc(ch.title)}</h2>
        </div>
        <div class="finlex-chap-body">
          ${matchingSecs.map(s => renderSectionBlock(s, activeSecId, showPlain)).join('')}
        </div>
      `;
    })
    .join('');
}

function renderSectionBlock(s, activeSecId, showPlain) {
  const isActive = s.id === activeSecId;
  const textToShow = s.textEn || s.text;
  const headingToShow = s.headingEn || s.heading;

  return `<article class="finlex-sec ${isActive ? 'active' : ''}" id="sec-${s.id}">
    <!-- Section Citation & Heading -->
    <header class="finlex-sec-head">
      <div class="finlex-sec-cite">
        <span class="finlex-sec-num">${esc(s.number)}</span>
        ${s.amendingAct ? `<span class="finlex-sec-amendment">${esc(s.amendingAct)}</span>` : ''}
      </div>
      <h3 class="finlex-sec-title">${esc(headingToShow)}</h3>
    </header>

    <!-- PLAIN ENGLISH BOX (Clean, simple, no fancy colors) -->
    ${
      showPlain && s.plainEnglish
        ? `<div class="finlex-plain-box">
            <div class="finlex-plain-tag">${ic('sparkles', 11)} Plain English:</div>
            <p class="finlex-plain-summary">${esc(s.plainEnglish.summary)}</p>
            ${
              s.plainEnglish.points && s.plainEnglish.points.length
                ? `<ul class="finlex-plain-list">
                    ${s.plainEnglish.points.map(pt => `<li>${esc(pt)}</li>`).join('')}
                  </ul>`
                : ''
            }
          </div>`
        : ''
    }

    <!-- STATUTORY BODY TEXT -->
    <div class="finlex-body">
      ${formatFinlexBody(textToShow, s.status)}
    </div>

    <!-- GOVERNANCE & CONTROLS STRIP -->
    ${renderSectionGovernanceStrip(s)}

    <!-- CROSS REFERENCES -->
    ${
      s.crossRefs && s.crossRefs.length
        ? `<footer class="finlex-sec-foot">
            ${s.crossRefs
              .map(
                cr => `
              <button class="finlex-ref-chip" data-a="openRegInReader" data-id="${cr.regId}" title="Navigate to regulation">
                ${ic('link-2', 11)}Ref: ${esc(cr.label)}
              </button>
            `,
              )
              .join('')}
          </footer>`
        : ''
    }
  </article>`;
}

function renderSectionGovernanceStrip(s) {
  const pols = policiesForSection(s.id);
  const ctls = controlsForSection(s.id);
  const rsks = risksForSection(s.id);

  if (!pols.length && !ctls.length && !rsks.length && s.status !== 'MODIFIED' && s.status !== 'ADDED') return '';

  return `<div class="finlex-gov-strip">
    <div class="finlex-gov-row">
      <span class="finlex-gov-label">${ic('shield', 12)} Governance & Controls:</span>
      <div class="finlex-gov-chips">
        ${pols
          .map(
            p => `
          <button class="finlex-gov-chip ${isPolicyImpacted(p) ? 'alert' : ''}" data-a="openGovDrawer" data-type="policy" data-id="${p.id}" title="Open policy ${esc(p.code)}: ${esc(p.title)}">
            ${ic('file-text', 11)}
            <span class="mono">${esc(p.code)}</span>
          </button>
        `,
          )
          .join('')}
        ${ctls
          .map(c => {
            const impacted = isControlImpacted(c);
            return `
          <button class="finlex-gov-chip ${impacted ? 'alert' : ''}" data-a="openGovDrawer" data-type="control" data-id="${c.id}" title="Open control ${esc(c.code)}: ${esc(c.title)}">
            ${impacted ? ic('alert-triangle', 11) : ic('check', 11)}
            <span class="mono">${esc(c.code)}</span>
          </button>
        `;
          })
          .join('')}
        ${rsks
          .map(
            r => `
          <button class="finlex-gov-chip" data-a="openGovDrawer" data-type="risk" data-id="${r.id}" title="Regulatory risk: ${esc(r.title)}">
            ${ic('alert-octagon', 11)}
            <span class="mono">${esc(r.code)}</span>
          </button>
        `,
          )
          .join('')}
        <button class="finlex-gov-chip faint" data-a="pop" data-pop="linkControl" data-sec="${s.id}" title="Link control">
          ${ic('plus', 11)}
          <span>Link</span>
        </button>
      </div>
    </div>
  </div>`;
}

function formatFinlexBody(rawText, status) {
  if (!rawText) return '';

  // If section was newly added
  if (status === 'ADDED') {
    return `<span class="finlex-ins">${esc(rawText)}</span>`;
  }
  // If section was deleted
  if (status === 'DELETED') {
    return `<span class="finlex-del">${esc(rawText)}</span>`;
  }

  // Format paragraphs and list items cleanly
  return esc(rawText)
    .replace(/^([0-9]+\)\s.+)$/gm, '<span style="display:block;padding-left:18px">$1</span>')
    .replace(/^([a-z]\)\s.+)$/gm, '<span style="display:block;padding-left:36px">$1</span>');
}
