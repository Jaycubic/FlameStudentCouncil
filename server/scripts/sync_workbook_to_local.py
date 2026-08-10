# scripts/sync_workbook_to_local.py
#
# Reads all 4 tabs from the awards workbook, merges by student_id.
# Returns JSON: { success, rows: [{ student_id, ... editable fields ... }] }
# Never returns student_id / name / email as editable (controller enforces this).
#
# Photo column (col A) is intentionally ignored on read-back:
#   • It contains a =IMAGE() formula (local server URL) — not a data value.
#   • It must never be synced back to the DB; the formula is re-inserted
#     by the controller/Python layer on every sync push.
#
# Usage:
#   python3 sync_workbook_to_local.py <workbook_id> <master_access_token> <master_refresh_token>

import sys, json, os, socket
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

socket.setdefaulttimeout(60)

SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
]

# Column A header is always 'Photo' (formula column — skip on read-back)
PHOTO_COL = 'Photo'

SYNCABLE_FIELDS = {
    'academic_score', 'sports_score', 'cultural_score',
    'sports_director_score', 'cultural_director_score',
    'sports_verified_score', 'cultural_verified_score',
    'academic_verified_score', 'total_verified_score',
}

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


def read_tab(sheets_service, spreadsheet_id, tab_name):
    """Read a tab and return list of {col: val} dicts.

    The Photo column (col A, header='Photo') is always skipped:
    it holds a =IMAGE() formula — not a data value — and must never
    be returned to the controller as a syncable field.
    """
    try:
        result = sheets_service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=f"'{tab_name}'!A1:Z",
        ).execute()
    except Exception:
        return []

    values = result.get('values', [])
    if not values:
        return []

    headers = [h.strip() for h in values[0]]
    rows = []
    for row in values[1:]:
        padded = row + [''] * (len(headers) - len(row))
        record = dict(zip(headers, padded))
        # Drop the Photo col — it's a formula string, not real data
        record.pop(PHOTO_COL, None)
        rows.append(record)
    return rows


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Usage: workbook_id access_token refresh_token"}))
        return

    workbook_id          = sys.argv[1]
    master_access_token  = sys.argv[2]
    master_refresh_token = sys.argv[3]

    try:
        creds = build_credentials(master_access_token, master_refresh_token)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token error: {e}"}))
        return

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)

        # Get metadata to find all sheet tabs
        meta = sheets_service.spreadsheets().get(spreadsheetId=workbook_id).execute()
        sheet_titles = [s['properties']['title'] for s in meta.get('sheets', [])]

        output_map = {}   # student_id → merged safe dict

        # Process 'All Responses' first, then position tabs
        ordered_tabs = []
        if 'All Responses' in sheet_titles:
            ordered_tabs.append('All Responses')
        for title in sheet_titles:
            if title not in ordered_tabs:
                ordered_tabs.append(title)

        for tab_name in ordered_tabs:
            tab_rows = read_tab(sheets_service, workbook_id, tab_name)
            for row in tab_rows:
                sid = row.get('student_id', '').strip()
                if not sid:
                    continue

                safe = {'student_id': sid}
                for field in SYNCABLE_FIELDS:
                    val = row.get(field, '') or ''
                    safe[field] = val.strip() if isinstance(val, str) else val or None

                if sid not in output_map:
                    output_map[sid] = safe
                else:
                    existing = output_map[sid]
                    for field in SYNCABLE_FIELDS:
                        if (existing.get(field) is None or existing.get(field) == '') and safe.get(field) is not None and safe.get(field) != '':
                            existing[field] = safe[field]

        output = list(output_map.values())
        print(json.dumps({"success": True, "rows": output}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()
