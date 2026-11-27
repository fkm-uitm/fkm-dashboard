'use strict';

// ── STAFF ──────────────────────────────────────────────────────────────────
function getStaffList() {
  const q   = document.getElementById('staff-search').value.trim().toLowerCase();
  const pos = document.getElementById('staff-position').value;
  let rows  = [...STAFF];
  if (xf.staff_hindex) {
    const { min, max } = xf.staff_hindex;
    if (min === null) rows = rows.filter(s => !s.h_scopus || s.h_scopus === 0);
    else rows = rows.filter(s => s.h_scopus >= min && s.h_scopus <= max);
  }
  if (pos !== 'all') rows = rows.filter(s => normalisePosition(s.position) === pos);
  if (q) rows = rows.filter(s => (s.name||'').toLowerCase().includes(q));
  // Column header sort takes precedence; fall back to dropdown
  const colKey = tblSort.staff.key;
  if (colKey) {
    const dir = tblSort.staff.dir;
    rows.sort((a, b) => {
      let av, bv;
      if (colKey === 'h_scopus')    { av = a.h_scopus||0;      bv = b.h_scopus||0; }
      else if (colKey === 'pubs_indexed') { av = a.pubs_indexed||0; bv = b.pubs_indexed||0; }
      else if (colKey === 'pubs_other')   { av = a.pubs_other||0;   bv = b.pubs_other||0; }
      else if (colKey === 'grants_active'){ av = a.grants_active||0;bv = b.grants_active||0; }
      else if (colKey === 'grants_total') { av = a.grants_total||0; bv = b.grants_total||0; }
      else if (colKey === 'phd_grad')     { av = a.phd_graduated||0;bv = b.phd_graduated||0; }
      else if (colKey === 'msc_grad')     { av = a.master_graduated||0;bv = b.master_graduated||0; }
      else if (colKey === 'consultancy')  { av = a.consultancy_completed||0;bv = b.consultancy_completed||0; }
      else { av = String(a[colKey]||''); bv = String(b[colKey]||''); return dir * av.localeCompare(bv); }
      return dir * (av - bv);
    });
  } else {
    const key = document.getElementById('staff-sort').value;
    rows.sort((a,b) => {
      if (key==='name')         return (a.name||'').localeCompare(b.name||'');
      if (key==='h_scopus')     return (b.h_scopus||0)-(a.h_scopus||0);
      if (key==='pubs_indexed') return (b.pubs_indexed||0)-(a.pubs_indexed||0);
      if (key==='pubs_total')   return (b.pubs_total||0)-(a.pubs_total||0);
      if (key==='grants_total') return (b.grants_total||0)-(a.grants_total||0);
      if (key==='phd_total')    return ((b.phd_graduated||0)+(b.phd_ongoing||0))-((a.phd_graduated||0)+(a.phd_ongoing||0));
      if (key==='master_total') return ((b.master_graduated||0)+(b.master_ongoing||0))-((a.master_graduated||0)+(a.master_ongoing||0));
      return 0;
    });
  }
  return rows;
}

function populatePositionFilter() {
  const sel = document.getElementById('staff-position');
  const positions = [...new Set(STAFF.map(s => normalisePosition(s.position)).filter(Boolean))].sort();
  sel.innerHTML = `<option value="all">All Positions</option>` +
    positions.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
}

function normalisePosition(pos) {
  if (!pos) return '';
  const p = pos.toUpperCase().trim();
  if (p.includes('PROFESOR MADYA')) return 'Profesor Madya';
  if (p.includes('PROFESOR')) return 'Profesor';
  if (p.includes('PENSYARAH KANAN')) return 'Pensyarah Kanan';
  if (p.includes('PENSYARAH')) return 'Pensyarah';
  if (p.includes('TUTOR')) return 'Tutor';
  if (p.includes('FELO')) return 'Felo';
  return pos.charAt(0).toUpperCase() + pos.slice(1).toLowerCase();
}

function renderStaffTable() {
  const rows  = getStaffList();
  const q     = document.getElementById('staff-search').value.trim();
  const CARD_PAGE = 24;
  const total = Math.max(1, Math.ceil(rows.length/CARD_PAGE));
  pageState.staff = Math.min(pageState.staff, total);
  const start = (pageState.staff-1)*CARD_PAGE;
  const page  = rows.slice(start, start+CARD_PAGE);
  const filterDesc = xf.staff_hindex ? ` with H-Index ${xf.staff_hindex.label}` : '';
  document.getElementById('staff-count').textContent =
    `${rows.length} staff${filterDesc}${q ? ` matching "${q}"` : ''}`;
  document.getElementById('staff-pagination').innerHTML = paginHTML(total, pageState.staff, 'staff');

  const avatarHTML = s => {
    const ini = esc(initials(s.name));
    if (s.photo) {
      return `<img class="staff-card-photo" src="${esc(s.photo)}" alt=""
        loading="lazy"
        onerror="this.outerHTML='<div class=\\'staff-card-initials\\' aria-hidden=\\'true\\'>${ini}</div>'">`;
    }
    return `<div class="staff-card-initials" aria-hidden="true">${ini}</div>`;
  };

  const hBadge = s => {
    if (s.h_scopus == null) return '';
    return `<span class="staff-card-hindex">H ${s.h_scopus}</span>`;
  };

  document.getElementById('staff-grid').innerHTML = page.length
    ? page.map(s => {
        const pos = normalisePosition(s.position);
        return `<div class="staff-card" role="button" tabindex="0" data-slug="${esc(s.slug)}" aria-label="Open profile for ${esc(s.name||s.slug)}">
          ${hBadge(s)}
          ${avatarHTML(s)}
          <button class="staff-card-name" data-slug="${esc(s.slug)}">${esc(s.name||s.slug)}</button>
          <div class="staff-card-pos">${esc(pos)}</div>
          <div class="staff-card-stats">
            <div class="staff-card-stat"><strong>${s.pubs_indexed||0}</strong>Indexed</div>
            <div class="staff-card-stat"><strong>${s.grants_active||0}</strong>Active Grants</div>
            <div class="staff-card-stat"><strong>${(s.phd_graduated||0)+(s.master_graduated||0)}</strong>Grads</div>
          </div>
        </div>`;
      }).join('')
    : `<p style="padding:40px;color:var(--text3);text-align:center;width:100%">No staff match the current filters.</p>`;
}

// ── STAFF MATRIX ───────────────────────────────────────────────────────────
const matrixSort = { key: null, dir: 1 };
let   matrixPage = 1;

function getMatrixList() {
  const q = document.getElementById('matrix-search').value.trim().toLowerCase();
  let rows = [...STAFF];
  if (q) rows = rows.filter(s => (s.name||'').toLowerCase().includes(q));
  if (matrixSort.key) {
    const { key, dir } = matrixSort;
    rows.sort((a, b) => {
      let av, bv;
      if (key === 'h_scopus')    { av = a.h_scopus||0;      bv = b.h_scopus||0; }
      else if (key === 'pubs_indexed') { av = a.pubs_indexed||0; bv = b.pubs_indexed||0; }
      else if (key === 'pubs_other')   { av = a.pubs_other||0;   bv = b.pubs_other||0; }
      else if (key === 'grants_active'){ av = a.grants_active||0;bv = b.grants_active||0; }
      else if (key === 'grants_total') { av = a.grants_total||0; bv = b.grants_total||0; }
      else if (key === 'phd_grad')     { av = a.phd_graduated||0;bv = b.phd_graduated||0; }
      else if (key === 'msc_grad')     { av = a.master_graduated||0;bv = b.master_graduated||0; }
      else if (key === 'consultancy')  { av = a.consultancy_completed||0;bv = b.consultancy_completed||0; }
      else { av = String(a[key]||''); bv = String(b[key]||''); return dir * av.localeCompare(bv); }
      return dir * (av - bv);
    });
  } else {
    rows.sort((a, b) => (a.name||'').localeCompare(b.name||''));
  }
  return rows;
}

function renderMatrixTable() {
  const rows  = getMatrixList();
  const total = Math.max(1, Math.ceil(rows.length/PAGE_SIZE));
  matrixPage  = Math.min(matrixPage, total);
  const start = (matrixPage-1)*PAGE_SIZE;
  const page  = rows.slice(start, start+PAGE_SIZE);
  document.getElementById('matrix-count').textContent = `${rows.length} staff`;
  document.getElementById('matrix-pagination').innerHTML = paginHTML(total, matrixPage, 'matrix');

  const hc = v => v == null ? '<span style="color:var(--text3)">--</span>' : `<span class="num">${v}</span>`;
  const nc = v => !v ? '<span style="color:var(--text3)">0</span>' : `<span class="num">${v}</span>`;

  const avatarCell = s => {
    const ini = esc(initials(s.name));
    if (s.photo) {
      return `<img class="row-thumb" src="${esc(s.photo)}" alt="" loading="lazy"
        onerror="this.outerHTML='<span class=\\'row-initials\\' aria-hidden=\\'true\\'>${ini}</span>'">`;
    }
    return `<span class="row-initials" aria-hidden="true">${ini}</span>`;
  };

  // Update sort icons
  const thead = document.getElementById('matrix-thead');
  thead.querySelectorAll('th.sortable').forEach(th => {
    const isActive = th.dataset.sort === matrixSort.key;
    th.setAttribute('aria-sort', isActive ? (matrixSort.dir === 1 ? 'ascending' : 'descending') : 'none');
    const icon = th.querySelector('.sort-icon');
    if (icon) icon.textContent = isActive ? (matrixSort.dir === 1 ? '↑' : '↓') : '↕';
  });

  document.getElementById('matrix-tbody').innerHTML = page.length
    ? page.map(s => `
      <tr>
        <td><div class="name-cell">${avatarCell(s)}<button class="name-btn" data-slug="${esc(s.slug)}" onclick="switchToProfile('${esc(s.slug)}')">${esc(s.name||s.slug)}</button></div></td>
        <td class="c">${hc(s.h_scopus)} / ${hc(s.h_wos)} / ${hc(s.h_gs)}</td>
        <td class="r">${nc(s.pubs_indexed)}</td>
        <td class="r">${nc(s.pubs_other)}</td>
        <td class="r">${nc(s.grants_active)}</td>
        <td class="r">${nc(s.grants_total)}</td>
        <td class="r">${nc(s.phd_graduated)}</td>
        <td class="r">${nc(s.phd_ongoing)}</td>
        <td class="r">${nc(s.master_graduated)}</td>
        <td class="r">${nc(s.master_ongoing)}</td>
        <td class="r">${nc(s.consultancy_completed)}</td>
      </tr>`).join('')
    : `<tr><td class="empty" colspan="11">No staff match.</td></tr>`;
}

function switchToProfile(slug) {
  // Switch to Profiles tab then open the profile
  document.querySelectorAll('.staff-subpage-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.stafftab === 'profiles');
    t.setAttribute('aria-selected', t.dataset.stafftab === 'profiles' ? 'true' : 'false');
  });
  document.getElementById('staff-subpage-profiles').hidden = false;
  document.getElementById('staff-subpage-matrix').hidden = true;
  openStaffProfile(slug);
}

// ── PROFILE TAB PAGINATION HELPERS ─────────────────────────────────────────
const PROF_PAGE_SIZE = 10;

function profilePagedTable(allRows, page, key, rowFn) {
  const total = Math.max(1, Math.ceil(allRows.length / PROF_PAGE_SIZE));
  page = Math.min(Math.max(1, page), total);
  const start = (page - 1) * PROF_PAGE_SIZE;
  const slice = allRows.slice(start, start + PROF_PAGE_SIZE);
  const header = rowFn === pubTableRows
    ? '<tr><th>#</th><th>Title</th><th>Type</th><th>Indexed</th><th>Date</th></tr>'
    : rowFn === grantTableRows
    ? '<tr><th>#</th><th>Title</th><th>Level</th><th>Start</th><th>Status</th></tr>'
    : rowFn === svTableRows
    ? '<tr><th>#</th><th>Student</th><th>Level</th><th>Title</th><th>Intake</th><th>Status</th></tr>'
    : '<tr><th>#</th><th>Title</th><th>Client</th><th>Type</th><th>Year</th><th>Status</th></tr>';
  const rows = slice.map((r, i) => rowFn(r, start + i)).join('');
  const nav = total > 1 ? profPaginHTML(total, page, key) : '';
  return `<div class="tbl-wrap"><table><thead>${header}</thead><tbody>${rows}</tbody></table></div>${nav}`;
}

function profPaginHTML(total, cur, key) {
  if (total <= 1) return '';
  let html = `<div class="prof-pagination">`;
  html += `<button class="prof-pag-btn" data-profpag="${key}:${cur-1}" ${cur<=1?'disabled':''}>‹ Prev</button>`;
  html += `<span style="font-size:12px;color:var(--text2)">Page ${cur} of ${total}</span>`;
  html += `<button class="prof-pag-btn" data-profpag="${key}:${cur+1}" ${cur>=total?'disabled':''}>Next ›</button>`;
  html += `</div>`;
  return html;
}

function pubTableRows(p, i) {
  return `<tr>
    <td class="muted">${i+1}</td>
    <td class="clip wide"><button class="title-btn" data-pubidx="${PUBS.indexOf(p)}">${esc(p.title||'(no title)')}</button></td>
    <td>${esc(p.type||'')}</td>
    <td>${p.indexed ? '<span class="badge badge-active">Yes</span>' : '<span style="color:var(--text3);font-size:11px">—</span>'}</td>
    <td>${esc(p.date||'')}</td>
  </tr>`;
}

function grantTableRows(g, i) {
  const isIntl   = (g.level||'').toUpperCase().includes('INT');
  const isActive = (g.status||'').toUpperCase() === 'ACTIVE';
  const gIdx     = GRANTS.indexOf(g);
  return `<tr>
    <td class="muted">${i+1}</td>
    <td class="clip wide"><button class="title-btn" data-grantidx="${gIdx}" title="${esc(g.title)}">${esc(g.title||'(no title)')}</button></td>
    <td>${isIntl ? '<span class="badge badge-intl">Intl</span>' : '<span class="badge badge-natl">Natl</span>'}</td>
    <td>${esc(String(g.year_start||''))}</td>
    <td>${isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-done">Done</span>'}</td>
  </tr>`;
}

function svTableRows(e, i) {
  const cat   = e.category || '';
  const badge = cat.includes('phd') ? '<span class="badge badge-intl">PhD</span>' : '<span class="badge badge-natl">MSc</span>';
  const svIdx = SUPERVISION.indexOf(e);
  return `<tr>
    <td class="muted">${i+1}</td>
    <td class="clip"><button class="title-btn" data-svidx="${svIdx}" title="${esc(e.student_name)}">${esc(e.student_name||'')}</button></td>
    <td>${badge}</td>
    <td class="clip wide" style="max-width:220px">${esc(e.title||'—')}</td>
    <td style="white-space:nowrap">${esc(e.intake||'')}</td>
    <td><span style="font-size:11px;color:var(--text2)">${esc(e.status||e.graduated_sem||'')}</span></td>
  </tr>`;
}

function conTableRows(e, i) {
  const isDone = (e.status||'').toUpperCase() === 'COMPLETED';
  const conIdx = CONSULTANCY.indexOf(e);
  return `<tr>
    <td class="muted">${i+1}</td>
    <td class="clip wide"><button class="title-btn" data-conidx="${conIdx}" title="${esc(e.title)}">${esc(e.title||'(no title)')}</button></td>
    <td class="clip">${esc(e.client||'')}</td>
    <td style="font-size:11px;color:var(--text2)">${esc(e.type||'')}</td>
    <td>${esc(String(e.year_start||''))}</td>
    <td>${isDone ? '<span class="badge badge-done">Done</span>' : '<span class="badge badge-active">Appointed</span>'}</td>
  </tr>`;
}

// Profile-panel pagination is wired via delegation in the panel click handler below
function wireProfilePagination(panel, dataSets) {
  panel.addEventListener('click', e => {
    const btn = e.target.closest('[data-profpag]');
    if (!btn || btn.disabled) return;
    const [key, pageStr] = btn.dataset.profpag.split(':');
    const page = parseInt(pageStr, 10);
    const listId = `${key}-paged-list`;
    const listEl = panel.querySelector(`#${listId}`);
    if (!listEl) return;
    const rows = dataSets[key];
    const rowFn = key === 'pub' ? pubTableRows : key === 'grant' ? grantTableRows : key === 'sv' ? svTableRows : conTableRows;
    if (rows) listEl.innerHTML = profilePagedTable(rows, page, key, rowFn);
  });
}

function openStaffProfile(slug) {
  const s = STAFF_BY_SLUG.get(slug); if (!s) return;

  const panel = document.getElementById('staff-profile');
  panel.dataset.openSlug = slug;

  const staffPubs   = PUBS.filter(p => p.slug === slug);
  const staffGrants = GRANTS.filter(g => g.slug === slug);
  const staffSv     = SUPERVISION.filter(e => e.slug === slug);
  const staffCon    = CONSULTANCY.filter(e => e.slug === slug);
  const svPhdGrad   = staffSv.filter(e => e.category === 'phd_graduated');
  const svPhdOn     = staffSv.filter(e => e.category === 'phd_ongoing');
  const svMscGrad   = staffSv.filter(e => e.category === 'master_graduated');
  const svMscOn     = staffSv.filter(e => e.category === 'master_ongoing');
  const conDone     = staffCon.filter(e => e.category === 'completed');
  const conAppt     = staffCon.filter(e => e.category === 'appointed');
  const idxPubs     = staffPubs.filter(p => p.indexed);
  const otherPubs   = staffPubs.filter(p => !p.indexed);

  const hStr = [
    s.h_scopus != null ? `Scopus: <strong>${s.h_scopus}</strong>` : null,
    s.h_wos    != null ? `WoS: <strong>${s.h_wos}</strong>` : null,
    s.h_gs     != null ? `GS: <strong>${s.h_gs}</strong>` : null,
  ].filter(Boolean).join(' &nbsp;&middot;&nbsp; ') || '--';

  const expertUrl = `https://expert.uitm.edu.my/expert/${slug}`;
  const links = [
    `<a class="profile-link" href="${expertUrl}" target="_blank" rel="noopener">Expert Portal</a>`,
    s.scopus_id  ? `<a class="profile-link" href="https://www.scopus.com/authid/detail.uri?authorId=${esc(s.scopus_id)}" target="_blank" rel="noopener">Scopus</a>` : '',
    s.scholar_id ? `<a class="profile-link" href="https://scholar.google.com/citations?user=${esc(s.scholar_id)}" target="_blank" rel="noopener">Google Scholar</a>` : '',
    s.orcid      ? `<a class="profile-link" href="https://orcid.org/${esc(s.orcid)}" target="_blank" rel="noopener">ORCID</a>` : '',
  ].join('');

  const ini = esc(initials(s.name));
  const avatarHTML = s.photo
    ? `<img class="profile-photo" src="${esc(s.photo)}" alt="${esc(s.name)}" loading="lazy"
         onerror="this.outerHTML='<div class=\\'profile-initials-avatar\\' aria-hidden=\\'true\\'>${ini}</div>'">`
    : `<div class="profile-initials-avatar" aria-hidden="true">${ini}</div>`;

  const pubsHTML = idxPubs.slice(0,10).map((p,i) => `
    <tr>
      <td class="muted">${i+1}</td>
      <td class="clip wide"><button class="title-btn" data-pubidx="${PUBS.indexOf(p)}">${esc(p.title||'(no title)')}</button></td>
      <td>${esc(p.type||'')}</td>
      <td>${esc(p.date||'')}</td>
    </tr>`).join('');

  const grantsHTML = staffGrants.slice(0,10).map((g,i) => {
    const isIntl   = (g.level||'').toUpperCase().includes('INT');
    const isActive = (g.status||'').toUpperCase() === 'ACTIVE';
    return `<tr>
      <td class="muted">${i+1}</td>
      <td class="clip wide">${esc(g.title||'(no title)')}</td>
      <td>${isIntl ? '<span class="badge badge-intl">Intl</span>' : '<span class="badge badge-natl">Natl</span>'}</td>
      <td>${esc(String(g.year_start||''))}</td>
      <td>${isActive ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-done">Done</span>'}</td>
    </tr>`;
  }).join('');

  panel.hidden = false;
  panel.innerHTML = `
    <div class="profile-expert">
      <!-- LEFT SIDEBAR — mirrors Expert Portal layout -->
      <div class="profile-expert-sidebar">
        ${avatarHTML}
        <h2 class="profile-expert-name">${esc(s.name||slug)}</h2>
        <p class="profile-expert-titles">${esc(s.position||'')}</p>
        <div class="profile-expert-meta">
          ${s.email ? `<div class="profile-expert-meta-row"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="13" height="13"><path d="M3 4a2 2 0 0 0-2 2v.217l9 5.25 9-5.25V6a2 2 0 0 0-2-2H3Zm16 3.133-8.264 4.821a1 1 0 0 1-1.472 0L1 7.133V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7.133Z"/></svg><span>${esc(s.email)}</span></div>` : ''}
          ${s.department ? `<div class="profile-expert-meta-row"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="13" height="13"><path fill-rule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 0 1 0-1.5h12.5a.75.75 0 0 1 0 1.5H16v13h.25a.75.75 0 0 1 0 1.5h-3.5a.75.75 0 0 1-.75-.75v-2.5a.75.75 0 0 0-.75-.75h-2.5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 1-.75.75h-3.5a.75.75 0 0 1 0-1.5H4Z" clip-rule="evenodd"/></svg><span>${esc(s.department)}</span></div>` : ''}
          ${s.service_date ? `<div class="profile-expert-meta-row"><svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" width="13" height="13"><path fill-rule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clip-rule="evenodd"/></svg><span>Since ${esc(s.service_date)}</span></div>` : ''}
        </div>
        <div class="profile-expert-links">${links}</div>
        <div class="profile-expert-hindex">
          ${s.h_scopus != null ? `<div class="profile-expert-h-row"><span class="profile-expert-h-label">Scopus H-Index</span><strong>${s.h_scopus}</strong></div>` : ''}
          ${s.h_wos    != null ? `<div class="profile-expert-h-row"><span class="profile-expert-h-label">WoS H-Index</span><strong>${s.h_wos}</strong></div>` : ''}
          ${s.h_gs     != null ? `<div class="profile-expert-h-row"><span class="profile-expert-h-label">Google Scholar H</span><strong>${s.h_gs}</strong></div>` : ''}
          ${s.scopus_id ? `<div class="profile-expert-h-row"><span class="profile-expert-h-label">Scopus ID</span><a href="https://www.scopus.com/authid/detail.uri?authorId=${esc(s.scopus_id)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(s.scopus_id)}</a></div>` : ''}
        </div>
      </div>
      <!-- RIGHT CONTENT — tabbed -->
      <div class="profile-expert-main">
        <button class="profile-main-close" id="profile-close-btn" aria-label="Close profile">&times;</button>
        <div class="profile-expert-tabs" role="tablist">
          <button class="profile-expert-tab active" role="tab" data-ptab="overview" aria-selected="true">Overview</button>
          <button class="profile-expert-tab" role="tab" data-ptab="publications" aria-selected="false">Publications <span class="profile-tab-count">${staffPubs.length}</span></button>
          <button class="profile-expert-tab" role="tab" data-ptab="grants" aria-selected="false">Grants <span class="profile-tab-count">${staffGrants.length}</span></button>
          <button class="profile-expert-tab" role="tab" data-ptab="supervision" aria-selected="false">Supervision <span class="profile-tab-count">${staffSv.length}</span></button>
          <button class="profile-expert-tab" role="tab" data-ptab="consultancy" aria-selected="false">Consultancy <span class="profile-tab-count">${staffCon.length}</span></button>
        </div>
        <!-- Overview tab -->
        <div class="profile-expert-tabpanel" data-ptabpanel="overview">
          <div class="profile-kpi-row" style="margin-top:0">
            <div class="profile-kpi"><div class="label">Indexed pubs</div><div class="val num">${s.pubs_indexed||0}</div></div>
            <div class="profile-kpi"><div class="label">Other pubs</div><div class="val num">${s.pubs_other||0}</div></div>
            <div class="profile-kpi"><div class="label">Total pubs</div><div class="val num">${s.pubs_total||0}</div></div>
            <div class="profile-kpi"><div class="label">Active grants</div><div class="val num">${s.grants_active||0}</div></div>
            <div class="profile-kpi"><div class="label">Total grants</div><div class="val num">${s.grants_total||0}</div></div>
            <div class="profile-kpi"><div class="label">Intl grants</div><div class="val num">${(s.grants_intl_active||0)+(s.grants_intl_completed||0)}</div></div>
            <div class="profile-kpi"><div class="label">PhD grad</div><div class="val num">${s.phd_graduated||0}</div><div class="sub">${s.phd_ongoing||0} ongoing</div></div>
            <div class="profile-kpi"><div class="label">Master grad</div><div class="val num">${s.master_graduated||0}</div><div class="sub">${s.master_ongoing||0} ongoing</div></div>
            <div class="profile-kpi"><div class="label">Consultancy</div><div class="val num">${s.consultancy_completed||0}</div><div class="sub">${s.consultancy_appointed||0} appointed</div></div>
          </div>
          ${idxPubs.length ? `
            <div class="profile-section-title">Recent Indexed Publications</div>
            <div class="tbl-wrap"><table>
              <thead><tr><th>#</th><th>Title</th><th>Type</th><th>Date</th></tr></thead>
              <tbody>${idxPubs.slice(0,5).map((p,i) => `<tr>
                <td class="muted">${i+1}</td>
                <td class="clip wide"><button class="title-btn" data-pubidx="${PUBS.indexOf(p)}">${esc(p.title||'(no title)')}</button></td>
                <td>${esc(p.type||'')}</td>
                <td>${esc(p.date||'')}</td>
              </tr>`).join('')}</tbody>
            </table></div>
            ${idxPubs.length > 5 ? `<p style="font-size:12px;color:var(--text3);margin-top:6px">Showing 5 of ${idxPubs.length} — see Publications tab for full list.</p>` : ''}
            ` : '<p style="color:var(--text3);font-size:13px;margin-top:16px">No indexed publications on record.</p>'}
        </div>
        <!-- Publications tab -->
        <div class="profile-expert-tabpanel" data-ptabpanel="publications" hidden>
          ${staffPubs.length ? `
            <div id="pub-paged-list">
              ${profilePagedTable(staffPubs, 1, 'pub', pubTableRows)}
            </div>` : '<p style="color:var(--text3);font-size:13px;margin-top:16px">No publications on record.</p>'}
        </div>
        <!-- Grants tab -->
        <div class="profile-expert-tabpanel" data-ptabpanel="grants" hidden>
          ${staffGrants.length ? `
            <div id="grant-paged-list">
              ${profilePagedTable(staffGrants, 1, 'grant', grantTableRows)}
            </div>` : '<p style="color:var(--text3);font-size:13px;margin-top:16px">No grants on record.</p>'}
        </div>
        <!-- Supervision tab -->
        <div class="profile-expert-tabpanel" data-ptabpanel="supervision" hidden>
          <div class="profile-kpi-row" style="margin-top:0">
            <div class="profile-kpi"><div class="label">PhD Graduated</div><div class="val num">${s.phd_graduated||0}</div></div>
            <div class="profile-kpi"><div class="label">PhD Ongoing</div><div class="val num">${s.phd_ongoing||0}</div></div>
            <div class="profile-kpi"><div class="label">Master Graduated</div><div class="val num">${s.master_graduated||0}</div></div>
            <div class="profile-kpi"><div class="label">Master Ongoing</div><div class="val num">${s.master_ongoing||0}</div></div>
          </div>
          ${staffSv.length ? `
          <div id="sv-paged-list">
            ${profilePagedTable(staffSv, 1, 'sv', svTableRows)}
          </div>` : '<p style="color:var(--text3);font-size:13px;margin-top:12px">No supervision records yet — may appear after next scrape.</p>'}
        </div>
        <!-- Consultancy tab -->
        <div class="profile-expert-tabpanel" data-ptabpanel="consultancy" hidden>
          <div class="profile-kpi-row" style="margin-top:0">
            <div class="profile-kpi"><div class="label">Appointed</div><div class="val num">${s.consultancy_appointed||0}</div></div>
            <div class="profile-kpi"><div class="label">Completed</div><div class="val num">${s.consultancy_completed||0}</div></div>
          </div>
          ${staffCon.length ? `
          <div id="con-paged-list">
            ${profilePagedTable(staffCon, 1, 'con', conTableRows)}
          </div>` : '<p style="color:var(--text3);font-size:13px;margin-top:12px">No consultancy records yet — may appear after next scrape.</p>'}
        </div>
      </div>
    </div>`;

  panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  document.getElementById('profile-close-btn').addEventListener('click', () => {
    panel.hidden = true;
    panel.dataset.openSlug = '';
  });

  // Profile tab switching
  panel.querySelectorAll('.profile-expert-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.profile-expert-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      panel.querySelectorAll('.profile-expert-tabpanel').forEach(p => p.hidden = true);
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      panel.querySelector(`[data-ptabpanel="${tab.dataset.ptab}"]`).hidden = false;
    });
  });

  // Wire profile-tab pagination
  wireProfilePagination(panel, {
    pub:   staffPubs,
    grant: staffGrants,
    sv:    staffSv,
    con:   staffCon,
  });
}
