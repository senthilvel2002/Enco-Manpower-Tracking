"""
Import worker work entries from an Excel file (.xlsx).

Progress bars print to the terminal by default; use --no-progress to disable.

Flat format (civil_id columns):
  python scripts/import_worker_entries_excel.py path/to/file.xlsx [--sheet 0] [--dry-run]

Enco MNP tracking format (*Mnp Tracking*.xlsx — Date, Company, Name Surname, Man/Equ, …):
  python scripts/import_worker_entries_excel.py path/to/file.xlsx --format mnp [--dry-run]
  python scripts/import_worker_entries_excel.py path/to/file.xlsx --format mnp --sheet-name "January 2026"
  python scripts/import_worker_entries_excel.py path/to/file.xlsx --format mnp --all-sheets

Requires MONGODB_URI (and MONGODB_DB_NAME) in environment or backend/.env
"""

import argparse
import os
import sys
import warnings

# Allow importing backend package when run as script
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from excel_import_worker_entries import import_excel_rows  # noqa: E402
from excel_import_mnp_tracking import import_mnp_tracking_excel  # noqa: E402
from db import get_database  # noqa: E402


def main() -> int:
    warnings.filterwarnings(
        "ignore",
        message="Data Validation extension is not supported",
        module="openpyxl",
    )
    parser = argparse.ArgumentParser(description="Import worker entries from Excel (.xlsx)")
    parser.add_argument("xlsx_path", help="Path to .xlsx file")
    parser.add_argument("--dry-run", action="store_true", help="Validate only, do not insert")
    parser.add_argument(
        "--format",
        choices=("flat", "mnp"),
        default="flat",
        help="flat = columns with civil_id; mnp = Enco MNP tracking workbook",
    )
    parser.add_argument("--sheet", type=int, default=0, help="[flat] Zero-based sheet index (default 0)")
    parser.add_argument(
        "--sheet-name",
        default="",
        help='[mnp] Exact sheet name (e.g. "January 2026"). Omit to use January 2026 if present, else first sheet.',
    )
    parser.add_argument(
        "--mnp-sheet-index",
        type=int,
        default=None,
        help="[mnp] 0-based sheet index (overrides default January 2026 when set)",
    )
    parser.add_argument(
        "--all-sheets",
        action="store_true",
        help="[mnp] Import every day tab (skips Cumulative, January 2026, Tasks 1, Manpower 1)",
    )
    parser.add_argument(
        "--no-progress",
        action="store_true",
        help="Do not print progress bars (faster for large files when stdout is slow)",
    )
    args = parser.parse_args()

    path = os.path.abspath(args.xlsx_path)
    if not os.path.isfile(path):
        print(f"File not found: {path}", file=sys.stderr)
        return 1

    with open(path, "rb") as f:
        content = f.read()

    db = get_database()
    show_progress = not args.no_progress

    if args.format == "mnp":
        result = import_mnp_tracking_excel(
            db,
            content,
            sheet_name=(args.sheet_name.strip() or None),
            sheet_index=args.mnp_sheet_index,
            all_sheets=args.all_sheets,
            dry_run=args.dry_run,
            progress=show_progress,
        )
        if not result.get("ok"):
            print("Error:", result.get("error"), file=sys.stderr)
            return 1
        print("Format: mnp_tracking")
        print("Parse errors:", result.get("parse_errors") or "(none)")
        print("Rows read:", result.get("rows_read", result.get("mode", "")))
        if result.get("mode") == "all_sheets":
            print("Sheets mode: all (daily tabs only; January 2026 skipped)")
        print("Skipped (equipment / other):", result.get("skipped_equipment_or_other", 0))
        if args.dry_run:
            print("Would insert:", result.get("would_insert", 0))
        else:
            print("Inserted:", result.get("inserted", 0))
        print("Row errors:", len(result.get("row_errors") or []))
        for e in result.get("row_errors") or []:
            loc = f"{e.get('sheet')} " if e.get("sheet") else ""
            print(f"  {loc}Row {e.get('row')}: {e.get('error')} (civil_id={e.get('civil_id')})")
        if args.dry_run:
            print("(dry run — no database writes)")
        return 0

    result = import_excel_rows(db, content, sheet_index=args.sheet, dry_run=args.dry_run, progress=show_progress)
    print("Parse errors:", result.get("parse_errors") or "(none)")
    print("Rows read:", result.get("rows_read"))
    if args.dry_run:
        print("Would insert (valid rows):", result.get("would_insert", 0))
    else:
        print("Inserted:", result.get("inserted", 0))
    print("Row errors:", len(result.get("row_errors") or []))
    for e in result.get("row_errors") or []:
        print(f"  Row {e.get('row')}: {e.get('error')} (civil_id={e.get('civil_id')})")
    if args.dry_run:
        print("(dry run — no database writes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
