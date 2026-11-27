'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let STAFF = [], PUBS = [], GRANTS = [], SUPERVISION = [], CONSULTANCY = [];
let STAFF_BY_SLUG = new Map();
let SUMMARY = {};
const PAGE_SIZE = 50;
const pageState = { staff: 1, pubs: 1, grants: 1 };
const charts = new Map();

// Overview date filter state — YYYYMM integers, 0 = all time
let ovFromYM = 0, ovToYM = 0;

// Column sort state for tables
const tblSort = {
  pubs:   { key: null, dir: 1 },
  grants: { key: null, dir: 1 },
  staff:  { key: null, dir: 1 },
};
// pubTab / grantTab now driven by filter selects; kept as helpers
function getPubCat()   { const el = document.getElementById('pubs-filter-cat');   return el ? el.value : 'all'; }
function getPubType()  { const el = document.getElementById('pubs-filter-type');  return el ? el.value : 'all'; }
function getGrantRole(){ const el = document.getElementById('grants-filter-role'); return el ? el.value : 'pi'; }

// Apply column sort to a row array in-place
function applySort(rows, tbl) {
  const { key, dir } = tblSort[tbl];
  if (!key) return rows;
  return [...rows].sort((a, b) => {
    let av = a[key], bv = b[key];
    if (key === 'indexed') { av = a.indexed ? 1 : 0; bv = b.indexed ? 1 : 0; }
    if (key === 'cost')    { av = +(av||0); bv = +(bv||0); }
    if (typeof av === 'number' || typeof bv === 'number') return dir * ((+av||0) - (+bv||0));
    return dir * String(av||'').localeCompare(String(bv||''));
  });
}

// Update aria-sort on a thead after sort state changes
function updateSortHeaders(theadId, tbl) {
  const thead = document.getElementById(theadId); if (!thead) return;
  const { key, dir } = tblSort[tbl];
  thead.querySelectorAll('th.sortable').forEach(th => {
    const isActive = th.dataset.sort === key;
    th.setAttribute('aria-sort', isActive ? (dir === 1 ? 'ascending' : 'descending') : 'none');
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = isActive ? (dir === 1 ? '↑' : '↓') : '↕';
  });
}

// Click handler for sortable headers — returns a handler bound to tbl
function makeSortHandler(tbl, theadId, renderFn) {
  return e => {
    const th = e.target.closest('th.sortable'); if (!th) return;
    const key = th.dataset.sort;
    if (tblSort[tbl].key === key) tblSort[tbl].dir *= -1;
    else { tblSort[tbl].key = key; tblSort[tbl].dir = 1; }
    updateSortHeaders(theadId, tbl);
    renderFn();
  };
}

// Cross-filter state
const xf = {
  staff_hindex: null,   // { label, min, max }
  pubs_type:    null,   // 'indexed' | 'other'
  grants_key:   null,   // 'intl_active' | 'intl_completed' | 'natl_active' | 'natl_completed'
};

// ── Helpers ────────────────────────────────────────────────────────────────
const esc = s => (s == null ? '' : String(s))
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num   = (v, fb='--') => v == null ? fb : Number(v).toLocaleString('en-MY');
const fmtRM = v => v == null ? '--' : 'RM ' + Number(v).toLocaleString('en-MY');
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const nice = s => s ? s.replace(/_/g,' ').toLowerCase().replace(/\b\w/g, c=>c.toUpperCase()) : '';
const initials = name => (name||'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();

// Overview date filtering — returns filtered PUBS and GRANTS for selected range
function getOvFilteredData() {
  if (!ovFromYM || !ovToYM) {
    return { filteredPubs: [...PUBS], filteredGrants: [...GRANTS] };
  }
  const filteredPubs = PUBS.filter(p => {
    if (!p.date) return false;
    const ym = +p.date.slice(0,4)*100 + +p.date.slice(5,7);
    return ym >= ovFromYM && ym <= ovToYM;
  });
  const fromY = Math.floor(ovFromYM/100), toY = Math.floor(ovToYM/100);
  const filteredGrants = GRANTS.filter(g => g.year_start && +g.year_start >= fromY && +g.year_start <= toY);
  return { filteredPubs, filteredGrants };
}

const _MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function _ymLabel(ym) { const y = Math.floor(ym/100), m = ym%100; return `${_MON[m-1]} ${y}`; }
const _monOpts = sel => _MON.map((n,i) => `<option value="${i+1}"${i+1===sel?' selected':''}>${n}</option>`).join('');
const _yrOpts  = (years, sel) => years.map(y => `<option value="${y}"${y===sel?' selected':''}>${y}</option>`).join('');

function buildOvRangeSelects() {
  const pubYears = [...new Set(PUBS.map(p => p.date ? +p.date.slice(0,4) : null).filter(y => y >= 2000))].sort((a,b)=>a-b);
  if (!pubYears.length) return;
  const minY = pubYears[0], maxY = pubYears[pubYears.length-1];
  const minYM = minY*100+1, maxYM = maxY*100+12;
  if (!ovFromYM) ovFromYM = minYM;
  if (!ovToYM)   ovToYM   = maxYM;
  const fromY = Math.floor(ovFromYM/100), fromM = ovFromYM%100;
  const toY   = Math.floor(ovToYM/100),   toM   = ovToYM%100;
  document.getElementById('ov-from-m').innerHTML = _monOpts(fromM);
  document.getElementById('ov-from-y').innerHTML = _yrOpts(pubYears, fromY);
  document.getElementById('ov-to-m').innerHTML   = _monOpts(toM);
  document.getElementById('ov-to-y').innerHTML   = _yrOpts(pubYears, toY);
}

function renderOvPeriodNote() {
  const note = (ovFromYM && ovToYM)
    ? `Publications &amp; Grants: ${_ymLabel(ovFromYM)} – ${_ymLabel(ovToYM)}`
    : 'All publications and grants (no date filter)';
  document.getElementById('ov-period-note').innerHTML = note;
}

// F-01: SVG icons tied to data domain — each icon is chosen for content relevance
const SVG = {
  staff:    `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path d="M7 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM14.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.615 16.428a1.224 1.224 0 0 1-.569-1.175 6.002 6.002 0 0 1 11.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 0 1 7 17a9.953 9.953 0 0 1-5.385-1.572ZM14.5 16h-.106c.07-.297.088-.611.048-.933a7.47 7.47 0 0 0-1.588-3.755 4.502 4.502 0 0 1 5.874 2.636.818.818 0 0 1-.36.98A7.465 7.465 0 0 1 14.5 16Z"/></svg>`,
  chart:    `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path d="M15.5 2A1.5 1.5 0 0 0 14 3.5v13a1.5 1.5 0 0 0 3 0v-13A1.5 1.5 0 0 0 15.5 2ZM9.5 7A1.5 1.5 0 0 0 8 8.5v8a1.5 1.5 0 0 0 3 0v-8A1.5 1.5 0 0 0 9.5 7ZM3.5 12A1.5 1.5 0 0 0 2 13.5v3a1.5 1.5 0 0 0 3 0v-3A1.5 1.5 0 0 0 3.5 12Z"/></svg>`,
  doc:      `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path fill-rule="evenodd" d="M4 4a2 2 0 0 1 2-2h4.586A2 2 0 0 1 12 2.586L15.414 6A2 2 0 0 1 16 7.414V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2 6a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2H7Z" clip-rule="evenodd"/></svg>`,
  docs:     `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h3.879a1.5 1.5 0 0 1 1.06.44l3.122 3.12A1.5 1.5 0 0 1 17 6.622V12.5a1.5 1.5 0 0 1-1.5 1.5h-1v-3.379a3 3 0 0 0-.879-2.121L10.5 5.379A3 3 0 0 0 8.379 4.5H7v-1Z"/><path d="M4.5 6A1.5 1.5 0 0 0 3 7.5v9A1.5 1.5 0 0 0 4.5 18h7a1.5 1.5 0 0 0 1.5-1.5v-5.879a1.5 1.5 0 0 0-.44-1.06L9.44 6.439A1.5 1.5 0 0 0 8.378 6H4.5Z"/></svg>`,
  sum:      `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path fill-rule="evenodd" d="M5.5 17a4.5 4.5 0 0 1-1.44-8.765 4.5 4.5 0 0 1 8.302-3.046 3.5 3.5 0 0 1 4.504 4.272A4 4 0 0 1 15 17H5.5Zm3.75-2.75a.75.75 0 0 0 1.5 0V9.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0l-3.25 3.5a.75.75 0 1 0 1.1 1.02l1.95-2.1v4.59Z" clip-rule="evenodd"/></svg>`,
  beaker:   `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path fill-rule="evenodd" d="M8.5 3.528v4.644c0 .507-.199.994-.551 1.352l-3.3 3.42A1.067 1.067 0 0 0 5.4 14.6h9.2a1.067 1.067 0 0 0 .75-1.456l-3.3-3.42A1.927 1.927 0 0 1 11.5 8.17V3.528a9.372 9.372 0 0 1-3 0Z" clip-rule="evenodd"/><path d="M5.5 2.5a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2h-9Z"/></svg>`,
  money:    `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.798 7.45c.512-.67 1.135-1.2 1.927-1.2.68 0 1.212.405 1.555.952.343.546.47 1.233.47 1.798 0 .68-.262 1.37-.752 1.86a3.45 3.45 0 0 1-.673.502v.138a1 1 0 1 1-2 0v-.6a1 1 0 0 1 1-1 1.45 1.45 0 0 0 .88-.316c.198-.194.345-.484.345-.784 0-.365-.077-.712-.22-.946-.143-.228-.295-.304-.405-.304-.277 0-.609.235-1.021.77a1 1 0 0 1-1.606-1.17ZM10 15a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd"/></svg>`,
  cap:      `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path d="M10.394 2.08a1 1 0 0 0-.788 0l-7 3a1 1 0 0 0 0 1.84L5.25 8.051a.999.999 0 0 1 .356-.257l4-1.714a1 1 0 1 1 .788 1.838L7.667 9.088l1.94.831a1 1 0 0 0 .787 0l7-3a1 1 0 0 0 0-1.838l-7-3ZM3.31 9.397 5 10.12v4.102a8.969 8.969 0 0 0-1.05-.174 1 1 0 0 1-.89-.89 11.115 11.115 0 0 1 .01-2.258A6.986 6.986 0 0 1 3.31 9.397Zm5.99 1.9L7.638 10.5l-1.313.562-.3.128A1 1 0 0 0 5.5 12.14v3.72a4.9 4.9 0 0 0 4.5 0v-3.72a1 1 0 0 0-.524-.92L8.5 10.84l.8-.343Z"/><path d="M5.595 15.964A6.964 6.964 0 0 0 10 17.5a6.964 6.964 0 0 0 4.405-1.536V12.14a1 1 0 0 0-.524-.92l-3.351-1.437a1 1 0 0 0-.788 0L6.595 11.22a1 1 0 0 0-.524.92v3.824Z"/></svg>`,
  handshake:`<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z"/></svg>`,
  star:     `<svg viewBox="0 0 20 20" fill="currentColor" class="kpi-icon" aria-hidden="true"><path fill-rule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clip-rule="evenodd"/></svg>`,
};

function kpi(label, value, sub, color, iconKey) {
  return `<div class="kpi" style="--kpi-color:${color}">
    ${SVG[iconKey] || ''}
    <div class="kpi-value num">${esc(String(value))}</div>
    <div class="kpi-label">${esc(label)}</div>
    <div class="kpi-sub">${esc(sub)}</div>
  </div>`;
}

// ── Year selects ──────────────────────────────────────────────────────────
function buildYearSelects(elFrom, elTo, minY, maxY) {
  const all = `<option value="">All years</option>`;
  const opts = Array.from({length: maxY-minY+1}, (_,i)=>maxY-i)
    .map(y=>`<option value="${y}">${y}</option>`).join('');
  elFrom.innerHTML = all + opts;
  elTo.innerHTML   = all + opts;
}

// ── Load ───────────────────────────────────────────────────────────────────
async function loadData() {
  const overlay = document.getElementById('load-overlay');
  try {
    const [sumRes, staffRes, pubsRes, grantsRes, svRes, conRes] = await Promise.all([
      fetch('data/expert_summary.json'),
      fetch('data/expert_staff.json'),
      fetch('data/expert_pubs.json'),
      fetch('data/expert_grants.json'),
      fetch('data/expert_supervision.json').catch(() => null),
      fetch('data/expert_consultancy.json').catch(() => null),
    ]);
    if (!sumRes.ok || !staffRes.ok || !pubsRes.ok || !grantsRes.ok) {
      throw new Error('One or more data files failed to load.');
    }
    const summary = await sumRes.json();
    STAFF      = await staffRes.json();
    PUBS       = await pubsRes.json();
    GRANTS     = await grantsRes.json();
    SUPERVISION  = (svRes  && svRes.ok)  ? await svRes.json()  : [];
    CONSULTANCY  = (conRes && conRes.ok) ? await conRes.json() : [];
    STAFF_BY_SLUG = new Map(STAFF.map(s => [s.slug, s]));

    const dateStr = summary.generated || '--';
    document.getElementById('sidebar-updated').textContent = dateStr;
    document.getElementById('data-pill').textContent = 'Data: ' + dateStr;

    // Build year range selects
    const pubYears   = PUBS.map(p => p.date ? +p.date.slice(0,4) : null).filter(Boolean);
    const grantYears = GRANTS.map(g => g.year_start).filter(Boolean).map(Number);
    const pubMin = Math.min(...pubYears),   pubMax = Math.max(...pubYears);
    const gMin   = Math.min(...grantYears), gMax   = Math.max(...grantYears);
    buildYearSelects(document.getElementById('pubs-year-from'),   document.getElementById('pubs-year-to'),   pubMin, pubMax);
    buildYearSelects(document.getElementById('grants-year-from'), document.getElementById('grants-year-to'), gMin, gMax);

    renderOverview(summary);
    populatePositionFilter();
    renderStaffTable();
    renderPubsTable();
    renderGrantsTable();

    overlay.hidden = true;
  } catch(e) {
    console.error(e);
    overlay.innerHTML = `<div class="error-banner" role="alert">
      <strong>Failed to load dashboard data.</strong><br>${esc(e.message)}<br>
      <small>Make sure the local server is running and data files exist in docs/data/.</small>
    </div>`;
  }
}
