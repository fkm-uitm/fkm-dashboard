'use strict';

// ── ABOUT PAGE — EXCEL EXPORTS ─────────────────────────────────────────────
function exportToExcel(data, fields, headers, sheetName, filename) {
  if (typeof XLSX === 'undefined') { alert('Excel library not loaded yet, try again in a moment.'); return; }
  const rows = [headers].concat(data.map(r => fields.map(f => r[f] ?? '')));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  XLSX.writeFile(wb, filename);
}

document.getElementById('about-dl-staff').addEventListener('click', () => {
  exportToExcel(STAFF,
    ['name','position','department','h_scopus','h_wos','h_gs','pubs_indexed','pubs_other','grants_active','grants_total','phd_graduated','phd_ongoing','master_graduated','master_ongoing','consultancy_completed'],
    ['Name','Position','Department','H-Index (Scopus)','H-Index (WoS)','H-Index (GS)','Pubs Indexed','Pubs Other','Grants Active','Grants Total','PhD Graduated','PhD Ongoing','Master Graduated','Master Ongoing','Consultancy'],
    'Staff', 'FKM_Staff.xlsx');
});
document.getElementById('about-dl-pubs').addEventListener('click', () => {
  exportToExcel(PUBS,
    ['name','title','type','date','indexed','ref','group'],
    ['Author','Title','Type','Date','Indexed','Ref','Group'],
    'Publications', 'FKM_Publications.xlsx');
});
document.getElementById('about-dl-grants').addEventListener('click', () => {
  exportToExcel(GRANTS,
    ['name','title','level','grant_name','grant_code','role','year_start','year_end','cost','status'],
    ['Author','Title','Level','Grant Name','Grant Code','Role','Year Start','Year End','Cost (RM)','Status'],
    'Grants', 'FKM_Grants.xlsx');
});
document.getElementById('about-dl-supervision').addEventListener('click', () => {
  exportToExcel(SUPERVISION,
    ['staff_name','student_name','level','programme','title','intake','main_supervisor','status','graduated_sem'],
    ['Supervisor','Student Name','Level','Programme','Thesis Title','Intake','Main Supervisor','Status','Graduated Sem'],
    'Supervision', 'FKM_Supervision.xlsx');
});
document.getElementById('about-dl-consultancy').addEventListener('click', () => {
  exportToExcel(CONSULTANCY,
    ['staff_name','title','client','type','role','cost_rm','year_start','year_end','status'],
    ['Staff','Title','Client','Type','Role','Cost (RM)','Year Start','Year End','Status'],
    'Consultancy', 'FKM_Consultancy.xlsx');
});

loadData();