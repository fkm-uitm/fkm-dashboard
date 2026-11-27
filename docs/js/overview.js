'use strict';

// ── OVERVIEW ───────────────────────────────────────────────────────────────
function renderOverview(s) {
  SUMMARY = s;
  if (PUBS.length) buildOvRangeSelects();
  renderOvPeriodNote();

  const hVals   = STAFF.map(x => x.h_scopus).filter(v => v != null && v > 0);
  const hMax    = hVals.length ? Math.max(...hVals) : 0;
  const hMedian = hVals.length ? [...hVals].sort((a,b)=>a-b)[Math.floor(hVals.length/2)] : 0;

  const { filteredPubs, filteredGrants } = getOvFilteredData();
  // deduplicate by ref to count unique papers (a pub shared by multiple authors = 1 paper)
  const uniqueRefs    = p => p.ref || p.title; // fall back to title if no ref
  const SWE_IDX = new Set(['SCOPUS', 'WEB OF SCIENCE', 'ERA']);
  const uniqIndexed   = new Set(filteredPubs.filter(p =>  p.indexed).map(uniqueRefs));
  const uniqSWE       = new Set(filteredPubs.filter(p =>  p.indexed && SWE_IDX.has(p.index_name)).map(uniqueRefs));
  const uniqOther     = new Set(filteredPubs.filter(p => !p.indexed).map(uniqueRefs));
  const indexedCount  = uniqIndexed.size;
  const sweCount      = uniqSWE.size;
  const otherCount    = uniqOther.size;
  const activeGrants = filteredGrants.filter(g => g.status && g.status.toUpperCase() === 'ACTIVE').length;
  const totalAcquisition = filteredGrants.reduce((sum, g) => sum + (g.cost ? +g.cost : 0), 0);

  document.getElementById('kpi-row1').innerHTML = [
    kpi('Avg H-Index (Scopus)',  s.h_scopus_avg ?? '--', `Max: ${hMax}, Median: ${hMedian}`, '#7c3aed', 'chart'),
    kpi('Indexed publications',  num(sweCount),          `Scopus/WoS/ERA · ${num(indexedCount)} incl. MyCite`, '#0891b2', 'doc'),
    kpi('Other publications',    num(otherCount),        'Non-indexed / proceedings',    '#059669', 'docs'),
    kpi('Total publications',    num(indexedCount+otherCount),'All publication types (unique)',  '#d97706', 'sum'),
  ].join('');

  const acqLabel = totalAcquisition > 0 ? 'RM ' + totalAcquisition.toLocaleString('en-MY') : '--';
  document.getElementById('kpi-row2').innerHTML = [
    kpi('Active grants',      num(activeGrants),              `of ${num(filteredGrants.length)} total`, '#16a34a', 'beaker'),
    kpi('Total grants',       num(filteredGrants.length),     'All levels and statuses',                '#dc2626', 'money'),
    kpi('Grant cost',         acqLabel,                       'Self-reported total acquisition',        '#0891b2', 'handshake'),
    kpi('PhD supervision',    num(s.phd_total),               'Graduated and ongoing',                  '#7c3aed', 'cap'),
    kpi('Master supervision', num(s.master_total),            'Graduated and ongoing',                  '#2563eb', 'cap'),
  ].join('');

  drawCharts();
}

// ── CHARTS ─────────────────────────────────────────────────────────────────
const HINDEX_BINS = [
  { label: '0 / N/A', min: null, max: 0 },
  { label: '1 to 5',  min: 1,    max: 5 },
  { label: '6 to 10', min: 6,    max: 10 },
  { label: '11 to 15',min: 11,   max: 15 },
  { label: '16 to 20',min: 16,   max: 20 },
  { label: '21+',     min: 21,   max: Infinity },
];
const GRANT_SEGMENTS = ['Intl Active','Intl Completed','Natl Active','Natl Completed'];
const GRANT_KEYS     = ['intl_active','intl_completed','natl_active','natl_completed'];

function getActiveHIndexBin() {
  if (!xf.staff_hindex) return -1;
  return HINDEX_BINS.findIndex(b => b.label === xf.staff_hindex.label);
}

function drawCharts() {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size   = 12;
  Chart.defaults.color       = cssVar('--axis');
  Chart.defaults.borderColor = cssVar('--grid');

  // H-index distribution
  const activeBin = getActiveHIndexBin();
  const bins = HINDEX_BINS.map((b,i) => {
    if (b.min === null) return STAFF.filter(s => !s.h_scopus || s.h_scopus === 0).length;
    return STAFF.filter(s => s.h_scopus >= b.min && s.h_scopus <= b.max).length;
  });
  const hColors = bins.map((_,i) => i === activeBin ? '#1d4ed8' : '#93c5fd');
  barChart('chart-hindex', HINDEX_BINS.map(b=>b.label), bins, hColors, true, (idx) => {
    const b = HINDEX_BINS[idx];
    xf.staff_hindex = (xf.staff_hindex && xf.staff_hindex.label === b.label) ? null : { label: b.label, min: b.min, max: b.max };
    pageState.staff = 1;
    renderStaffTable();
    updateXfBadge('staff-xf-badge', xf.staff_hindex ? `H-Index: ${b.label}` : null, () => {
      xf.staff_hindex = null; pageState.staff=1; renderStaffTable(); drawCharts();
    });
    drawCharts();
  });

  // Publications donut — uses filtered data
  const { filteredPubs: ovPubs, filteredGrants: ovGrants } = getOvFilteredData();
  const idx   = ovPubs.filter(p => p.indexed).length;
  const other = ovPubs.filter(p => !p.indexed).length;
  donutChart('chart-pubs-type', ['Indexed','Other'], [idx, other], ['#2563eb','#f59e0b'], (segIdx) => {
    const val = segIdx === 0 ? 'indexed' : 'other';
    xf.pubs_type = xf.pubs_type === val ? null : val;
    pageState.pubs = 1;
    renderPubsTable();
    updateXfBadge('pubs-xf-badge', xf.pubs_type ? `Type: ${xf.pubs_type}` : null, () => {
      xf.pubs_type=null; pageState.pubs=1; renderPubsTable();
      updateXfBadge('pubs-xf-badge', null, null);
    });
  });

  // Grants bar — uses filtered data
  const gVals = [
    ovGrants.filter(g => g.level && g.level.toUpperCase().includes('INTERNATIONAL') && g.status && g.status.toUpperCase() === 'ACTIVE').length,
    ovGrants.filter(g => g.level && g.level.toUpperCase().includes('INTERNATIONAL') && g.status && g.status.toUpperCase() !== 'ACTIVE').length,
    ovGrants.filter(g => (!g.level || !g.level.toUpperCase().includes('INTERNATIONAL')) && g.status && g.status.toUpperCase() === 'ACTIVE').length,
    ovGrants.filter(g => (!g.level || !g.level.toUpperCase().includes('INTERNATIONAL')) && g.status && g.status.toUpperCase() !== 'ACTIVE').length,
  ];
  const gColors = gVals.map((_,i) => GRANT_KEYS[i] === xf.grants_key ? '#1d4ed8' :
    ['#2563eb','#93c5fd','#f59e0b','#fcd34d'][i]);
  barChart('chart-grants', GRANT_SEGMENTS, gVals, gColors, true, (idx) => {
    const key = GRANT_KEYS[idx];
    xf.grants_key = xf.grants_key === key ? null : key;
    if (xf.grants_key) {
      document.getElementById('grants-filter-level').value  = xf.grants_key.startsWith('intl') ? 'international' : 'national';
      document.getElementById('grants-filter-status').value = xf.grants_key.endsWith('active') ? 'active' : 'completed';
    } else {
      document.getElementById('grants-filter-level').value  = '';
      document.getElementById('grants-filter-status').value = '';
    }
    pageState.grants = 1;
    renderGrantsTable();
    updateXfBadge('grants-xf-badge', xf.grants_key ? GRANT_SEGMENTS[idx] : null, () => {
      xf.grants_key = null;
      document.getElementById('grants-filter-level').value  = '';
      document.getElementById('grants-filter-status').value = '';
      pageState.grants=1; renderGrantsTable(); drawCharts();
      updateXfBadge('grants-xf-badge', null, null);
    });
  });

  // Supervision bar
  const pg = STAFF.reduce((a,s) => a+(s.phd_graduated||0), 0);
  const po = STAFF.reduce((a,s) => a+(s.phd_ongoing||0), 0);
  const mg = STAFF.reduce((a,s) => a+(s.master_graduated||0), 0);
  const mo = STAFF.reduce((a,s) => a+(s.master_ongoing||0), 0);
  barChart('chart-supervision',
    ['PhD Graduated','PhD Ongoing','Master Graduated','Master Ongoing'],
    [pg, po, mg, mo],
    ['#2563eb','#93c5fd','#f59e0b','#fcd34d'],
    false, null);

  drawPubTrendChart();
  drawDeptChart();
  _wireOvControls();

  // Top 15 horizontal bar — uses filtered pubs data
  const pubCountBySlug = new Map();
  for (const p of ovPubs) { if (p.indexed) pubCountBySlug.set(p.slug, (pubCountBySlug.get(p.slug)||0)+1); }
  const top15 = [...STAFF].filter(s => (pubCountBySlug.get(s.slug)||0) > 0)
    .sort((a,b) => (pubCountBySlug.get(b.slug)||0) - (pubCountBySlug.get(a.slug)||0)).slice(0,15);
  const labels = top15.map(s => {
    const p = (s.name||'').split(' ').filter(Boolean);
    return p.length > 2 ? p[0] + ' ' + p[p.length-1] : s.name;
  });
  hbarChart('chart-top-pubs', labels, top15.map(s => pubCountBySlug.get(s.slug)||0), '#2563eb', (idx) => {
    showPage('staff');
    setTimeout(() => openStaffProfile(top15[idx].slug), 60);
  });
}

function updateXfBadge(id, label, onClear) {
  const el = document.getElementById(id);
  if (!label) { el.className = ''; el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.className = 'cross-filter-active';
  el.innerHTML = `${esc(label)} <button class="cross-filter-clear" aria-label="Clear filter">&times;</button>`;
  el.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); onClear(); });
}

function barChart(id, labels, data, colors, clickable, onClick) {
  const el = document.getElementById(id); if (!el) return;
  const bg = Array.isArray(colors) ? colors : data.map(() => colors);
  const existing = charts.get(id);
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: bg, borderRadius: 5, maxBarThickness: 52 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.raw}` } },
        datalabels: { anchor: 'end', align: 'top', color: cssVar('--text2'), font: { size: 11, weight: '600' }, formatter: v => v > 0 ? v : '' },
      },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
      onClick: clickable && onClick ? (_e, elements) => { if (elements.length) onClick(elements[0].index); } : undefined,
    }
  };
  if (clickable) el.style.cursor = 'pointer'; else el.style.cursor = '';
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = data;
    existing.data.datasets[0].backgroundColor = bg;
    existing.update('none');
  } else {
    charts.set(id, new Chart(el, cfg));
  }
}

function donutChart(id, labels, data, colors, onClick) {
  const el = document.getElementById(id); if (!el) return;
  const existing = charts.get(id);
  const lbl = labels.map((l,i) => `${l} (${data[i].toLocaleString('en-MY')})`);
  const cfg = {
    type: 'doughnut',
    data: { labels: lbl, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, cutout: '62%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 16, color: cssVar('--text') } },
        tooltip: { callbacks: { label: c => ` ${c.raw.toLocaleString('en-MY')}` } },
        datalabels: { color: '#fff', font: { size: 12, weight: '600' }, formatter: v => v > 0 ? v.toLocaleString('en-MY') : '' },
      },
      onClick: onClick ? (_e, elements) => { if (elements.length) onClick(elements[0].index); } : undefined,
    }
  };
  if (onClick) el.style.cursor = 'pointer';
  if (existing) {
    existing.data.labels = lbl;
    existing.data.datasets[0].data = data;
    existing.update('none');
  } else {
    charts.set(id, new Chart(el, cfg));
  }
}

function hbarChart(id, labels, data, color, onClick) {
  const el = document.getElementById(id); if (!el) return;
  const existing = charts.get(id);
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4, maxBarThickness: 20 }] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.raw} indexed pubs` } },
        datalabels: { anchor: 'end', align: 'right', color: cssVar('--text2'), font: { size: 11, weight: '600' }, formatter: v => v > 0 ? v : '' },
      },
      layout: { padding: { right: 30 } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } },
      onClick: onClick ? (_e, elements) => { if (elements.length) onClick(elements[0].index); } : undefined,
    }
  };
  if (onClick) el.style.cursor = 'pointer';
  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = data;
    existing.update('none');
  } else {
    charts.set(id, new Chart(el, cfg));
  }
}

// ── Publication trend state ─────────────────────────────────────────────────
let ovTrendMode  = 'swe';  // 'swe' | 'all'
let deptPerStaff = false;
let _ovControlsWired = false;

// Wire toggle controls once after the overview DOM is rendered
function _wireOvControls() {
  if (_ovControlsWired) return;
  _ovControlsWired = true;

  document.getElementById('pub-trend-toggle')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-trend]');
    if (!btn) return;
    ovTrendMode = btn.dataset.trend;
    document.querySelectorAll('#pub-trend-toggle .chart-toggle')
      .forEach(b => b.classList.toggle('active', b.dataset.trend === ovTrendMode));
    drawPubTrendChart();
  });

  document.getElementById('dept-per-staff')?.addEventListener('change', e => {
    deptPerStaff = e.target.checked;
    drawDeptChart();
  });
}

// ── Publication trend by year ───────────────────────────────────────────────
function drawPubTrendChart() {
  const SWE = new Set(['SCOPUS', 'WEB OF SCIENCE', 'ERA']);
  const TYPES = new Set(['JOURNAL', 'PROCEEDING']);
  const yrSwe = new Map(), yrAll = new Map();

  for (const p of PUBS) {
    if (!p.indexed || !TYPES.has((p.type||'').toUpperCase())) continue;
    const title = (p.title||'').trim().toLowerCase();
    const yr = (p.date||'').slice(0, 4);
    if (!title || !yr || yr < '2015') continue;
    if (!yrAll.has(yr)) yrAll.set(yr, new Set());
    yrAll.get(yr).add(title);
    if (SWE.has(p.index_name)) {
      if (!yrSwe.has(yr)) yrSwe.set(yr, new Set());
      yrSwe.get(yr).add(title);
    }
  }

  const years = [...new Set([...yrSwe.keys(), ...yrAll.keys()])].sort();
  const dataSwe = years.map(y => yrSwe.get(y)?.size || 0);
  const dataAll = years.map(y => yrAll.get(y)?.size || 0);
  const data  = ovTrendMode === 'swe' ? dataSwe : dataAll;
  const color = ovTrendMode === 'swe' ? '#2563eb' : '#7c3aed';

  const id = 'chart-pub-trend';
  const el = document.getElementById(id); if (!el) return;
  const existing = charts.get(id);
  if (existing) {
    existing.data.labels = years;
    existing.data.datasets[0].data = data;
    existing.data.datasets[0].backgroundColor = data.map(() => color);
    existing.update('none');
  } else {
    charts.set(id, new Chart(el, {
      type: 'bar',
      data: { labels: years, datasets: [{ data, backgroundColor: color, borderRadius: 4, maxBarThickness: 48 }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${c.raw} unique titles` } },
          datalabels: { anchor: 'end', align: 'top', color: cssVar('--text2'), font: { size: 11, weight: '600' }, formatter: v => v > 0 ? v : '' },
        },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
      }
    }));
  }
}

// ── Department activity ─────────────────────────────────────────────────────
function drawDeptChart() {
  const deptMap = new Map();
  for (const s of STAFF) {
    const d = s.department || 'Unknown';
    if (!deptMap.has(d)) deptMap.set(d, { staff: 0, pubs: 0, grants: 0, sv: 0 });
    const r = deptMap.get(d);
    r.staff++;
    r.pubs   += s.pubs_scopus_wos_era || 0;
    r.grants += s.grants_active || 0;
    r.sv     += (s.phd_ongoing || 0) + (s.master_ongoing || 0);
  }

  const depts = [...deptMap.entries()]
    .filter(([,r]) => r.staff > 0)
    .sort((a, b) => b[1].pubs - a[1].pubs)
    .slice(0, 12);

  const labels     = depts.map(([d, r]) => `${d} (${r.staff})`);
  const pubsData   = depts.map(([, r]) => deptPerStaff ? +(r.pubs   / r.staff).toFixed(1) : r.pubs);
  const grantsData = depts.map(([, r]) => deptPerStaff ? +(r.grants / r.staff).toFixed(2) : r.grants);
  const svData     = depts.map(([, r]) => deptPerStaff ? +(r.sv     / r.staff).toFixed(2) : r.sv);

  const id = 'chart-dept';
  const el = document.getElementById(id); if (!el) return;
  const existing = charts.get(id);

  if (existing) {
    existing.data.labels = labels;
    existing.data.datasets[0].data = pubsData;
    existing.data.datasets[1].data = grantsData;
    existing.data.datasets[2].data = svData;
    existing.update('none');
  } else {
    charts.set(id, new Chart(el, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Indexed pubs (SWE)', data: pubsData,   backgroundColor: '#2563eb', borderRadius: 3, maxBarThickness: 14 },
          { label: 'Active grants',      data: grantsData,  backgroundColor: '#16a34a', borderRadius: 3, maxBarThickness: 14 },
          { label: 'Students (ongoing)', data: svData,      backgroundColor: '#f59e0b', borderRadius: 3, maxBarThickness: 14 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, color: cssVar('--text'), font: { size: 12 } } },
          tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${c.raw}` } },
          datalabels: { display: false },
        },
        layout: { padding: { right: 10 } },
        scales: {
          x: { beginAtZero: true, ticks: { precision: 0 } },
          y: { grid: { display: false } },
        },
      }
    }));
  }
}
