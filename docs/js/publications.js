'use strict';

// ── PUBLICATIONS ───────────────────────────────────────────────────────────
function getPubsList() {
  const q  = document.getElementById('pubs-search').value.trim().toLowerCase();
  const yf = +document.getElementById('pubs-year-from').value || null;
  const yt = +document.getElementById('pubs-year-to').value   || null;
  const cat = getPubCat();
  let rows = [...PUBS];
  if (xf.pubs_type === 'indexed')      rows = rows.filter(p =>  p.indexed);
  else if (xf.pubs_type === 'other')   rows = rows.filter(p => !p.indexed);
  else if (cat === 'indexed')          rows = rows.filter(p =>  p.indexed);
  else if (cat === 'nonindexed')       rows = rows.filter(p => !p.indexed);
  const type = getPubType();
  if (type !== 'all') rows = rows.filter(p => (p.type||'').toUpperCase() === type.toUpperCase());
  if (yf) rows = rows.filter(p => p.date && +p.date.slice(0,4) >= yf);
  if (yt) rows = rows.filter(p => p.date && +p.date.slice(0,4) <= yt);
  if (q)  rows = rows.filter(p => ((p.title||'')+(p.name||'')).toLowerCase().includes(q));
  return applySort(rows, 'pubs');
}

// ── PUBLICATIONS OVERVIEW ─────────────────────────────────────────────────
let _pubsOvCharts = {};
let _pubsOvFromYM = 0, _pubsOvToYM = 0; // 0 = all time, format YYYYMM

function renderPubsOverview() {
  const el = document.getElementById('pubs-ov-content');
  if (!el || !PUBS.length) return;

  // Build year list for pubs filter
  const pubYears = [...new Set(PUBS.map(p => p.date ? +p.date.slice(0,4) : null).filter(y => y >= 2000))].sort((a,b)=>a-b);
  const minPY = pubYears[0]                    || new Date().getFullYear();
  const maxPY = pubYears[pubYears.length-1]    || new Date().getFullYear();
  const minYM  = minPY*100+1, maxYM = maxPY*100+12;
  if (!_pubsOvFromYM) _pubsOvFromYM = minYM;
  if (!_pubsOvToYM)   _pubsOvToYM   = maxYM;

  const SWE = new Set(['SCOPUS', 'WEB OF SCIENCE', 'ERA']);
  const inRange = p => {
    if (!p.date) return false;
    const ym = +p.date.slice(0,4)*100 + +p.date.slice(5,7);
    return ym >= _pubsOvFromYM && ym <= _pubsOvToYM;
  };
  const pubs    = PUBS.filter(inRange);
  const indexed = pubs.filter(p => p.indexed);
  const swe     = indexed.filter(p => SWE.has(p.index_name));
  const nonIdx  = pubs.filter(p => !p.indexed);
  const totalUq = new Set(pubs.map(p => p.title?.trim().toLowerCase()).filter(Boolean));
  const sweUq   = new Set(swe.map(p => p.title?.trim().toLowerCase()).filter(Boolean));
  const idxUq   = new Set(indexed.map(p => p.title?.trim().toLowerCase()).filter(Boolean));

  // by year
  const byYear = {};
  for (const p of pubs) {
    const y = (p.date||'').slice(0,4);
    if (!y) continue;
    if (!byYear[y]) byYear[y] = {swe:0, idx:0, other:0};
    if (SWE.has(p.index_name)) byYear[y].swe++;
    else if (p.indexed)        byYear[y].idx++;
    else                       byYear[y].other++;
  }
  const years = Object.keys(byYear).sort();

  // by index database (top 8)
  const byIdx = {};
  for (const p of indexed) {
    const k = p.index_name || 'Other';
    byIdx[k] = (byIdx[k]||0) + 1;
  }
  const idxEntries = Object.entries(byIdx).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // by type
  const byType = {};
  for (const p of pubs) {
    const t = (p.type||'Unknown').toUpperCase();
    byType[t] = (byType[t]||0) + 1;
  }

  // top authors by pub count
  const byAuthor = {};
  for (const p of pubs) {
    if (!p.slug) continue;
    const s = STAFF_BY_SLUG.get(p.slug);
    const name = s?.name || p.name || p.slug;
    if (!byAuthor[p.slug]) byAuthor[p.slug] = {name, swe:0, idx:0, total:0};
    byAuthor[p.slug].total++;
    if (p.indexed) byAuthor[p.slug].idx++;
    if (SWE.has(p.index_name)) byAuthor[p.slug].swe++;
  }
  const topAuthors = Object.values(byAuthor).sort((a,b)=>b.swe-a.swe||b.idx-a.idx).slice(0,10);

  // insightful commentary
  const latestYear = years[years.length-1] || '';
  const prevYear   = years[years.length-2] || '';
  const growthStr  = (latestYear && prevYear && byYear[prevYear]?.swe > 0)
    ? (() => {
        const d = byYear[latestYear].swe - byYear[prevYear].swe;
        const pct = ((d/byYear[prevYear].swe)*100).toFixed(0);
        return d >= 0
          ? `Scopus/WoS/ERA output in ${latestYear} is <b>${byYear[latestYear].swe}</b>, up <b>+${pct}%</b> vs ${prevYear}.`
          : `Scopus/WoS/ERA output in ${latestYear} is <b>${byYear[latestYear].swe}</b>, down <b>${pct}%</b> vs ${prevYear}.`;
      })()
    : '';
  const topIdx = idxEntries[0];
  const rangeLabel = _pubsOvFromYM === minYM && _pubsOvToYM === maxYM ? 'all time' : `${_ymLabel(_pubsOvFromYM)}–${_ymLabel(_pubsOvToYM)}`;
  const fM = _pubsOvFromYM%100, fY = Math.floor(_pubsOvFromYM/100);
  const tM = _pubsOvToYM%100,   tY = Math.floor(_pubsOvToYM/100);
  const pYrOpts = sel => pubYears.map(y => `<option value="${y}"${y===sel?' selected':''}>${y}</option>`).join('');

  el.innerHTML = `
  <div class="pov-filter-bar">
    <select class="filter-select" id="pubs-ov-fm" aria-label="From month">${_monOpts(fM)}</select>
    <select class="filter-select" id="pubs-ov-fy" aria-label="From year">${pYrOpts(fY)}</select>
    <span class="pov-filter-sep">–</span>
    <select class="filter-select" id="pubs-ov-tm" aria-label="Until month">${_monOpts(tM)}</select>
    <select class="filter-select" id="pubs-ov-ty" aria-label="Until year">${pYrOpts(tY)}</select>
    <button class="pov-reset-btn" id="pubs-ov-reset">All time</button>
    <span class="pov-filter-note">${num(pubs.length)} records</span>
  </div>
  <div class="pov-insight">${growthStr ? growthStr + ' ' : ''}<b>${num(sweUq.size)}</b> unique Scopus/WoS/ERA titles (${rangeLabel}) across <b>${STAFF.length}</b> staff. ${topIdx ? `Most-used index: <b>${esc(topIdx[0])}</b> (${num(topIdx[1])} entries).` : ''}</div>

  <div class="pov-kpis">
    <div class="pov-kpi" style="--kpi-color:#0891b2"><div class="pk-v">${num(sweUq.size)}</div><div class="pk-k">Scopus / WoS / ERA</div><div class="pk-s">Unique titles, all-time</div></div>
    <div class="pov-kpi" style="--kpi-color:#2563eb"><div class="pk-v">${num(idxUq.size)}</div><div class="pk-k">All Indexed</div><div class="pk-s">Incl. MyCite &amp; others</div></div>
    <div class="pov-kpi" style="--kpi-color:#059669"><div class="pk-v">${num(nonIdx.length)}</div><div class="pk-k">Non-Indexed</div><div class="pk-s">Proceedings, books, etc.</div></div>
    <div class="pov-kpi" style="--kpi-color:#d97706"><div class="pk-v">${num(totalUq.size)}</div><div class="pk-k">Total Unique</div><div class="pk-s">All types combined</div></div>
  </div>

  <div class="pov-charts">
    <div class="pov-chart-card" style="grid-column:span 2">
      <h4>Publications by Year (2015–present)</h4>
      <p class="pov-sub">Scopus/WoS/ERA vs other indexed entries per year</p>
      <div class="pov-chart-wrap"><canvas id="pov-pubs-year"></canvas></div>
    </div>
  </div>
  <div class="pov-charts">
    <div class="pov-chart-card">
      <h4>By Index Database</h4>
      <p class="pov-sub">Indexed entries per database (all time)</p>
      <div class="pov-chart-wrap"><canvas id="pov-pubs-idx"></canvas></div>
    </div>
    <div class="pov-chart-card">
      <h4>By Publication Type</h4>
      <p class="pov-sub">Distribution across publication types</p>
      <div class="pov-chart-wrap"><canvas id="pov-pubs-type"></canvas></div>
    </div>
  </div>

  <div class="pov-table-card">
    <h4>Top 10 Staff by Scopus/WoS/ERA Publications</h4>
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Scopus/WoS/ERA</th><th>All Indexed</th><th>Total</th></tr></thead>
      <tbody>${topAuthors.map((a,i)=>`<tr><td>${i+1}</td><td>${esc(a.name)}</td><td class="num">${num(a.swe)}</td><td class="num">${num(a.idx)}</td><td class="num">${num(a.total)}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;

  // destroy old charts
  Object.values(_pubsOvCharts).forEach(c => c.destroy());
  _pubsOvCharts = {};

  const dark = document.documentElement.dataset.theme === 'dark' || window.matchMedia('(prefers-color-scheme:dark)').matches;
  const gridColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
  const textColor = dark ? '#94a3b8' : '#64748b';

  // year bar chart
  _pubsOvCharts.year = new Chart(document.getElementById('pov-pubs-year'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label: 'Scopus/WoS/ERA', data: years.map(y=>byYear[y].swe), backgroundColor: '#2563eb', stack: 's' },
        { label: 'Other Indexed',  data: years.map(y=>byYear[y].idx), backgroundColor: '#93c5fd', stack: 's' },
        { label: 'Non-Indexed',    data: years.map(y=>byYear[y].other), backgroundColor: '#e2e8f0', stack: 's' },
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{boxWidth:12,font:{size:11},color:textColor}}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}},stacked:true} } }
  });

  // index bar chart
  _pubsOvCharts.idx = new Chart(document.getElementById('pov-pubs-idx'), {
    type: 'bar',
    data: {
      labels: idxEntries.map(([k])=>k),
      datasets: [{ data: idxEntries.map(([,v])=>v), backgroundColor: ['#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#eff6ff'], borderRadius: 4 }]
    },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{display:false},ticks:{color:textColor,font:{size:11}}} } }
  });

  // type donut
  const typeKeys = Object.keys(byType).sort((a,b)=>byType[b]-byType[a]);
  const typePalette = ['#2563eb','#059669','#d97706','#7c3aed','#dc2626','#0891b2'];
  _pubsOvCharts.type = new Chart(document.getElementById('pov-pubs-type'), {
    type: 'doughnut',
    data: { labels: typeKeys.map(k=>k.replace(/ IN /,' in ')), datasets: [{ data: typeKeys.map(k=>byType[k]), backgroundColor: typePalette, borderWidth: 2 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{boxWidth:10,font:{size:11},color:textColor}}, datalabels:{display:false} } }
  });

  // wire filter bar events (re-wired after each innerHTML re-render)
  function _readPubsOvSelects() {
    const fm = +document.getElementById('pubs-ov-fm').value;
    const fy = +document.getElementById('pubs-ov-fy').value;
    const tm = +document.getElementById('pubs-ov-tm').value;
    const ty = +document.getElementById('pubs-ov-ty').value;
    _pubsOvFromYM = fy*100+fm;
    _pubsOvToYM   = ty*100+tm;
    if (_pubsOvFromYM > _pubsOvToYM) _pubsOvToYM = _pubsOvFromYM;
  }
  ['pubs-ov-fm','pubs-ov-fy','pubs-ov-tm','pubs-ov-ty'].forEach(id => {
    const el2 = document.getElementById(id);
    if (el2) el2.addEventListener('change', () => { _readPubsOvSelects(); renderPubsOverview(); });
  });
  const resetBtn = document.getElementById('pubs-ov-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => { _pubsOvFromYM = minYM; _pubsOvToYM = maxYM; renderPubsOverview(); });
}

// ── PUBLICATIONS QUALITY ──────────────────────────────────────────────────
let _pubsQCharts = {};
let _pubsQFromY = 0, _pubsQToY = 0;

function renderPubsQuality() {
  const el = document.getElementById('pubs-q-content');
  if (!el || !PUBS.length) return;

  // Tier mapping
  const TIERS = [
    { key: 'scopus',   label: 'Scopus',          color: '#1d4ed8' },
    { key: 'wos',      label: 'Web of Science',   color: '#0891b2' },
    { key: 'era',      label: 'ERA',              color: '#059669' },
    { key: 'mycite',   label: 'MyCite',           color: '#d97706' },
    { key: 'other_idx',label: 'Other Indexed',    color: '#7c3aed' },
    { key: 'nonidx',   label: 'Non-Indexed',      color: '#94a3b8' },
  ];
  function pubTier(p) {
    const idx = (p.index_name||'').toUpperCase();
    if (!p.indexed) return 'nonidx';
    if (idx === 'SCOPUS') return 'scopus';
    if (idx === 'WEB OF SCIENCE') return 'wos';
    if (idx === 'ERA') return 'era';
    if (idx === 'MYCITE') return 'mycite';
    return 'other_idx';
  }

  const pubYears = [...new Set(PUBS.map(p => p.date ? +p.date.slice(0,4) : null).filter(y => y >= 2000))].sort((a,b)=>a-b);
  const minY = pubYears[0] || new Date().getFullYear();
  const maxY = pubYears[pubYears.length-1] || new Date().getFullYear();
  if (!_pubsQFromY) _pubsQFromY = minY;
  if (!_pubsQToY)   _pubsQToY   = maxY;

  const inRange = p => { const y = p.date ? +p.date.slice(0,4) : 0; return y >= _pubsQFromY && y <= _pubsQToY; };
  const pubs = PUBS.filter(inRange);
  const total = pubs.length || 1;

  // KPI counts per tier
  const tierCounts = {};
  TIERS.forEach(t => { tierCounts[t.key] = 0; });
  for (const p of pubs) tierCounts[pubTier(p)]++;

  // By year per tier
  const byYear = {};
  for (const p of pubs) {
    const y = (p.date||'').slice(0,4); if (!y) continue;
    if (!byYear[y]) { const o = {}; TIERS.forEach(t => { o[t.key]=0; }); byYear[y] = o; }
    byYear[y][pubTier(p)]++;
  }
  const years = Object.keys(byYear).sort();

  // Top 20 venues / journals
  const venueCounts = {};
  const venueTier = {};
  for (const p of pubs) {
    const v = (p.index_name||'Non-Indexed').trim();
    if (!venueCounts[v]) { venueCounts[v] = 0; venueTier[v] = pubTier(p); }
    venueCounts[v]++;
  }
  const topVenues = Object.entries(venueCounts).sort((a,b)=>b[1]-a[1]).slice(0,20);

  // Staff leaderboard by Scopus + WoS count
  const staffQ = {};
  for (const p of pubs) {
    if (!p.slug) continue;
    if (!staffQ[p.slug]) { staffQ[p.slug] = { name: p.name||p.slug, scopus:0, wos:0, era:0, total:0 }; }
    staffQ[p.slug].total++;
    const t = pubTier(p);
    if (t === 'scopus') staffQ[p.slug].scopus++;
    else if (t === 'wos') staffQ[p.slug].wos++;
    else if (t === 'era') staffQ[p.slug].era++;
  }
  const topStaff = Object.values(staffQ).sort((a,b) => (b.scopus+b.wos)-(a.scopus+a.wos) || b.era-a.era).slice(0,15);

  // Per-dept breakdown
  const deptQ = {};
  for (const p of pubs) {
    const s = STAFF_BY_SLUG.get(p.slug);
    const dept = s?.department || 'Unknown';
    if (!deptQ[dept]) { const o = {}; TIERS.forEach(t => { o[t.key]=0; }); deptQ[dept] = o; }
    deptQ[dept][pubTier(p)]++;
  }
  const depts = Object.entries(deptQ).sort((a,b) => (b[1].scopus+b[1].wos+b[1].era) - (a[1].scopus+a[1].wos+a[1].era));

  const yrOpts = sel => pubYears.map(y => `<option value="${y}"${y===sel?' selected':''}>${y}</option>`).join('');

  el.innerHTML = `
  <div class="pov-filter-bar">
    <span class="pov-filter-label">Year range</span>
    <select class="filter-select" id="pubs-q-fy" aria-label="From year">${yrOpts(_pubsQFromY)}</select>
    <span class="pov-filter-sep">–</span>
    <select class="filter-select" id="pubs-q-ty" aria-label="Until year">${yrOpts(_pubsQToY)}</select>
    <button class="pov-reset-btn" id="pubs-q-reset">All time</button>
    <span class="pov-filter-note">${num(pubs.length)} records</span>
  </div>

  <div class="pov-kpis" style="grid-template-columns:repeat(auto-fill,minmax(140px,1fr))">
    ${TIERS.map(t => `<div class="pov-kpi" style="--kpi-color:${t.color}">
      <div class="pk-v">${num(tierCounts[t.key])}</div>
      <div class="pk-k">${esc(t.label)}</div>
      <div class="pk-s">${((tierCounts[t.key]/total)*100).toFixed(1)}% of total</div>
    </div>`).join('')}
  </div>

  <div class="pov-charts">
    <div class="pov-chart-card" style="grid-column:span 2">
      <h4>Publications by Year — Index Tier</h4>
      <p class="pov-sub">Stacked by tier, most prestigious at bottom</p>
      <div class="pov-chart-wrap"><canvas id="pov-q-year"></canvas></div>
    </div>
  </div>
  <div class="pov-charts">
    <div class="pov-chart-card" style="grid-column:span 2">
      <h4>Top 20 Index Databases / Venues</h4>
      <p class="pov-sub">By number of entries in selected range</p>
      <div class="pov-chart-wrap" style="height:${Math.max(260, topVenues.length*22)}px"><canvas id="pov-q-venue"></canvas></div>
    </div>
  </div>
  <div class="pov-charts">
    <div class="pov-chart-card" style="grid-column:span 2">
      <h4>Department Breakdown by Index Tier</h4>
      <p class="pov-sub">Sorted by Scopus + WoS + ERA output</p>
      <div class="pov-chart-wrap" style="height:${Math.max(200, depts.length*32)}px"><canvas id="pov-q-dept"></canvas></div>
    </div>
  </div>

  <div class="pov-table-card">
    <h4>Top 15 Staff by Indexed Publications (Scopus / WoS / ERA)</h4>
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Scopus</th><th>WoS</th><th>ERA</th><th>Total (range)</th></tr></thead>
      <tbody>${topStaff.map((a,i) => `<tr>
        <td>${i+1}</td>
        <td>${esc(a.name)}</td>
        <td class="num">${num(a.scopus)}</td>
        <td class="num">${num(a.wos)}</td>
        <td class="num">${num(a.era)}</td>
        <td class="num">${num(a.total)}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;

  Object.values(_pubsQCharts).forEach(c => c.destroy());
  _pubsQCharts = {};

  const dark = document.documentElement.dataset.theme === 'dark' || window.matchMedia('(prefers-color-scheme:dark)').matches;
  const gridColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
  const textColor = dark ? '#94a3b8' : '#64748b';

  _pubsQCharts.year = new Chart(document.getElementById('pov-q-year'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: TIERS.map(t => ({
        label: t.label,
        data: years.map(y => byYear[y]?.[t.key] || 0),
        backgroundColor: t.color,
        stack: 's',
      }))
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{boxWidth:12,font:{size:11},color:textColor}}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}},stacked:true} } }
  });

  const venuePalette = topVenues.map(([v]) => TIERS.find(t=>t.key===venueTier[v])?.color || '#94a3b8');
  _pubsQCharts.venue = new Chart(document.getElementById('pov-q-venue'), {
    type: 'bar',
    data: { labels: topVenues.map(([v])=>v), datasets: [{ data: topVenues.map(([,n])=>n), backgroundColor: venuePalette, borderRadius:3 }] },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{display:false},ticks:{color:textColor,font:{size:10}}} } }
  });

  _pubsQCharts.dept = new Chart(document.getElementById('pov-q-dept'), {
    type: 'bar',
    data: {
      labels: depts.map(([d])=>d),
      datasets: TIERS.map(t => ({
        label: t.label,
        data: depts.map(([,v]) => v[t.key]||0),
        backgroundColor: t.color,
        stack: 's',
      }))
    },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{boxWidth:12,font:{size:11},color:textColor}}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{display:false},ticks:{color:textColor,font:{size:10}}} } }
  });

  document.getElementById('pubs-q-fy').addEventListener('change', () => { _pubsQFromY=+document.getElementById('pubs-q-fy').value; renderPubsQuality(); });
  document.getElementById('pubs-q-ty').addEventListener('change', () => { _pubsQToY=+document.getElementById('pubs-q-ty').value; renderPubsQuality(); });
  document.getElementById('pubs-q-reset').addEventListener('click', () => { _pubsQFromY=minY; _pubsQToY=maxY; renderPubsQuality(); });
}

function renderPubsTable() {
  const rows  = getPubsList();
  const q     = document.getElementById('pubs-search').value.trim();
  const total = Math.max(1, Math.ceil(rows.length/PAGE_SIZE));
  pageState.pubs = Math.min(pageState.pubs, total);
  const start = (pageState.pubs-1)*PAGE_SIZE;
  const page  = rows.slice(start, start+PAGE_SIZE);
  const cat2 = getPubCat();
  const showCatHdr = cat2 === 'all' && !xf.pubs_type;
  document.getElementById('pubs-th-cat').hidden = !showCatHdr;
  const tabLabel = cat2 === 'indexed' ? 'indexed publications' : cat2 === 'nonindexed' ? 'non-indexed publications' : 'publications';
  document.getElementById('pubs-count').textContent =
    `${rows.length.toLocaleString()} ${tabLabel}${q?` matching "${q}"`:''}`;
  document.getElementById('pubs-pagination').innerHTML = paginHTML(total, pageState.pubs, 'pubs');

  document.getElementById('pubs-tbody').innerHTML = page.length
    ? page.map((p,i) => `
      <tr>
        <td class="muted">${start+i+1}</td>
        <td class="clip wide"><button class="title-btn" data-pubidx="${PUBS.indexOf(p)}" title="${esc(p.title)}">${esc(p.title||'(no title)')}</button></td>
        <td>${esc(nice(p.type))}</td>
        ${showCatHdr ? `<td>${p.indexed ? '<span class="badge badge-indexed">Indexed</span>' : '<span class="badge badge-other">Other</span>'}</td>` : ''}
        <td style="white-space:nowrap">${esc(p.date||'')}</td>
        <td style="white-space:nowrap">${esc(p.name||'')}</td>
      </tr>`).join('')
    : `<tr><td class="empty" colspan="${showCatHdr?6:5}">No publications match the current filters.</td></tr>`;
}

// ── PUB DETAIL DRAWER ──────────────────────────────────────────────────────
function openPubDrawer(pubIdx) {
  const p = PUBS[pubIdx]; if (!p) return;
  const staff = STAFF_BY_SLUG.get(p.slug);

  document.getElementById('pub-drawer-title').textContent = p.title || '(no title)';
  document.getElementById('pub-drawer-body').innerHTML = `
    <dl class="pub-meta">
      <dt>Reference</dt>
      <dd>${esc(p.ref || '--')}</dd>
      <dt>Date</dt>
      <dd>${esc(p.date || '--')}</dd>
      <dt>Type</dt>
      <dd>${esc(nice(p.type))}</dd>
      <dt>Category</dt>
      <dd>${p.indexed ? '<span class="badge badge-indexed">Indexed Publication</span>' : '<span class="badge badge-other">Other Publication</span>'}</dd>
      <dt>Group</dt>
      <dd>${esc(p.group || '--')}</dd>
      <dt>Author</dt>
      <dd><button class="name-btn" data-slug="${esc(p.slug)}" style="font-size:13px">${esc(p.name || '--')}</button></dd>
      ${staff ? `
      <dt>Position</dt>
      <dd>${esc(staff.position || '--')}</dd>
      <dt>Department</dt>
      <dd>${esc(staff.department || '--')}</dd>
      ` : ''}
    </dl>`;

  const actions = document.getElementById('pub-drawer-actions');
  actions.innerHTML = '';
  if (p.url) {
    const a = document.createElement('a');
    a.href = p.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.className = 'btn-primary'; a.textContent = 'View in database';
    actions.appendChild(a);
  }
  if (p.slug) {
    const b = document.createElement('button');
    b.className = 'btn-secondary'; b.textContent = 'View author profile';
    b.addEventListener('click', () => { closePubDrawer(); showPage('staff'); setTimeout(() => openStaffProfile(p.slug), 60); });
    actions.appendChild(b);
  }

  document.getElementById('pub-drawer').classList.add('open');
  document.getElementById('pub-backdrop').classList.add('open');
  document.getElementById('pub-drawer-close').focus();
}

function closePubDrawer() {
  document.getElementById('pub-drawer').classList.remove('open');
  document.getElementById('pub-backdrop').classList.remove('open');
}

function openGrantDrawer(grantIdx) {
  const g = GRANTS[grantIdx]; if (!g) return;
  const isIntl   = (g.level||'').toUpperCase().includes('INT');
  const isActive = (g.status||'').toUpperCase() === 'ACTIVE';
  document.getElementById('pub-drawer-title').textContent = g.title || '(no title)';
  document.getElementById('pub-drawer-body').innerHTML = `
    <dl class="pub-meta">
      <dt>File No.</dt><dd>${esc(g.file_no||'--')}</dd>
      <dt>Level</dt><dd>${isIntl ? '<span class="badge badge-intl">International</span>' : '<span class="badge badge-natl">National</span>'}</dd>
      <dt>Grant Name</dt><dd>${esc(g.grant_name||'--')}</dd>
      <dt>Grant Code</dt><dd>${esc(g.grant_code||'--')}</dd>
      <dt>Role</dt><dd>${esc(g.role||'--')}</dd>
      <dt>Cost (RM)</dt><dd>${g.cost != null ? 'RM ' + Number(g.cost).toLocaleString() : '--'}</dd>
      <dt>Year Start</dt><dd>${esc(String(g.year_start||'--'))}</dd>
      <dt>Year End</dt><dd>${esc(String(g.year_end||'--'))}</dd>
      <dt>Status</dt><dd>${isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-done">Completed</span>'}</dd>
      <dt>Researcher</dt><dd><button class="name-btn" data-slug="${esc(g.slug)}" style="font-size:13px">${esc(g.name||'--')}</button></dd>
    </dl>`;
  document.getElementById('pub-drawer-actions').innerHTML = '';
  document.getElementById('pub-drawer').classList.add('open');
  document.getElementById('pub-backdrop').classList.add('open');
  document.getElementById('pub-drawer-close').focus();
}

function openSvDrawer(svIdx) {
  const e = SUPERVISION[svIdx]; if (!e) return;
  const cat = e.category || '';
  const level = cat.includes('phd') ? 'PhD' : 'Master';
  const isGrad = cat.includes('graduated');
  document.getElementById('pub-drawer-title').textContent = e.student_name || '(no name)';
  document.getElementById('pub-drawer-body').innerHTML = `
    <dl class="pub-meta">
      <dt>Matric No.</dt><dd>${esc(e.matric||'--')}</dd>
      <dt>Level</dt><dd><span class="badge ${cat.includes('phd') ? 'badge-intl' : 'badge-natl'}">${level}</span></dd>
      <dt>Status</dt><dd>${isGrad ? '<span class="badge badge-done">Graduated</span>' : '<span class="badge badge-active">Ongoing</span>'}</dd>
      <dt>Programme</dt><dd>${esc(e.programme||'--')}</dd>
      <dt>Research Title</dt><dd>${esc(e.title||'--')}</dd>
      <dt>Intake</dt><dd>${esc(e.intake||'--')}</dd>
      <dt>Academic Status</dt><dd>${esc(e.status||'--')}</dd>
      ${e.graduated_sem ? `<dt>Graduated Sem</dt><dd>${esc(e.graduated_sem)}</dd>` : ''}
      <dt>Main Supervisor</dt><dd>${esc(e.main_supervisor||'--')}</dd>
      <dt>Supervisor</dt><dd><button class="name-btn" data-slug="${esc(e.slug)}" style="font-size:13px">${esc(e.staff_name||'--')}</button></dd>
    </dl>`;
  document.getElementById('pub-drawer-actions').innerHTML = '';
  document.getElementById('pub-drawer').classList.add('open');
  document.getElementById('pub-backdrop').classList.add('open');
  document.getElementById('pub-drawer-close').focus();
}

function openConDrawer(conIdx) {
  const e = CONSULTANCY[conIdx]; if (!e) return;
  const isDone = (e.status||'').toUpperCase() === 'COMPLETED';
  document.getElementById('pub-drawer-title').textContent = e.title || '(no title)';
  document.getElementById('pub-drawer-body').innerHTML = `
    <dl class="pub-meta">
      <dt>File No.</dt><dd>${esc(e.file_no||'--')}</dd>
      <dt>Client</dt><dd>${esc(e.client||'--')}</dd>
      <dt>Type</dt><dd>${esc(e.type||'--')}</dd>
      <dt>Role</dt><dd>${esc(e.role||'--')}</dd>
      <dt>Cost (RM)</dt><dd>${e.cost_rm != null ? 'RM ' + Number(e.cost_rm).toLocaleString() : '--'}</dd>
      <dt>Year Start</dt><dd>${esc(String(e.year_start||'--'))}</dd>
      <dt>Year End</dt><dd>${esc(String(e.year_end||'--'))}</dd>
      <dt>Status</dt><dd>${isDone ? '<span class="badge badge-done">Completed</span>' : '<span class="badge badge-active">Appointed</span>'}</dd>
      <dt>Researcher</dt><dd><button class="name-btn" data-slug="${esc(e.slug)}" style="font-size:13px">${esc(e.staff_name||'--')}</button></dd>
    </dl>`;
  document.getElementById('pub-drawer-actions').innerHTML = '';
  document.getElementById('pub-drawer').classList.add('open');
  document.getElementById('pub-backdrop').classList.add('open');
  document.getElementById('pub-drawer-close').focus();
}

document.getElementById('pub-drawer-close').addEventListener('click', closePubDrawer);
document.getElementById('pub-backdrop').addEventListener('click', closePubDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePubDrawer(); });
