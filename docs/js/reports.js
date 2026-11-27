'use strict';

// ── REPORT PAGE (pre-generated monthly snapshots) ──────────────────────────
let _rptIndex = null;   // cached list of available reports
let _rptChart = null;   // Chart.js instance for year chart

async function initReportPage() {
  if (_rptIndex) { populateRptPicker(_rptIndex); return; }
  try {
    const r = await fetch('data/reports/index.json');
    if (!r.ok) throw new Error('not found');
    _rptIndex = await r.json();
  } catch {
    _rptIndex = [];
  }
  populateRptPicker(_rptIndex);
}

function populateRptPicker(index) {
  const sel = document.getElementById('rpt-period-sel');
  if (!sel) return;
  if (!index.length) {
    document.getElementById('rpt-body').innerHTML =
      '<div class="rpt-empty"><p>No pre-generated reports found.<br><small>Run <code>python scripts/generate_monthly_report.py</code> to create one.</small></p></div>';
    return;
  }
  sel.innerHTML = '<option value="">— select period —</option>' +
    index.map(r => `<option value="${esc(r.period)}">${esc(r.period_label)}</option>`).join('');
  // Auto-load last completed month (not the current in-progress month)
  const _curMo = new Date().toISOString().slice(0, 7);
  const _def   = index.find(r => r.period < _curMo) || index[0];
  sel.value = _def.period;
  loadReport(_def.period);
}

async function loadReport(period) {
  const body = document.getElementById('rpt-body');
  body.innerHTML = '<div class="rpt-empty"><p>Loading&hellip;</p></div>';
  document.getElementById('rpt-print-btn').hidden = true;
  if (_rptChart) { try { _rptChart.destroy(); } catch{} _rptChart = null; }
  try {
    const r = await fetch(`data/reports/${period}.json`);
    if (!r.ok) throw new Error(r.statusText);
    const data = await r.json();
    renderReport(data);
    document.getElementById('rpt-print-btn').hidden = false;
  } catch(e) {
    body.innerHTML = `<div class="rpt-empty"><p>Could not load report for ${esc(period)}: ${esc(e.message)}</p></div>`;
  }
}

function rptNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-MY');
}

function renderReport(d) {
  const s  = d.summary || {};
  const yr = d.pubs_by_year || {};
  const idx = d.index_breakdown || {};
  const gl  = d.grants_by_level || {};
  const depts = d.by_dept || [];
  const top   = d.top_staff || [];
  const findings = d.key_findings || [];
  const period = d.period;

  // ── hero tiles ─────────────────────────────────────────────────────────
  const heroTiles = [
    { v: rptNum(s.pubs_indexed_swe),  k: 'Indexed Publications', s: 'Scopus / WoS / ERA' },
    { v: rptNum(s.pubs_indexed_all),  k: 'Incl. MyCite',         s: 'All indexed types' },
    { v: rptNum(s.grants_active),     k: 'Active Grants',        s: `of ${rptNum(s.grants_total)} total` },
    { v: s.h_scopus_avg ?? '—',       k: 'Mean h-index',         s: 'Scopus, staff with profile' },
    { v: rptNum(s.staff_count),       k: 'Academic Staff',       s: 'UiTM Expert records' },
    { v: d.pubs_ytd_swe ? rptNum(d.pubs_ytd_swe) : '—', k: `${d.period ? d.period.slice(0,4) : ''} YTD`, s: 'Scopus/WoS/ERA this year' },
  ].map(t => `<div class="rpt-tile"><div class="v">${esc(String(t.v))}</div><div class="k">${esc(t.k)}</div><div class="s">${esc(t.s)}</div></div>`).join('');

  // ── section 1: research output ─────────────────────────────────────────
  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const ytdRows = (d.pubs_by_month_ytd || []).map(m => {
    const mo = m.month.slice(5,7);
    const label = monthLabels[+mo - 1] || mo;
    return `<tr><td>${esc(label)}</td><td class="n">${rptNum(m.swe)}</td><td class="n">${rptNum(m.all)}</td></tr>`;
  }).join('');

  // Index breakdown bars
  const idxOrder = ['SCOPUS','WEB OF SCIENCE','ERA','MYCITE','OTHER'];
  const idxLabels = { SCOPUS:'Scopus', 'WEB OF SCIENCE':'Web of Science', ERA:'ERA', MYCITE:'MyCite', OTHER:'Other' };
  const idxMax = Math.max(1, ...idxOrder.map(k => idx[k]||0));
  const idxBars = idxOrder.filter(k => idx[k]).map(k =>
    `<div class="rpt-bar">
      <div class="lab">${esc(idxLabels[k]||k)}</div>
      <div class="track"><span style="width:${((idx[k]||0)/idxMax*100).toFixed(1)}%;background:var(--brand)"></span></div>
      <div class="num">${rptNum(idx[k])}</div>
    </div>`
  ).join('');

  // Pubs by year bars
  const yrKeys = Object.keys(yr).sort();
  const yrMax = Math.max(1, ...yrKeys.map(y => yr[y].swe||0));
  const yrBars = yrKeys.map(y =>
    `<div class="rpt-bar">
      <div class="lab">${esc(y)}</div>
      <div class="track">
        <span style="width:${((yr[y].swe||0)/yrMax*100).toFixed(1)}%;background:var(--brand)"></span>
        <span style="width:${(((yr[y].all||0)-(yr[y].swe||0))/yrMax*100).toFixed(1)}%;background:var(--brand-accent,#4a9eff);opacity:.6"></span>
      </div>
      <div class="num">${rptNum(yr[y].swe)}</div>
    </div>`
  ).reverse().join('');

  // ── section 2: annual performance ─────────────────────────────────────
  const ytdByYear  = d.ytd_by_year || {};
  const curYr      = d.period ? d.period.slice(0,4) : '';
  const prevYr     = curYr ? String(+curYr - 1) : '';
  const ytdCur     = d.pubs_ytd_swe || 0;
  const ytdPrev    = ytdByYear[prevYr] != null ? ytdByYear[prevYr] : null;
  const ytdDelta   = ytdPrev != null ? ytdCur - ytdPrev : null;
  const ytdDeltaPct = (ytdDelta != null && ytdPrev > 0)
    ? ((ytdDelta / ytdPrev) * 100).toFixed(1) : null;
  const monthNum   = d.period ? parseInt(d.period.slice(5,7)) : 0;
  const projected  = monthNum > 0 && ytdCur > 0
    ? Math.round((ytdCur / monthNum) * 12) : null;
  const periodMo   = d.period_label ? d.period_label.split(' ')[0] : '';

  const deltaNumStr = ytdDelta === null ? '—'
    : ytdDelta === 0 ? '±0'
    : ytdDelta > 0  ? `+${rptNum(ytdDelta)}`
    : rptNum(ytdDelta);
  const deltaColor  = ytdDelta === null || ytdDelta === 0 ? 'var(--brand)'
    : ytdDelta > 0 ? '#16a34a' : '#dc2626';
  const deltaSubStr = ytdDeltaPct != null
    ? `${ytdDelta > 0 ? '+' : ''}${ytdDeltaPct}% vs ${prevYr}`
    : `compared to ${prevYr}`;

  const yoyYears = Object.keys(ytdByYear).sort().reverse();
  const yoyMax   = Math.max(1, ...yoyYears.map(y => ytdByYear[y] || 0));
  const yoyBars  = yoyYears.map(y =>
    `<div class="rpt-bar">
      <div class="lab">${esc(y)}</div>
      <div class="track"><span style="width:${((ytdByYear[y]||0)/yoyMax*100).toFixed(1)}%;background:${y===curYr?'var(--brand)':'var(--brand-accent,#4a9eff)'}"></span></div>
      <div class="num">${rptNum(ytdByYear[y])}</div>
    </div>`
  ).join('');

  const moLabelsAP = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const moDataAP   = d.pubs_by_month_ytd || [];
  const moMaxAP    = Math.max(1, ...moDataAP.map(m => m.swe || 0));
  const moBarsAP   = moDataAP.map(m => {
    const lbl = moLabelsAP[parseInt(m.month.slice(5,7)) - 1] || m.month.slice(5,7);
    return `<div class="rpt-bar">
      <div class="lab">${esc(lbl)}</div>
      <div class="track"><span style="width:${((m.swe||0)/moMaxAP*100).toFixed(1)}%;background:var(--series2,#f59e0b)"></span></div>
      <div class="num">${rptNum(m.swe)}</div>
    </div>`;
  }).join('');

  // ── section 3: grants ──────────────────────────────────────────────────
  const intl = gl['International'] || {};
  const natl = gl['National'] || {};

  // ── section 3: by department ───────────────────────────────────────────
  const deptRows = depts.map(dep =>
    `<tr>
      <td>${esc(dep.dept)}</td>
      <td class="n">${rptNum(dep.staff)}</td>
      <td class="n">${rptNum(dep.indexed_swe)}</td>
      <td class="n">${rptNum(dep.indexed_all)}</td>
      <td class="n">${rptNum(dep.grants_active)}</td>
    </tr>`
  ).join('');

  // ── section 4: top contributors ────────────────────────────────────────
  const topMax = Math.max(1, ...(top.map(t => t.pubs_scopus_wos_era||0)));
  const topBars = top.slice(0,10).map((t,i) =>
    `<div class="rpt-bar">
      <div class="lab">${esc(t.name.split(' ').slice(-1)[0]||t.name)}<small>${esc(t.dept||'')}</small></div>
      <div class="track"><span style="width:${((t.pubs_scopus_wos_era||0)/topMax*100).toFixed(1)}%;background:var(--series2,#f59e0b)"></span></div>
      <div class="num">${rptNum(t.pubs_scopus_wos_era)}</div>
    </div>`
  ).join('');

  // ── section 5: key findings ────────────────────────────────────────────
  const findingsHtml = findings.map(f => `<li>${f}</li>`).join('');

  // ── comments key ──────────────────────────────────────────────────────
  const storageKey = `rpt_comments_${period}`;

  const html = `
<div class="rpt-report">
  <div class="rpt-strip">
    <b>FKM Research Progress Report</b>
    <span class="rpt-asatpill">${esc(d.period_label)}</span>
    <span style="color:rgba(255,255,255,.55);font-size:11.5px">Generated ${esc(d.generated)}</span>
  </div>
  <div class="rpt-hero">
    <div class="eb">Faculty of Computer &amp; Mathematical Sciences &mdash; UiTM</div>
    <h1>Research Progress Report</h1>
    <p>Cumulative research performance as recorded in UiTM Expert portal, data as at ${esc(d.period_label)}.</p>
    ${d.report_type === 'retrospective' ? `<p class="rpt-datanote">${d.data_note ? esc(d.data_note) : 'Figures are calculated from current Expert portal records filtered by date and may change as staff update their profiles.'}</p>` : ''}
    <div class="rpt-tiles">${heroTiles}</div>
  </div>
  <div class="rpt-sections">

    <!-- §1 Research Output -->
    <div class="rpt-sec" id="rpt-sec-1">
      <div class="rpt-sh"><a class="no" href="#rpt-sec-1">1</a><div><h2>Research Output</h2><p>Publication counts by index database and year.</p></div></div>
      <p class="rpt-lede">Indexed publications are unique titles deduped across co-authors. The primary metric counts only Scopus, Web of Science and ERA.</p>
      <div class="rpt-stiles">
        <div class="rpt-stile"><div class="v">${rptNum(s.pubs_indexed_swe)}</div><div class="k">Scopus / WoS / ERA</div><div class="s">All years, unique titles</div></div>
        <div class="rpt-stile"><div class="v">${rptNum(s.pubs_indexed_all)}</div><div class="k">Indexed (incl. MyCite)</div><div class="s">All years, unique titles</div></div>
        <div class="rpt-stile"><div class="v">${rptNum(d.pubs_ytd_swe)||'—'}</div><div class="k">SWE — ${d.period ? d.period.slice(0,4) : ''} YTD</div><div class="s">Jan–${esc(d.period_label)}</div></div>
        <div class="rpt-stile"><div class="v">${rptNum(s.pubs_other)}</div><div class="k">Non-indexed</div><div class="s">Conference, journals, etc.</div></div>
      </div>
      <div class="rpt-g2">
        <div class="rpt-card">
          <h4>Indexed publications by year (Scopus/WoS/ERA)</h4>
          <p class="cs">Unique titles per year. Dark bar = SWE; faint extension = MyCite/Other.</p>
          <div class="rpt-bars">${yrBars}</div>
        </div>
        <div>
          <div class="rpt-card" style="margin-bottom:16px">
            <h4>By index database (unique titles, all years)</h4>
            <div class="rpt-bars" style="margin-top:8px">${idxBars}</div>
          </div>
          ${ytdRows ? `<div class="rpt-card">
            <h4>${d.period ? d.period.slice(0,4) : ''} month-by-month (Scopus/WoS/ERA)</h4>
            <div class="rpt-tbl-wrap" style="max-height:200px;overflow-y:auto;border:none;border-radius:0">
              <table><thead><tr><th>Month</th><th class="n">SWE</th><th class="n">All indexed</th></tr></thead>
              <tbody>${ytdRows}</tbody></table>
            </div>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- §2 Annual Performance -->
    <div class="rpt-sec" id="rpt-sec-2">
      <div class="rpt-sh"><a class="no" href="#rpt-sec-2">2</a><div><h2>Annual Performance</h2><p>Year-to-date analysis, Jan–${periodMo} ${curYr}.</p></div></div>
      <p class="rpt-lede">Counts unique Scopus/WoS/ERA publications recorded January through ${periodMo} of each year. The same-period view shows how ${curYr} compares to prior years at exactly this point in the calendar.</p>
      <div class="rpt-stiles">
        <div class="rpt-stile"><div class="v">${rptNum(ytdCur)}</div><div class="k">${curYr} YTD — SWE</div><div class="s">Jan–${periodMo}, unique titles</div></div>
        <div class="rpt-stile"><div class="v">${ytdPrev != null ? rptNum(ytdPrev) : '—'}</div><div class="k">${prevYr} same period</div><div class="s">Jan–${periodMo} ${prevYr}</div></div>
        <div class="rpt-stile"><div class="v" style="color:${deltaColor}">${deltaNumStr}</div><div class="k">Change vs last year</div><div class="s">${deltaSubStr}</div></div>
        <div class="rpt-stile"><div class="v">${projected != null ? rptNum(projected) : '—'}</div><div class="k">Projected year-end</div><div class="s">At current monthly pace</div></div>
      </div>
      <div class="rpt-g2">
        <div class="rpt-card">
          <h4>Same-period comparison (Jan–${periodMo}), by year</h4>
          <p class="cs">Unique Scopus/WoS/ERA titles recorded Jan–${periodMo} each year. Current year highlighted.</p>
          <div class="rpt-bars">${yoyBars || '<p class="cs">No historical data.</p>'}</div>
        </div>
        <div class="rpt-card">
          <h4>Monthly additions — ${curYr} (Scopus/WoS/ERA)</h4>
          <p class="cs">New unique titles added each month this year.</p>
          <div class="rpt-bars">${moBarsAP || '<p class="cs">No monthly data.</p>'}</div>
        </div>
      </div>
    </div>

    <!-- §3 Grants -->
    <div class="rpt-sec" id="rpt-sec-3">
      <div class="rpt-sh"><a class="no" href="#rpt-sec-3">3</a><div><h2>Research Grants</h2><p>All grants in UiTM Expert, regardless of period.</p></div></div>
      <div class="rpt-stiles">
        <div class="rpt-stile"><div class="v">${rptNum(s.grants_active)}</div><div class="k">Active Grants</div><div class="s">Currently running</div></div>
        <div class="rpt-stile"><div class="v">${rptNum(intl.active||0)}</div><div class="k">International Active</div><div class="s">${rptNum(intl.completed||0)} completed</div></div>
        <div class="rpt-stile"><div class="v">${rptNum(natl.active||0)}</div><div class="k">National Active</div><div class="s">${rptNum(natl.completed||0)} completed</div></div>
        <div class="rpt-stile"><div class="v">${rptNum(s.grants_total)}</div><div class="k">Total Grant Records</div><div class="s">All statuses</div></div>
      </div>
      <div class="rpt-tbl-wrap" style="max-width:480px">
        <table><thead><tr><th>Category</th><th class="n">Active</th><th class="n">Completed</th><th class="n">Total</th></tr></thead>
        <tbody>
          <tr><td>International</td><td class="n">${rptNum(intl.active||0)}</td><td class="n">${rptNum(intl.completed||0)}</td><td class="n">${rptNum((intl.active||0)+(intl.completed||0))}</td></tr>
          <tr><td>National</td><td class="n">${rptNum(natl.active||0)}</td><td class="n">${rptNum(natl.completed||0)}</td><td class="n">${rptNum((natl.active||0)+(natl.completed||0))}</td></tr>
        </tbody></table>
      </div>
    </div>

    <!-- §4 By Department -->
    <div class="rpt-sec" id="rpt-sec-4">
      <div class="rpt-sh"><a class="no" href="#rpt-sec-4">4</a><div><h2>By Department</h2><p>Breakdown of publication and grant counts by academic department.</p></div></div>
      <div class="rpt-tbl-wrap">
        <table>
          <thead><tr><th>Department</th><th class="n">Staff</th><th class="n">Scopus/WoS/ERA</th><th class="n">All indexed</th><th class="n">Active grants</th></tr></thead>
          <tbody>${deptRows}</tbody>
        </table>
      </div>
    </div>

    <!-- §5 Top Contributors -->
    <div class="rpt-sec" id="rpt-sec-5">
      <div class="rpt-sh"><a class="no" href="#rpt-sec-5">5</a><div><h2>Top Contributors</h2><p>Top 10 staff by cumulative Scopus/WoS/ERA publications.</p></div></div>
      <div class="rpt-g2">
        <div class="rpt-card">
          <h4>Publications (Scopus/WoS/ERA)</h4>
          <div class="rpt-bars" style="margin-top:8px">${topBars}</div>
        </div>
        <div class="rpt-card">
          <h4>Supervision &amp; Consultancy</h4>
          <p class="cs">Totals across all staff.</p>
          <div class="rpt-stiles" style="grid-template-columns:1fr 1fr;margin-top:0">
            <div class="rpt-stile"><div class="v">${rptNum(s.phd_total)}</div><div class="k">PhD students</div><div class="s">Graduated + ongoing</div></div>
            <div class="rpt-stile"><div class="v">${rptNum(s.master_total)}</div><div class="k">Master's students</div><div class="s">Graduated + ongoing</div></div>
            <div class="rpt-stile"><div class="v">${rptNum(s.consultancy_total)}</div><div class="k">Consultancy (completed)</div><div class="s">Projects completed</div></div>
            <div class="rpt-stile"><div class="v">${rptNum(s.h_scopus_avg)}</div><div class="k">Mean h-index</div><div class="s">Scopus</div></div>
          </div>
        </div>
      </div>
    </div>

    <!-- §6 Key Findings -->
    <div class="rpt-sec rpt-sec--accent" id="rpt-sec-6">
      <div class="rpt-sh"><a class="no" href="#rpt-sec-6">6</a><div><h2>Key Findings</h2><p>Auto-generated summary from the figures in this report.</p></div></div>
      <ul class="rpt-findings">${findingsHtml}</ul>
    </div>

    <!-- §7 Commentary -->
    <div class="rpt-sec rpt-sec--commentary rpt-comments-area" id="rpt-comments-sec">
      <div class="rpt-sh"><a class="no" href="#rpt-comments-sec">7</a><div><h2>Commentary</h2><p>Notes and observations from the research office.</p></div></div>
      <div id="rpt-comments-list" class="rpt-comments-list" style="display:grid;gap:12px;margin-bottom:16px"></div>
      <div class="rpt-comment-form">
        <label for="rpt-comment-text" class="sr-only">Comment</label>
        <textarea id="rpt-comment-text" placeholder="Add a comment or observation about this report period…" rows="3"></textarea>
        <div class="rpt-cf-row">
          <label for="rpt-comment-name" class="sr-only">Your name</label>
          <input type="text" id="rpt-comment-name" placeholder="Your name (optional)" maxlength="80">
          <button class="btn-primary" id="rpt-comment-submit">Add comment</button>
        </div>
      </div>
    </div>

  </div><!-- /.rpt-sections -->
</div><!-- /.rpt-report -->`;

  document.getElementById('rpt-body').innerHTML = html;
  renderRptComments(period);

  document.getElementById('rpt-comment-submit').addEventListener('click', () => {
    const text = (document.getElementById('rpt-comment-text').value || '').trim();
    if (!text) return;
    const name = (document.getElementById('rpt-comment-name').value || '').trim() || 'Anonymous';
    saveRptComment(period, text, name);
    document.getElementById('rpt-comment-text').value = '';
    renderRptComments(period);
  });
}

function saveRptComment(period, text, name) {
  const key = `rpt_comments_${period}`;
  let comments = [];
  try { comments = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  comments.push({ text, name, ts: new Date().toISOString() });
  try { localStorage.setItem(key, JSON.stringify(comments)); } catch {}
}

function renderRptComments(period) {
  const key = `rpt_comments_${period}`;
  let comments = [];
  try { comments = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  const list = document.getElementById('rpt-comments-list');
  if (!list) return;
  if (!comments.length) {
    list.innerHTML = '<p style="font-size:13px;color:var(--text3)">No comments yet.</p>';
    return;
  }
  list.innerHTML = comments.map(c => {
    const dt = c.ts ? new Date(c.ts).toLocaleString('en-MY', {dateStyle:'medium',timeStyle:'short'}) : '';
    return `<div class="rpt-comment">
      <div class="body">${esc(c.text)}</div>
      <div class="meta">${esc(c.name)} &middot; ${esc(dt)}</div>
    </div>`;
  }).join('');
}

document.getElementById('rpt-period-sel').addEventListener('change', e => {
  if (e.target.value) loadReport(e.target.value);
});
document.getElementById('rpt-print-btn').addEventListener('click', () => window.print());
