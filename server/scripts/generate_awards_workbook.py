# scripts/generate_awards_workbook.py
#
# Usage:
#   echo <json_data_base64> | python3 generate_awards_workbook.py \
#       <master_access_token> <master_refresh_token> <folder_id>
#
# json_data_base64: base64-encoded JSON read from STDIN (not a CLI arg).
# Passing it via stdin avoids the Linux ARG_MAX (E2BIG) limit.
#   Keys: all[]  sports[]  cultural[]  trailblazer[]
#   Each row includes: photo_url, student_id, name, email, gender, batch,
#   mobile_number, academic_score, sports_score, cultural_score,
#   sports_verified_score, cultural_verified_score, academic_verified_score,
#   total_verified_score, submission_date, Sports/Cultural/Academic Sheet Link
#
# Photo column logic:
#   • ALL tab   — col A, =IMAGE() formula using local server URL, cells MERGED for same-student rows
#   • Other tabs — col A, =IMAGE() formula using local server URL, one row per student (no merge)
#   • If photo_url is empty (student has no local photo) — cell is blank (no broken image)
#
# Returns: { success, sheet_id, url }

import sys, json, os, time, base64, socket, tempfile
from datetime import datetime
from itertools import groupby

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print(json.dumps({"success": False, "error": "openpyxl not installed"}))
    sys.exit(1)

from googleapiclient.http import MediaFileUpload

socket.setdefaulttimeout(120)

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
]

PROTECTED_COLS  = ['student_id', 'name', 'email']   # warning-only protection
PHOTO_COL_WIDTH  = 22       # column A width (pixels/chars) for the photo column
PHOTO_ROW_HEIGHT = 90      # row height when photo is present

# Columns whose values are URLs — rendered as clickable hyperlinks with short labels
HYPERLINK_COLS = {
    'Sports Sheet Link':   'Sports Matrix',
    'Cultural Sheet Link': 'Cultural Matrix',
    'Academic Sheet Link': 'Academic Matrix',
    'Attachment':          'View PDF',
}

# ─── Column definitions (data columns after the Photo column) ─────────────────
ALL_COLS     = ['student_id','name','email','gender','batch','mobile_number',
                'academic_score','sports_score','cultural_score',
                'sports_verified_score','cultural_verified_score',
                'academic_verified_score','total_verified_score',
                'submission_date',
                'Sports Sheet Link','Cultural Sheet Link','Academic Sheet Link',
                'Attachment']

SPORTS_COLS  = ['student_id','name','email','gender','batch','mobile_number',
                'sports_score','sports_verified_score',
                'submission_date','Sports Sheet Link','Attachment']

CULTURAL_COLS = ['student_id','name','email','gender','batch','mobile_number',
                 'cultural_score','cultural_verified_score',
                 'submission_date','Cultural Sheet Link','Attachment']

TRAIL_COLS   = ['student_id','name','email','gender','batch','mobile_number',
                'academic_score','sports_score','cultural_score',
                'sports_verified_score','cultural_verified_score',
                'academic_verified_score','total_verified_score',
                'submission_date',
                'Sports Sheet Link','Cultural Sheet Link','Academic Sheet Link',
                'Attachment']

# Styles
HEADER_FILL  = PatternFill("solid", fgColor="1E3A8A")   # dark blue  — data cols
HEADER_FONT  = Font(bold=True, color="FFFFFF", size=10)
LOCK_FILL    = PatternFill("solid", fgColor="FFF3CD")   # yellow tint — protected data cols
PHOTO_FILL   = PatternFill("solid", fgColor="0D9488")   # teal       — photo header
KEY_COL_FILL = PatternFill("solid", fgColor="7C3AED")   # purple     — student_id/name/email header


# ─── Helpers ──────────────────────────────────────────────────────────────────

def execute_with_retry(request, max_retries=4):
    for attempt in range(max_retries):
        try:
            return request.execute()
        except HttpError as e:
            if e.resp.status in (429, 500, 503) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


def build_credentials(access_token, refresh_token):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=SCOPES,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
    return creds


def get_photo_formula(photo_url):
    """Return =IMAGE() formula using the given URL, or '' if no URL.

    The URL should be the local server endpoint (e.g.
    https://flameawards.in/api/photos/<student_id>) which never expires.
    If photo_url is empty (student has no uploaded photo) return '' so the
    cell is left blank rather than showing a broken image.
    """
    if not photo_url:
        return ''
    return f'=IMAGE("{photo_url}")'


def row_to_cells(record, cols):
    """Extract values for the given column list from a record dict.
    URL columns are returned as =HYPERLINK() formulas with short display labels.
    """
    cells = []
    for col in cols:
        val = record.get(col, '') or ''
        if col == 'submission_date' and val:
            try:
                val = datetime.fromisoformat(str(val)).strftime('%Y-%m-%d')
            except Exception:
                pass
        # Wrap URL columns in =HYPERLINK() so cell shows a short label
        if col in HYPERLINK_COLS and val:
            label = HYPERLINK_COLS[col]
            val = f'=HYPERLINK("{val}", "{label}")'
        cells.append(val)
    return cells


def _thin_border():
    thin = Side(style='thin', color='D1D5DB')
    return Border(left=thin, right=thin, top=thin, bottom=thin)


# ─── Sheet writer ─────────────────────────────────────────────────────────────

def write_sheet(ws, cols, rows, merge_photo=False):
    """
    Write a complete tab into the openpyxl worksheet.

    Column layout:
        A  → Photo  (=IMAGE formula, teal header)
        B+ → normal data columns (cols list)

    merge_photo=True: after writing data rows, merge column A cells for
    consecutive rows that share the same email (AllAwards tab only).
    """
    border = _thin_border()

    # ── Header row ────────────────────────────────────────────────────────────
    # Col A: Photo
    ph = ws.cell(row=1, column=1, value='Photo')
    ph.font      = HEADER_FONT
    ph.fill      = PHOTO_FILL
    ph.alignment = Alignment(horizontal='center', vertical='center')
    ph.border    = border
    ws.column_dimensions['A'].width = PHOTO_COL_WIDTH

    # Col B onwards: data columns
    for ci, col in enumerate(cols, 2):
        cell = ws.cell(row=1, column=ci, value=col)
        cell.font      = HEADER_FONT
        cell.fill      = KEY_COL_FILL if col in PROTECTED_COLS else HEADER_FILL
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border    = border
        ws.column_dimensions[get_column_letter(ci)].width = max(len(col) + 4, 16)

    ws.freeze_panes = 'B2'   # freeze both Photo col and header row
    ws.row_dimensions[1].height = 32

    # ── Data rows ─────────────────────────────────────────────────────────────
    for ri, record in enumerate(rows, 2):
        photo_url = record.get('photo_url', '')
        formula   = get_photo_formula(photo_url)

        # Col A: Photo formula (or empty)
        photo_cell = ws.cell(row=ri, column=1, value=formula)
        photo_cell.alignment = Alignment(horizontal='center', vertical='center')
        photo_cell.border    = border
        if photo_url:
            ws.row_dimensions[ri].height = PHOTO_ROW_HEIGHT

        # Col B+: data values
        cells = row_to_cells(record, cols)
        for ci, val in enumerate(cells, 2):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.border    = border
            cell.alignment = Alignment(vertical='center')
            if cols[ci - 2] in PROTECTED_COLS:
                cell.fill = LOCK_FILL

    # ── Intelligent photo-cell merging (AllAwards tab only) ──────────────────
    if merge_photo and rows:
        _apply_photo_merge(ws, rows, start_row=2)


def _apply_photo_merge(ws, rows, start_row=2):
    """
    Merge column-A cells for consecutive rows that share the same email.

    The 'all' dataset arrives sorted by email (then award_type), so groupby
    on email produces correct consecutive groups without extra sorting.

    Merged cell keeps the IMAGE formula value from the first cell in the group.
    Border is re-applied to the merged cell so the teal outline stays visible.
    """
    border = _thin_border()
    current_row = start_row

    for _email, grp in groupby(rows, key=lambda r: r.get('email', '')):
        group_rows = list(grp)
        count      = len(group_rows)
        end_row    = current_row + count - 1

        if count > 1:
            ws.merge_cells(
                start_row=current_row, start_column=1,
                end_row=end_row,       end_column=1,
            )
            # Merged cell is always the top-left cell; re-apply style
            merged_cell = ws.cell(row=current_row, column=1)
            merged_cell.alignment = Alignment(
                horizontal='center', vertical='center', wrap_text=False
            )
            merged_cell.border = border

        current_row += count


# ─── Sheet protection ─────────────────────────────────────────────────────────

def protect_sheet_columns(sheets_service, spreadsheet_id, sheet_gid):
    """
    Warning-only protection on columns A–D (Photo, student_id, name, email).
    Editors see a dialog but CAN override.
    """
    body = {
        "requests": [{
            "addProtectedRange": {
                "protectedRange": {
                    "range": {
                        "sheetId":           sheet_gid,
                        "startColumnIndex":  0,   # col A (Photo)
                        "endColumnIndex":    4,   # cols A-D exclusive (Photo,student_id,name,email)
                    },
                    "description": (
                        "⚠️ Photo / student_id / name / email are KEY fields. "
                        "Changes here will NOT be synced and may corrupt the local database."
                    ),
                    "warningOnly": True,
                }
            }
        }]
    }
    try:
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body=body
        ).execute()
    except Exception as e:
        print(f"[WARN] Could not add sheet protection: {e}", file=sys.stderr)


# ─── Sheets API helpers for post-upload photo column ─────────────────────────

def _build_sheets_merge_requests(sheet_gid, rows, start_row_index=1):
    """
    Build Sheets API mergeCells requests for column A,
    grouping consecutive rows with the same email.
    """
    requests     = []
    current      = start_row_index
    for _email, grp in groupby(rows, key=lambda r: r.get('email', '')):
        group_rows = list(grp)
        count      = len(group_rows)
        if count > 1:
            requests.append({
                "mergeCells": {
                    "range": {
                        "sheetId":          sheet_gid,
                        "startRowIndex":    current,
                        "endRowIndex":      current + count,
                        "startColumnIndex": 0,
                        "endColumnIndex":   1,
                    },
                    "mergeType": "MERGE_ALL"
                }
            })
        current += count
    return requests


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            "success": False,
            "error": "Usage: master_access_token master_refresh_token folder_id  (json_data_base64 via stdin)"
        }))
        return

    master_access_token  = sys.argv[1]
    master_refresh_token = sys.argv[2]
    folder_id            = sys.argv[3]

    # Read large JSON payload from stdin to avoid E2BIG (ARG_MAX exceeded)
    try:
        json_data_b64 = sys.stdin.read().strip()
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to read stdin: {e}"}))
        return

    if not json_data_b64:
        print(json.dumps({"success": False, "error": "No data received on stdin"}))
        return

    try:
        data = json.loads(base64.b64decode(json_data_b64).decode('utf-8'))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON data: {e}"}))
        return

    sports_rows      = data.get('sports',      [])
    cultural_rows    = data.get('cultural',    [])
    trailblazer_rows = data.get('trailblazer', [])
    all_rows         = data.get('all',         [])

    # ─── Sort rows by verified scores (descending) ──────────────────────────
    def safe_score(row, key):
        try:
            val = row.get(key)
            if val is None or str(val).strip() == '' or str(val).strip() == '—':
                return 0.0
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    sports_rows.sort(key=lambda r: safe_score(r, 'sports_verified_score'), reverse=True)
    cultural_rows.sort(key=lambda r: safe_score(r, 'cultural_verified_score'), reverse=True)
    trailblazer_rows.sort(key=lambda r: safe_score(r, 'total_verified_score'), reverse=True)

    try:
        master_creds = build_credentials(master_access_token, master_refresh_token)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token error: {e}"}))
        return

    # Build workbook in memory
    wb = openpyxl.Workbook()
    wb.remove(wb.active)   # remove default blank sheet

    # Tab definitions: (tab_name, data_cols, rows, merge_photo_col_A)
    tabs = [
        ('AllAwards',        ALL_COLS,      all_rows,         True),   # intelligent merge
        ('SportsAward',      SPORTS_COLS,   sports_rows,      False),
        ('CulturalAward',    CULTURAL_COLS, cultural_rows,    False),
        ('TrailblazerAward', TRAIL_COLS,    trailblazer_rows, False),
    ]
    for tab_name, cols, rows, merge_photo in tabs:
        ws = wb.create_sheet(tab_name)
        write_sheet(ws, cols, rows, merge_photo=merge_photo)

    # Save to temp file, then upload as Google Sheets
    tmp = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    tmp.close()
    wb.save(tmp.name)

    try:
        drive_service  = build('drive',  'v3', credentials=master_creds)
        sheets_service = build('sheets', 'v4', credentials=master_creds)

        file_metadata = {
            'name':    'FLAME Awards — Admin Workbook',
            'mimeType': 'application/vnd.google-apps.spreadsheet',
            'parents': [folder_id],
        }
        media = MediaFileUpload(
            tmp.name,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            resumable=True,
        )
        uploaded = execute_with_retry(
            drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,webViewLink',
            )
        )
        spreadsheet_id = uploaded['id']
        url            = uploaded['webViewLink']

        # Apply warning-only protection to each tab
        meta = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        gid_map = {s['properties']['title']: s['properties']['sheetId'] for s in meta.get('sheets', [])}
        for gid in gid_map.values():
            protect_sheet_columns(sheets_service, spreadsheet_id, gid)

        # ─── Post-upload: rewrite Photo column (col A) via Sheets API ─────────
        # openpyxl writes =IMAGE() as a formula string in the XLSX, but the
        # Drive XLSX→Google Sheets conversion may not preserve it as a live
        # formula. Rewriting via Sheets API with USER_ENTERED guarantees the
        # =IMAGE() is interpreted natively by Google Sheets.
        tab_rows_map = {
            'AllAwards':        all_rows,
            'SportsAward':      sports_rows,
            'CulturalAward':    cultural_rows,
            'TrailblazerAward': trailblazer_rows,
        }
        photo_data = []
        for tab_name, rows in tab_rows_map.items():
            if not rows:
                continue
            values = [['Photo']]   # header
            for record in rows:
                formula = get_photo_formula(record.get('photo_url', ''))
                values.append([formula])
            photo_data.append({'range': f"'{tab_name}'!A1", 'values': values})

        if photo_data:
            try:
                execute_with_retry(
                    sheets_service.spreadsheets().values().batchUpdate(
                        spreadsheetId=spreadsheet_id,
                        body={'valueInputOption': 'USER_ENTERED', 'data': photo_data}
                    )
                )
            except Exception as _e:
                print(f"[WARN] Photo formula rewrite failed: {_e}", file=sys.stderr)

        # ─── Post-upload: merge AllAwards Photo cells for same-student rows ───
        all_gid = gid_map.get('AllAwards')
        if all_gid is not None and all_rows:
            merge_reqs = _build_sheets_merge_requests(all_gid, all_rows, start_row_index=1)
            if merge_reqs:
                try:
                    execute_with_retry(
                        sheets_service.spreadsheets().batchUpdate(
                            spreadsheetId=spreadsheet_id,
                            body={'requests': merge_reqs}
                        )
                    )
                except Exception as _e:
                    print(f"[WARN] Photo merge step failed: {_e}", file=sys.stderr)

        print(json.dumps({"success": True, "sheet_id": spreadsheet_id, "url": url}))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {e}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


if __name__ == '__main__':
    main()
