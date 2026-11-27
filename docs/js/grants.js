'use strict';

// ── GRANTS ─────────────────────────────────────────────────────────────────
function getGrantsList() {
  const q  = document.getElementById('grants-search').value.trim().toLowerCase();
  const fl = document.getElementById('grants-filter-level').value;
  const fs = document.getElementById('grants-filter-status').value;
  const yf = +document.getElementById('grants-year-from').value || null;
  const yt = +document.getElementById('grants-year-to').value   || null;
  const role = getGrantRole();
  let rows = [...GRANTS];
  if (role === 'pi')     rows = rows.filter(g => (g.role||'').toUpperCase().includes('PRINCIPAL'));
  else if (role === 'member') rows = rows.filter(g => !(g.role||'').toUpperCase().includes('PRINCIPAL'));
  if (fl==='international') rows = rows.filter(g => (g.level||'').toUpperCase().includes('INT'));
  if (fl==='national')      rows = rows.filter(g => !(g.level||'').toUpperCase().includes('INT'));
  if (fs==='active')        rows = rows.filter(g => (g.status||'').toUpperCase()==='ACTIVE');
  if (fs==='completed')     rows = rows.filter(g => (g.status||'').toUpperCase()!=='ACTIVE');
  if (yf) rows = rows.filter(g => g.year_start && +g.year_start >= yf);
  if (yt) rows = rows.filter(g => g.year_start && +g.year_start <= yt);
  if (q)  rows = rows.filter(g => ((g.title||'')+(g.name||'')+(g.grant_name||'')).toLowerCase().includes(q));
  return applySort(rows, 'grants');
}

// ── GRANTS OVERVIEW ───────────────────────────────────────────────────────
let _grantsOvCharts = {};
let _grantsOvFromY = 0, _grantsOvToY = 0; // year integers, 0 = all time

function renderGrantsOverview() {
  const el = document.getElementById('grants-ov-content');
  if (!el || !GRANTS.length) return;

  // Build year list from year_start
  const allGYears = [...new Set(GRANTS.map(g => +(g.year_start||0)).filter(y => y >= 2000))].sort((a,b)=>a-b);
  const minGY = allGYears[0] || 2000;
  const maxGY = allGYears[allGYears.length-1] || new Date().getFullYear();
  if (!_grantsOvFromY) _grantsOvFromY = minGY;
  if (!_grantsOvToY)   _grantsOvToY   = maxGY;

  const inGRange = g => { const y = +(g.year_start||0); return y >= _grantsOvFromY && y <= _grantsOvToY; };
  const grants   = GRANTS.filter(inGRange);

  const isIntl    = g => (g.level||'').toUpperCase().includes('INT');
  const active    = grants.filter(g => (g.status||'').toUpperCase() === 'ACTIVE');
  const intlTotal = grants.filter(isIntl).length;
  const natTotal  = grants.filter(g => !isIntl(g)).length;
  const intlAct   = active.filter(isIntl).length;
  const natAct    = active.filter(g => !isIntl(g)).length;
  const totalCost = grants.reduce((s,g) => s + (g.cost ? +g.cost : 0), 0);
  const uniquePIs = new Set(grants.filter(g => (g.role||'').toUpperCase() === 'PRINCIPAL INVESTIGATOR').map(g => g.slug).filter(Boolean)).size;

  // by start year
  const byYear = {};
  for (const g of grants) {
    const y = String(g.year_start||'');
    if (!y) continue;
    if (!byYear[y]) byYear[y] = {active:0, completed:0};
    if ((g.status||'').toUpperCase() === 'ACTIVE') byYear[y].active++;
    else byYear[y].completed++;
  }
  const years = Object.keys(byYear).sort();

  // by level (4 segments)
  const seg = {ia:0, ic:0, na:0, nc:0};
  for (const g of grants) {
    const intl = isIntl(g);
    const act  = (g.status||'').toUpperCase() === 'ACTIVE';
    if (intl && act)  seg.ia++;
    else if (intl)    seg.ic++;
    else if (act)     seg.na++;
    else              seg.nc++;
  }

  // top grant schemes
  const byScheme = {};
  for (const g of grants) {
    const k = (g.grant_name||'Unknown').trim();
    byScheme[k] = (byScheme[k]||0) + 1;
  }
  const topSchemes = Object.entries(byScheme).sort((a,b)=>b[1]-a[1]).slice(0,8);

  // top PIs
  const piMap = {};
  for (const g of grants) {
    if (!g.slug || (g.role||'').toUpperCase() !== 'PRINCIPAL INVESTIGATOR') continue;
    const s = STAFF_BY_SLUG.get(g.slug);
    const name = s?.name || g.name || g.slug;
    if (!piMap[g.slug]) piMap[g.slug] = {name, active:0, total:0, cost:0};
    piMap[g.slug].total++;
    if ((g.status||'').toUpperCase() === 'ACTIVE') piMap[g.slug].active++;
    piMap[g.slug].cost += g.cost ? +g.cost : 0;
  }
  const topPIs = Object.values(piMap).sort((a,b) => b.active - a.active || b.total - a.total).slice(0, 10);

  const costFmt = totalCost > 0 ? 'RM ' + totalCost.toLocaleString('en-MY', {maximumFractionDigits:0}) : '—';
  const rangeGLabel = _grantsOvFromY === minGY && _grantsOvToY === maxGY ? 'all time' : `${_grantsOvFromY}–${_grantsOvToY}`;
  const gyrOpts = sel => allGYears.map(yr => `<option value="${yr}"${yr===sel?' selected':''}>${yr}</option>`).join('');

  el.innerHTML = `
  <div class="pov-filter-bar">
    <span class="pov-filter-label">From:</span>
    <select class="filter-select pov-yr-from" id="grants-ov-from" aria-label="From year">${gyrOpts(_grantsOvFromY)}</select>
    <span class="pov-filter-sep">–</span>
    <select class="filter-select pov-yr-to" id="grants-ov-to" aria-label="To year">${gyrOpts(_grantsOvToY)}</select>
    <button class="pov-reset-btn" id="grants-ov-reset">All time</button>
    <span class="pov-filter-note">${num(grants.length)} records</span>
  </div>
  <div class="pov-insight"><b>${num(grants.length)}</b> grant records (${rangeGLabel}) across <b>${num(uniquePIs)}</b> principal investigators — <b>${num(intlTotal)}</b> international, <b>${num(natTotal)}</b> national. Total acquisition: <b>${esc(costFmt)}</b>.</div>

  <div class="pov-kpis">
    <div class="pov-kpi" style="--kpi-color:#2563eb"><div class="pk-v">${num(grants.length)}</div><div class="pk-k">Total Grants</div><div class="pk-s">${rangeGLabel}</div></div>
    <div class="pov-kpi" style="--kpi-color:#0891b2"><div class="pk-v">${num(intlTotal)}</div><div class="pk-k">International</div><div class="pk-s">${num(intlAct)} currently active</div></div>
    <div class="pov-kpi" style="--kpi-color:#059669"><div class="pk-v">${num(natTotal)}</div><div class="pk-k">National</div><div class="pk-s">${num(natAct)} currently active</div></div>
    <div class="pov-kpi" style="--kpi-color:#7c3aed"><div class="pk-v">${num(uniquePIs)}</div><div class="pk-k">Principal Investigators</div><div class="pk-s">Staff who led grants</div></div>
    <div class="pov-kpi" style="--kpi-color:#d97706"><div class="pk-v">${esc(costFmt)}</div><div class="pk-k">Total Acquisition</div><div class="pk-s">Self-reported, all grants</div></div>
  </div>

  <div class="pov-charts">
    <div class="pov-chart-card" style="grid-column:span 2">
      <h4>Grants by Start Year</h4>
      <p class="pov-sub">Active vs completed grants awarded each year</p>
      <div class="pov-chart-wrap"><canvas id="pov-grants-year"></canvas></div>
    </div>
  </div>
  <div class="pov-charts">
    <div class="pov-chart-card">
      <h4>By Level and Status</h4>
      <p class="pov-sub">International vs National, Active vs Completed</p>
      <div class="pov-chart-wrap"><canvas id="pov-grants-seg"></canvas></div>
    </div>
    <div class="pov-chart-card">
      <h4>Top Grant Schemes</h4>
      <p class="pov-sub">Most common grant sources (all statuses)</p>
      <div class="pov-chart-wrap"><canvas id="pov-grants-scheme"></canvas></div>
    </div>
  </div>

  <div class="pov-table-card">
    <h4>Top 10 Principal Investigators (by active grants)</h4>
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Active</th><th>Total (PI)</th><th>Total Cost (RM)</th></tr></thead>
      <tbody>${topPIs.map((p,i)=>`<tr><td>${i+1}</td><td>${esc(p.name)}</td><td class="num">${num(p.active)}</td><td class="num">${num(p.total)}</td><td class="num">${p.cost>0?p.cost.toLocaleString('en-MY',{maximumFractionDigits:0}):'—'}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;

  Object.values(_grantsOvCharts).forEach(c => c.destroy());
  _grantsOvCharts = {};

  const dark = document.documentElement.dataset.theme === 'dark' || window.matchMedia('(prefers-color-scheme:dark)').matches;
  const gridColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
  const textColor = dark ? '#94a3b8' : '#64748b';

  _grantsOvCharts.year = new Chart(document.getElementById('pov-grants-year'), {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label: 'Active',    data: years.map(y=>byYear[y].active),    backgroundColor: '#16a34a', stack: 's' },
        { label: 'Completed', data: years.map(y=>byYear[y].completed), backgroundColor: '#93c5fd', stack: 's' },
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{boxWidth:12,font:{size:11},color:textColor}}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}},stacked:true} } }
  });

  _grantsOvCharts.seg = new Chart(document.getElementById('pov-grants-seg'), {
    type: 'bar',
    data: {
      labels: ['International', 'National'],
      datasets: [
        { label: 'Active',    data: [seg.ia, seg.na], backgroundColor: '#16a34a', borderRadius: 4 },
        { label: 'Completed', data: [seg.ic, seg.nc], backgroundColor: '#93c5fd', borderRadius: 4 },
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom',labels:{boxWidth:12,font:{size:11},color:textColor}}, datalabels:{display:false} }, scales:{ x:{grid:{display:false},ticks:{color:textColor}}, y:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}} } }
  });

  _grantsOvCharts.scheme = new Chart(document.getElementById('pov-grants-scheme'), {
    type: 'bar',
    data: {
      labels: topSchemes.map(([k])=>k.length>30?k.slice(0,28)+'…':k),
      datasets: [{ data: topSchemes.map(([,v])=>v), backgroundColor: '#3b82f6', borderRadius: 4 }]
    },
    options: { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false}, datalabels:{display:false} }, scales:{ x:{grid:{color:gridColor},ticks:{color:textColor,font:{size:11}}}, y:{grid:{display:false},ticks:{color:textColor,font:{size:10}}} } }
  });

  // wire filter bar events
  const gFromSel  = document.getElementById('grants-ov-from');
  const gToSel    = document.getElementById('grants-ov-to');
  const gResetBtn = document.getElementById('grants-ov-reset');
  if (gFromSel)  gFromSel.addEventListener('change',  () => { _grantsOvFromY = +gFromSel.value; if (_grantsOvFromY > _grantsOvToY) _grantsOvToY = _grantsOvFromY; renderGrantsOverview(); });
  if (gToSel)    gToSel.addEventListener('change',    () => { _grantsOvToY   = +gToSel.value;   if (_grantsOvToY < _grantsOvFromY) _grantsOvFromY = _grantsOvToY; renderGrantsOverview(); });
  if (gResetBtn) gResetBtn.addEventListener('click',  () => { _grantsOvFromY = minGY; _grantsOvToY = maxGY; renderGrantsOverview(); });
}

function renderGrantsTable() {
  const rows  = getGrantsList();
  const q     = document.getElementById('grants-search').value.trim();
  const total = Math.max(1, Math.ceil(rows.length/PAGE_SIZE));
  pageState.grants = Math.min(pageState.grants, total);
  const start = (pageState.grants-1)*PAGE_SIZE;
  const page  = rows.slice(start, start+PAGE_SIZE);
  document.getElementById('grants-count').textContent =
    `${rows.length.toLocaleString()} grants${q?` matching "${q}"`:''}`;
  document.getElementById('grants-pagination').innerHTML = paginHTML(total, pageState.grants, 'grants');

  document.getElementById('grants-tbody').innerHTML = page.length
    ? page.map((g,i) => {
        const isIntl   = (g.level||'').toUpperCase().includes('INT');
        const isActive = (g.status||'').toUpperCase()==='ACTIVE';
        return `<tr>
          <td class="muted">${start+i+1}</td>
          <td class="clip" title="${esc(g.title)}">${esc(g.title||'(no title)')}</td>
          <td>${isIntl ? '<span class="badge badge-intl">Intl</span>' : '<span class="badge badge-natl">Natl</span>'}</td>
          <td class="clip" style="max-width:180px" title="${esc(g.grant_name)}">${esc(g.grant_name||'')}</td>
          <td>${esc(g.role||'')}</td>
          <td style="white-space:nowrap">${esc(String(g.year_start||''))}</td>
          <td style="white-space:nowrap">${esc(String(g.year_end||''))}</td>
          <td class="r" style="white-space:nowrap">${g.cost ? fmtRM(g.cost) : '<span style="color:var(--text3)">--</span>'}</td>
          <td>${isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-done">Done</span>'}</td>
          <td style="white-space:nowrap">${esc(g.name||'')}</td>
        </tr>`;
      }).join('')
    : `<tr><td class="empty" colspan="10">No grants match the current filters.</td></tr>`;
}
