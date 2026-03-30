# scripts/sync_workbook_to_local.py
#
# Reads all 4 tabs from the awards workbook, merges by student_id.
# Returns JSON: { success, rows: [{ student_id, ... editable fields ... }] }
# Never returns student_id / name / email as editable (controller enforces this).
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

# Columns that CAN be synced back to local (all others are ignored)
SYNCABLE_FIELDS = {
    'cgpa', 'sports_score', 'cultural_score',
    'sports_verified_score', 'cultural_verified_score',
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
    """Read a tab and return list of {col: val} dicts."""
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
        rows.append(dict(zip(headers, padded)))
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

        # Read AllAwards tab — most complete view
        all_rows = read_tab(sheets_service, workbook_id, 'AllAwards')

        # Merge rows from other tabs for any fields AllAwards may not have
        sports_rows    = {r['student_id']: r for r in read_tab(sheets_service, workbook_id, 'SportsAward')    if r.get('student_id')}
        cultural_rows  = {r['student_id']: r for r in read_tab(sheets_service, workbook_id, 'CulturalAward')  if r.get('student_id')}
        trail_rows     = {r['student_id']: r for r in read_tab(sheets_service, workbook_id, 'TrailblazerAward') if r.get('student_id')}

        output = []
        for row in all_rows:
            sid = row.get('student_id', '').strip()
            if not sid:
                continue

            # Merge from specialised tabs (more accurate per-field data)
            merged = {**row}
            for tab_map in [sports_rows, cultural_rows, trail_rows]:
                if sid in tab_map:
                    for k, v in tab_map[sid].items():
                        if k in SYNCABLE_FIELDS and v:
                            merged[k] = v

            # Return only student_id (key) + syncable fields
            safe = {'student_id': sid}
            for field in SYNCABLE_FIELDS:
                val = merged.get(field, '') or ''
                safe[field] = val if val.strip() else None

            output.append(safe)

        print(json.dumps({"success": True, "rows": output}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()
