# scripts/generate_awards_workbook.py
#
# Usage:
#   python3 generate_awards_workbook.py \
#       <master_access_token> <master_refresh_token> \
#       <folder_id> <json_data_base64>
#
# json_data_base64: base64-encoded JSON with keys:
#   sports[]  cultural[]  trailblazer[]
#   Each row: { student_id, name, email, gender, batch, mobile_number, academic_score,
#               sports_score, cultural_score, sports_verified_score,
#               cultural_verified_score, submission_date,
#               Sports Sheet Link, Cultural Sheet Link, Academic Sheet Link }
#
# Returns: { success, sheet_id, url }

import sys, json, os, time, base64, socket, tempfile, shutil
from datetime import datetime

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

PROTECTED_COLS = ['student_id', 'name', 'email']   # never allow edits via sync

# Column definitions per tab
ALL_COLS     = ['student_id','name','email','gender','batch','mobile_number',
                'academic_score','sports_score','cultural_score',
                'sports_verified_score','cultural_verified_score','academic_verified_score','total_verified_score',
                'submission_date','Sports Sheet Link','Cultural Sheet Link','Academic Sheet Link']
SPORTS_COLS  = ['student_id','name','email','gender','batch','mobile_number',
                'sports_score','sports_verified_score',
                'submission_date','Sports Sheet Link']
CULTURAL_COLS= ['student_id','name','email','gender','batch','mobile_number',
                'cultural_score','cultural_verified_score',
                'submission_date','Cultural Sheet Link']
TRAIL_COLS   = ['student_id','name','email','gender','batch','mobile_number',
                'academic_score','sports_score','cultural_score',
                'sports_verified_score','cultural_verified_score','academic_verified_score','total_verified_score',
                'submission_date','Sports Sheet Link','Cultural Sheet Link','Academic Sheet Link']

HEADER_FILL = PatternFill("solid", fgColor="1E3A8A")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=10)
LOCK_FILL   = PatternFill("solid", fgColor="FFF3CD")  # yellow tint for protected cols


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


def row_to_cells(record, cols):
    """Extract values for given column list from a record dict."""
    cells = []
    for col in cols:
        val = record.get(col, '') or ''
        if col == 'submission_date' and val:
            try:
                val = datetime.fromisoformat(str(val)).strftime('%Y-%m-%d')
            except Exception:
                pass
        cells.append(str(val))
    return cells


def write_sheet(ws, cols, rows, tab_label):
    """Write header + rows into an openpyxl worksheet."""
    thin = Side(style='thin', color='D1D5DB')
    border = Border(left=thin, right=thin, top=thin, bottom=thin)

    # Header row
    for ci, col in enumerate(cols, 1):
        cell = ws.cell(row=1, column=ci, value=col)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL if col not in PROTECTED_COLS else PatternFill("solid", fgColor="7C3AED")
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell.border = border
        ws.column_dimensions[get_column_letter(ci)].width = max(len(col) + 4, 16)

    # Data rows
    for ri, record in enumerate(rows, 2):
        cells = row_to_cells(record, cols)
        for ci, val in enumerate(cells, 1):
            cell = ws.cell(row=ri, column=ci, value=val)
            cell.border = border
            cell.alignment = Alignment(vertical='center')
            if cols[ci - 1] in PROTECTED_COLS:
                cell.fill = LOCK_FILL

    ws.freeze_panes = 'A2'
    ws.row_dimensions[1].height = 32


def protect_sheets_columns(sheets_service, spreadsheet_id, sheet_gid, num_protected_cols=3):
    """
    Add a ProtectedRange on columns A-C (student_id, name, email) per tab.
    Sets warning-only so editors see a dialog but CAN override.
    """
    body = {
        "requests": [{
            "addProtectedRange": {
                "protectedRange": {
                    "range": {
                        "sheetId": sheet_gid,
                        "startColumnIndex": 0,
                        "endColumnIndex": num_protected_cols,
                    },
                    "description": "⚠️ student_id / name / email are KEY fields. Changes here will NOT be synced and may corrupt the local database. Please do not edit.",
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
        # Non-fatal — workbook still works without protection
        print(f"[WARN] Could not add sheet protection: {e}", file=sys.stderr)


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: master_access_token master_refresh_token folder_id json_data_base64"}))
        return

    master_access_token  = sys.argv[1]
    master_refresh_token = sys.argv[2]
    folder_id            = sys.argv[3]
    json_data_b64        = sys.argv[4]

    try:
        data = json.loads(base64.b64decode(json_data_b64).decode('utf-8'))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON data: {e}"}))
        return

    sports_rows      = data.get('sports',      [])
    cultural_rows    = data.get('cultural',    [])
    trailblazer_rows = data.get('trailblazer', [])
    all_rows         = data.get('all',         [])

    try:
        master_creds  = build_credentials(master_access_token, master_refresh_token)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token error: {e}"}))
        return

    # Build workbook in memory
    wb = openpyxl.Workbook()
    wb.remove(wb.active)  # remove default sheet

    tabs = [
        ('AllAwards',         ALL_COLS,      all_rows),
        ('SportsAward',       SPORTS_COLS,   sports_rows),
        ('CulturalAward',     CULTURAL_COLS, cultural_rows),
        ('TrailblazerAward',  TRAIL_COLS,    trailblazer_rows),
    ]
    for tab_name, cols, rows in tabs:
        ws = wb.create_sheet(tab_name)
        write_sheet(ws, cols, rows, tab_name)

    # Save to temp file
    tmp = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    tmp.close()
    wb.save(tmp.name)

    try:
        drive_service  = build('drive',       'v3', credentials=master_creds)
        sheets_service = build('sheets',      'v4', credentials=master_creds)

        # Upload as Google Sheets
        file_metadata = {
            'name':     'FLAME Awards — Admin Workbook',
            'mimeType': 'application/vnd.google-apps.spreadsheet',
            'parents':  [folder_id],
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

        # Fetch sheet GIDs for protection
        meta = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        for sheet in meta.get('sheets', []):
            gid = sheet['properties']['sheetId']
            protect_sheets_columns(sheets_service, spreadsheet_id, gid)

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
