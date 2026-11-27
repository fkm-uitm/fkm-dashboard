"""
extract_prime_benchmark.py
--------------------------
Extracts PRIME/IRES KPI numbers from a "Data Pencapaian FKM" Excel file
and writes docs/data/prime_benchmark.json.

Usage:
    python -I scripts/extract_prime_benchmark.py "C:/path/to/Data Pencapaian.xlsx"

Requirements:
    pip install openpyxl

Run from the repo root (FKM Dashboard/).
"""

import sys
import json
import re
from pathlib import Path

try:
    import openpyxl
except ImportError:
    sys.exit("openpyxl not installed. Run: pip install openpyxl")

def get_summary_val(ws):
    """Return the first numeric value on the 'Sumber data' row."""
    for row in ws.iter_rows(values_only=True):
        if row[0] and 'Sumber data' in str(row[0]):
            for v in reversed(row[1:]):
                if isinstance(v, (int, float)):
                    return v
    return None

def parse_grant_sheet(ws):
    """
    Find the header row (col[0] == 'NO. FAIL'), then count data rows and
    sum the PERUNTUKKAN (approved cost) column.
    Returns (count, total_rm).
    """
    rows = list(ws.iter_rows(values_only=True))
    h_idx = next((i for i, r in enumerate(rows) if r and str(r[0]).strip() == 'NO. FAIL'), None)
    if h_idx is None:
        return 0, 0.0
    headers = rows[h_idx]
    cost_col = next(
        (i for i, h in enumerate(headers) if h and 'PERUNTUK' in str(h).upper()),
        5  # fallback: column index 5
    )
    data_rows = [r for r in rows[h_idx + 1:] if r and r[0]]
    total_rm  = sum(float(r[cost_col]) for r in data_rows if isinstance(r[cost_col], (int, float)))
    return len(data_rows), round(total_rm, 2)


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python -I scripts/extract_prime_benchmark.py <path_to_Data_Pencapaian.xlsx>")

    xlsx_path = Path(sys.argv[1])
    if not xlsx_path.exists():
        sys.exit(f"File not found: {xlsx_path}")

    print(f"Reading: {xlsx_path.name}")
    wb = openpyxl.load_workbook(str(xlsx_path), read_only=True, data_only=True)

    indexed   = get_summary_val(wb['Indexed Journal & Proceedin (2)'])
    nonidx    = get_summary_val(wb['Non Index Journal & Proceeding'])
    other_pub = get_summary_val(wb['Other Publication'])
    corr      = get_summary_val(wb['Corresponding Author'])
    q1q2      = get_summary_val(wb['Q1Q2'])
    mycite    = get_summary_val(wb['MyCite'])
    book_chap = get_summary_val(wb['Book & Chap in Book'])

    ga_count, ga_rm = parse_grant_sheet(wb['Grant Acquisition'])
    pi_count, _     = parse_grant_sheet(wb['Principal Investigator'])
    pi_summary      = get_summary_val(wb['Principal Investigator'])

    wb.close()

    # Try to detect report month from filename: "Data Pencapaian - FKM (Okt 2026).xlsx"
    month_match = re.search(r'\(([^)]+)\)', xlsx_path.stem)
    report_month = month_match.group(1) if month_match else 'Unknown'
    report_label = f'Data Pencapaian FKM {report_month}'

    result = {
        "_meta": {
            "report_label":  report_label,
            "report_month":  report_month,
            "report_date":   "unknown",
            "sources": {"publications": "PRIME", "grants": "IRES"},
            "note": "Regenerate by running: python -I scripts/extract_prime_benchmark.py <new_file.xlsx>"
        },
        "publications": {
            "indexed":                   int(indexed)   if indexed   else 0,
            "nonindexed_journal":        int(nonidx)    if nonidx    else 0,
            "other_publication":         int(other_pub) if other_pub else 0,
            "nonindexed_total":          int((nonidx or 0) + (other_pub or 0)),
            "corresponding_first_author":int(corr)      if corr      else 0,
            "q1q2":                      int(q1q2)      if q1q2      else 0,
            "mycite":                    int(mycite)    if mycite    else 0,
            "book_chapter":              int(book_chap) if book_chap else 0,
            "total":                     int((indexed or 0) + (nonidx or 0) + (other_pub or 0)),
        },
        "grants": {
            "total_new_period": ga_count,
            "pi_total_active":  int(pi_summary) if pi_summary else pi_count,
            "acquisition_rm":   ga_rm,
        }
    }

    out = Path(__file__).parent.parent / 'docs' / 'data' / 'prime_benchmark.json'
    out.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding='utf-8')

    print(json.dumps(result, indent=2))
    print(f'\n✓ Written to {out}')


if __name__ == '__main__':
    main()
