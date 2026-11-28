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
  if (id === 'about')    showAboutStats();
  if (id === 'pubs')   { renderPubsTable(); setTimeout(renderPubsOverview, 50); setTimeout(renderPubsQuality, 100); }
  if (id === 'grants') { renderGrantsTable(); setTimeout(renderGrantsOverview, 50); }
  closeSidebar();
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
    if (targetId === 'pubs-quality') setTimeout(renderPubsQuality, 50);
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
