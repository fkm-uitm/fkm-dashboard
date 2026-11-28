'use strict';

// ── PAGINATION ─────────────────────────────────────────────────────────────
function paginHTML(total, current, key) {
  if (total <= 1) return '';
  let html = `<span class="pg-info">Page ${current} of ${total}</span>`;
  if (current > 1) html += `<button class="page-btn" data-page="${key}:${current-1}">Prev</button>`;
  for (let p = Math.max(1,current-2); p <= Math.min(total,current+2); p++) {
    html += `<button class="page-btn" data-page="${key}:${p}"${p===current?' aria-current="page"':''}>${p}</button>`;
  }
  if (current < total) html += `<button class="page-btn" data-page="${key}:${current+1}">Next</button>`;
  return html;
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
const PAGE_TITLES = { overview:'Overview', pubs:'Publications', grants:'Grants', staff:'Staff Profiles', report:'Progress Report', about:'About' };

function showPage(id) {
  document.querySelectorAll('.nav-item').forEach(b => {
    const on = b.dataset.page === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  document.querySelectorAll('[id^="page-"]').forEach(p => { p.hidden = p.id !== 'page-' + id; });
  document.getElementById('topbar-title').textContent = PAGE_TITLES[id] || id;
  if (id === 'overview') setTimeout(drawCharts, 50);
  if (id === 'report')   initReportPage();
  if (id === 'about')  { showAboutStats(); showFlaggedStaff(); }
  if (id === 'pubs')   { renderPubsTable(); setTimeout(renderPubsOverview, 50); setTimeout(renderPubsQuality, 100); }
  if (id === 'grants') { renderGrantsTable(); setTimeout(renderGrantsOverview, 50); }
  closeSidebar();
}

const FLAGGED_STAFF = [
  { name:'ABDUL GHALIB @ THAM HOCK KHAN', id:'242981', pos:'PENSYARAH KANAN (KONTRAK 29000)',       reason:'Contract — may have left' },
  { name:'ABDUL RAHMAN BIN OMAR',          id:'373850', pos:'PROFESOR KHAS',                         reason:'Profesor Khas — no portal account' },
  { name:'ADAM TAN BIN MOHD AMIN',         id:'277367', pos:'PENSYARAH',                             reason:'No Expert Portal profile found' },
  { name:'AHMAD AZLAN BIN MAT ISA',        id:'98410',  pos:'PROFESOR',                              reason:'Old staff ID — likely retired' },
  { name:'AHMAD YUSRI BIN ISMAIL',         id:'253598', pos:'PENSYARAH',                             reason:'No Expert Portal profile found' },
  { name:'PROF IR DR HJ AHMED JAFFAR',     id:'90019593',pos:'PENSYARAH SAMBILAN',                   reason:'Part-time (Sambilan) — no portal' },
  { name:'ARMANSYAH',                      id:'287425', pos:'PENSYARAH KANAN (KONTRAK B.W. NEGARA)', reason:'Foreign contract — no portal' },
  { name:'CHE FARIDAH BINTI MAT TAIB',     id:'148085', pos:'PENSYARAH KANAN',                       reason:'Old staff ID — likely retired' },
  { name:'HAMIDUN BIN MD ISA',             id:'134002', pos:'PENSYARAH',                             reason:'Old staff ID — likely retired' },
  { name:'HAYDER M. A. ALI AL-ASSADI',     id:'254610', pos:'PROFESOR MADYA (KONTRAK B.W. NEGARA)',  reason:'Foreign contract — no portal' },
  { name:'ISMAIL NASIRUDDIN BIN AHMAD',    id:'355043', pos:'PROFESOR MADYA KHAS',                   reason:'Profesor Madya Khas — no portal' },
  { name:'JUNAIDAH BINTI RAHMAD',          id:'140054', pos:'PENSYARAH',                             reason:'Old staff ID — likely retired' },
  { name:'LOO HUCK SOO',                   id:'119962', pos:'PROFESOR MADYA',                        reason:'Old staff ID — likely retired' },
  { name:'LOW CHENG YEE',                  id:'190305', pos:'PROFESOR MADYA',                        reason:'No Expert Portal profile found' },
  { name:'LUTHFFI IDZHAR BIN ISMAIL',      id:'309060', pos:'PENSYARAH (SEMENTARA)',                  reason:'Temporary post — no portal' },
  { name:'MOHAMAD AKBAR NOOR MOHAMAD NOOR',id:'90047526',pos:'PENSYARAH SAMBILAN',                   reason:'Part-time (Sambilan) — no portal' },
  { name:'MOHAMAD NOR BIN BERHAN',         id:'100230', pos:'PROFESOR',                              reason:'Old staff ID — likely retired' },
  { name:'MOHD ADAM MOHD SAID',            id:'90044010',pos:'PENSYARAH SAMBILAN',                   reason:'Part-time (Sambilan) — no portal' },
  { name:'MOHD KHALID BIN HASSAN',         id:'107550', pos:'PROFESOR MADYA',                        reason:'Old staff ID — likely retired' },
  { name:'MOHD MANSOR BIN SALLEH',         id:'90027594',pos:'PENSYARAH SAMBILAN',                   reason:'Part-time (Sambilan) — no portal' },
  { name:'MOHD YUSUFF BIN MOHD',           id:'32285',  pos:'PROFESOR MADYA',                        reason:'Very old staff ID — retired' },
  { name:'NOR AMALINA BT NORDIN',          id:'177289', pos:'PENSYARAH KANAN',                       reason:'No Expert Portal profile found' },
  { name:'NORHISYAM BIN JENAL',            id:'296979', pos:'PENSYARAH MUDA (SEMENTARA)',             reason:'Temporary post — no portal' },
  { name:'NORIAH BINTI YUSOFF',            id:'247313', pos:'PROFESOR MADYA',                        reason:'No Expert Portal profile found' },
  { name:'OW CHEE SHENG (DATUK PROF.)',    id:'194000', pos:'PROFESOR (KONTRAK 29000)',               reason:'Contract — may have left' },
  { name:'RAHANI BINTI ABDUL RAHMAN',      id:'269566', pos:'PENSYARAH',                             reason:'No Expert Portal profile found' },
  { name:'RAHIM BIN ATAN',                 id:'78689',  pos:'PROFESOR MADYA',                        reason:'Old staff ID — likely retired' },
  { name:'RAZALI BIN HASSAN',              id:'270571', pos:'PENSYARAH KANAN',                       reason:'No Expert Portal profile found' },
  { name:'ROSELEENA BINTE JAAFAR',         id:'189714', pos:'PROFESOR MADYA (KONTRAK B.W. NEGARA)',  reason:'Foreign contract — no portal' },
  { name:'SUHAIME BIN SAPARI',             id:'142010', pos:'PENSYARAH',                             reason:'Old staff ID — likely retired' },
  { name:'SUNHAJI B HAJI KIYAI ABAS',      id:'40824',  pos:'PROFESOR MADYA',                        reason:'Very old staff ID — retired' },
  { name:'UMI KALSOM BINTI AHMAD',         id:'261784', pos:'PENSYARAH MUDA (SEMENTARA)',             reason:'Temporary post — no portal' },
  { name:'WAN MAZLINA BINTI WAN MOHAMED',  id:'176840', pos:'PROFESOR MADYA',                        reason:'Confirmed retired (Selamat Bersara, 04.09.2026)' },
  { name:"YA'KUB B MD TAIB",              id:'72685',  pos:'PROFESOR MADYA KHAS',                   reason:'Old staff ID — likely retired' },
  { name:'ZAINUDDIN BIN MOHAMAD',          id:'77321',  pos:'PENSYARAH',                             reason:'Old staff ID — likely retired' },
];

function showFlaggedStaff() {
  const tbody = document.getElementById('about-flagged-tbody');
  if (!tbody) return;
  const reasonColors = {
    'Confirmed retired': '#dc2626',
    'Very old': '#d97706',
    'Old staff': '#d97706',
    'Part-time': '#7c3aed',
    'Foreign contract': '#0891b2',
    'Profesor Khas': '#059669',
    'Temporary': '#64748b',
    'Contract': '#64748b',
    'No Expert': '#94a3b8',
  };
  function reasonColor(r) {
    for (const [k, c] of Object.entries(reasonColors)) {
      if (r.startsWith(k)) return c;
    }
    return 'var(--text3)';
  }
  tbody.innerHTML = FLAGGED_STAFF.map((s, i) => `
    <tr style="background:${i%2===0?'var(--surface)':'var(--surface2)'}">
      <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text);font-weight:500">${esc(s.name)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text2);font-variant-numeric:tabular-nums">${esc(s.id)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text2)">${esc(s.pos)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid var(--border);color:${reasonColor(s.reason)};font-size:11px;font-weight:600">${esc(s.reason)}</td>
    </tr>`).join('');
}

function showAboutStats() {
  const el = document.getElementById('about-stats');
  if (!el) return;
  if (!SUMMARY.staff_count) {
    el.innerHTML = '<p style="color:var(--text2);font-size:13px">Data not yet loaded.</p>';
    return;
  }
  const kpis = [
    { v: num(SUMMARY.staff_count),              k: 'Academic Staff',           s: 'UiTM Expert records' },
    { v: num(SUMMARY.pubs_scopus_wos_era_total),k: 'Scopus / WoS / ERA',      s: 'All-time unique publications' },
    { v: num(SUMMARY.grants_active),            k: 'Active Grants',            s: `of ${num(SUMMARY.grants_total)} total` },
    { v: SUMMARY.h_scopus_avg ?? '—',           k: 'Mean Scopus h-index',      s: 'Staff with Scopus profiles' },
    { v: num(SUMMARY.phd_total),                k: 'PhD Students',             s: 'Graduated and ongoing' },
    { v: num(SUMMARY.master_total),             k: "Master's Students",        s: 'Graduated and ongoing' },
    { v: num(SUMMARY.consultancy_total),        k: 'Consultancy Projects',     s: 'Completed projects' },
  ];
  el.innerHTML =
    `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px">` +
    kpis.map(k => `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px 16px">
      <div style="font:700 24px/1 'Inter',system-ui,sans-serif;color:var(--brand);font-variant-numeric:tabular-nums">${esc(String(k.v))}</div>
      <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:5px;line-height:1.3">${esc(k.k)}</div>
      <div style="font-size:11px;color:var(--text2);margin-top:3px">${esc(k.s)}</div>
    </div>`).join('') +
    `</div>` +
    `<p style="margin:12px 0 0;font-size:12px;color:var(--text3)">Last updated ${esc(SUMMARY.generated || 'unknown')}. Source: UiTM Expert Portal.</p>`;
}

document.querySelectorAll('.nav-item').forEach(b => {
  b.addEventListener('click', () => showPage(b.dataset.page));
});

// ── MOBILE ─────────────────────────────────────────────────────────────────
function closeSidebar() {
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('open');
    document.getElementById('hamburger').setAttribute('aria-expanded', 'false');
  }
}
document.getElementById('hamburger').addEventListener('click', () => {
  const open = document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open', open);
  document.getElementById('hamburger').setAttribute('aria-expanded', open);
});

// ── DESKTOP SIDEBAR COLLAPSE ───────────────────────────────────────
(function() {
  const btn = document.getElementById('sidebar-collapse');
  if (!btn) return;
  const STORAGE_KEY = 'fkm-sidebar-collapsed';
  // Restore saved state
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    document.body.classList.add('sidebar-collapsed');
    btn.setAttribute('aria-label', 'Expand sidebar');
    btn.title = 'Expand sidebar';
  }
  btn.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('sidebar-collapsed');
    btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    btn.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch(e) {}
    // Redraw any visible charts after transition
    setTimeout(() => window.dispatchEvent(new Event('resize')), 280);
  });
}());
document.getElementById('overlay').addEventListener('click', closeSidebar);

// ── GLOBAL DELEGATION ──────────────────────────────────────────────────────
document.addEventListener('click', e => {
  // Staff name button (not inside pub drawer)
  const nb = e.target.closest('.staff-card-name[data-slug]');
  if (nb && !nb.closest('#pub-drawer-body')) {
    return openStaffProfile(nb.dataset.slug);
  }
  if (nb && nb.closest('#pub-drawer-body')) {
    closePubDrawer();
    showPage('staff');
    setTimeout(() => openStaffProfile(nb.dataset.slug), 80);
    return;
  }

  // Detail drawer buttons
  const tb = e.target.closest('[data-pubidx]');
  if (tb) return openPubDrawer(+tb.dataset.pubidx);
  const gb = e.target.closest('[data-grantidx]');
  if (gb) return openGrantDrawer(+gb.dataset.grantidx);
  const sb = e.target.closest('[data-svidx]');
  if (sb) return openSvDrawer(+sb.dataset.svidx);
  const cb = e.target.closest('[data-conidx]');
  if (cb) return openConDrawer(+cb.dataset.conidx);

  // Pagination
  const pb = e.target.closest('[data-page]');
  if (pb && pb.closest('.pagination')) {
    const [key, p] = pb.dataset.page.split(':');
    pageState[key] = +p;
    if (key==='staff')  renderStaffTable();
    if (key==='matrix') { matrixPage = +p; renderMatrixTable(); }
    if (key==='pubs')   renderPubsTable();
    if (key==='grants') renderGrantsTable();
    pb.closest('.tbl-card')?.scrollIntoView({ block:'start' });
  }
});

// ── SUB-TAB SWITCHING ──────────────────────────────────────────────────────
document.querySelectorAll('.sub-tabs').forEach(tabs => {
  tabs.addEventListener('click', e => {
    const btn = e.target.closest('[data-subtab]');
    if (!btn) return;
    const targetId = btn.dataset.subtab;
    // update tab buttons
    tabs.querySelectorAll('.sub-tab').forEach(b => {
      const active = b.dataset.subtab === targetId;
      b.classList.toggle('active', active);
      b.setAttribute('aria-selected', active);
    });
    // show/hide panels within the same page
    const page = tabs.closest('[id^="page-"]');
    page.querySelectorAll('[role="tabpanel"]').forEach(p => {
      p.hidden = p.id !== targetId;
    });
    // render hooks for lazy sub-tabs
    if (targetId === 'pubs-quality')   setTimeout(renderPubsQuality, 50);
    if (targetId === 'about-extraction') showFlaggedStaff();
  });
});

// ── FILTER EVENTS ──────────────────────────────────────────────────────────
document.getElementById('staff-search').addEventListener('input',          () => { pageState.staff=1;  renderStaffTable(); });
document.getElementById('staff-sort').addEventListener('change',           () => { pageState.staff=1;  renderStaffTable(); });
document.getElementById('staff-position').addEventListener('change',       () => { pageState.staff=1;  renderStaffTable(); });

// Staff subpage tabs
document.querySelector('.staff-subpage-tabs').addEventListener('click', e => {
  const tab = e.target.closest('[data-stafftab]'); if (!tab) return;
  const key = tab.dataset.stafftab;
  document.querySelectorAll('.staff-subpage-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.stafftab === key);
    t.setAttribute('aria-selected', t.dataset.stafftab === key ? 'true' : 'false');
  });
  document.getElementById('staff-subpage-profiles').hidden = key !== 'profiles';
  document.getElementById('staff-subpage-matrix').hidden   = key !== 'matrix';
  if (key === 'matrix') renderMatrixTable();
});

// Matrix search + sort header
document.getElementById('matrix-search').addEventListener('input', () => { matrixPage=1; renderMatrixTable(); });
document.getElementById('matrix-thead').addEventListener('click', e => {
  const th = e.target.closest('th.sortable'); if (!th) return;
  const key = th.dataset.sort;
  if (matrixSort.key === key) matrixSort.dir *= -1;
  else { matrixSort.key = key; matrixSort.dir = 1; }
  matrixPage = 1;
  renderMatrixTable();
});

// Matrix pagination (delegated via global click handler below)
document.getElementById('pubs-search').addEventListener('input',           () => { pageState.pubs=1;   renderPubsTable(); });
document.getElementById('pubs-filter-type').addEventListener('change',     () => { pageState.pubs=1;   renderPubsTable(); });
document.getElementById('pubs-year-from').addEventListener('change',       () => { pageState.pubs=1;   renderPubsTable(); });
document.getElementById('pubs-year-to').addEventListener('change',         () => { pageState.pubs=1;   renderPubsTable(); });
document.getElementById('grants-search').addEventListener('input',         () => { pageState.grants=1; renderGrantsTable(); });
document.getElementById('grants-filter-level').addEventListener('change',  () => { xf.grants_key=null; pageState.grants=1; renderGrantsTable(); });
document.getElementById('grants-filter-status').addEventListener('change', () => { xf.grants_key=null; pageState.grants=1; renderGrantsTable(); });
document.getElementById('grants-year-from').addEventListener('change',     () => { pageState.grants=1; renderGrantsTable(); });
document.getElementById('grants-year-to').addEventListener('change',       () => { pageState.grants=1; renderGrantsTable(); });

// Staff card grid click handler
document.getElementById('staff-grid').addEventListener('click', e => {
  const card = e.target.closest('[data-slug]');
  if (card) openStaffProfile(card.dataset.slug);
});
document.getElementById('staff-grid').addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('.staff-card');
    if (card) { e.preventDefault(); openStaffProfile(card.dataset.slug); }
  }
});

// Sortable table headers (pubs + grants only now)
document.getElementById('pubs-thead').addEventListener('click',
  makeSortHandler('pubs', 'pubs-thead', () => { pageState.pubs=1; renderPubsTable(); }));
document.getElementById('grants-thead').addEventListener('click',
  makeSortHandler('grants', 'grants-thead', () => { pageState.grants=1; renderGrantsTable(); }));

// ── BOOT ───────────────────────────────────────────────────────────────────
Chart.register(ChartDataLabels);

// Overview range filter — 4 separate selects
function _readOvSelects() {
  const fm = +document.getElementById('ov-from-m').value;
  const fy = +document.getElementById('ov-from-y').value;
  const tm = +document.getElementById('ov-to-m').value;
  const ty = +document.getElementById('ov-to-y').value;
  ovFromYM = fy*100+fm;
  ovToYM   = ty*100+tm;
  if (ovFromYM > ovToYM) ovToYM = ovFromYM;
}
['ov-from-m','ov-from-y','ov-to-m','ov-to-y'].forEach(id => {
  document.getElementById(id).addEventListener('change', () => { _readOvSelects(); renderOverview(SUMMARY); });
});
document.getElementById('ov-reset-range').addEventListener('click', () => {
  ovFromYM = 0; ovToYM = 0;
  buildOvRangeSelects();
  renderOverview(SUMMARY);
});

// Publications category filter
document.getElementById('pubs-filter-cat').addEventListener('change', () => {
  xf.pubs_type = null;
  updateXfBadge('pubs-xf-badge', null, null);
  pageState.pubs = 1;
  renderPubsTable();
});

// Grants role filter
document.getElementById('grants-filter-role').addEventListener('change', () => {
  pageState.grants = 1;
  renderGrantsTable();
});
