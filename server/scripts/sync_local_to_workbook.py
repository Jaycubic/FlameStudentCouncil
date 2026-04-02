# scripts/sync_local_to_workbook.py
#
# Overwrites all 4 tabs in the awards workbook with fresh local data.
#
# Usage:
#   python3 sync_local_to_workbook.py \
#       <workbook_id> <master_access_token> <master_refresh_token> <json_data_base64>
#
# json_data_base64: same format as generate_awards_workbook.py

import sys, json, os, base64, socket, time
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

socket.setdefaulttimeout(120)
SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
]

ALL_COLS     = ['student_id','name','email','gender','batch','mobile_number',
                'academic_score','sports_score','cultural_score',
                'sports_verified_score','cultural_verified_score',
                'submission_date','Sports Sheet Link','Cultural Sheet Link','Academic Sheet Link']
SPORTS_COLS  = ['student_id','name','email','gender','batch','mobile_number',
                'sports_score','sports_verified_score',
                'submission_date','Sports Sheet Link']
CULTURAL_COLS= ['student_id','name','email','gender','batch','mobile_number',
                'cultural_score','cultural_verified_score',
                'submission_date','Cultural Sheet Link']
TRAIL_COLS   = ['student_id','name','email','gender','batch','mobile_number',
                'academic_score','sports_score','cultural_score',
                'sports_verified_score','cultural_verified_score',
                'submission_date','Sports Sheet Link','Cultural Sheet Link','Academic Sheet Link']


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


def rows_to_values(cols, rows):
    """Build 2D array: [header_row, data_row, ...]"""
    result = [cols]
    for record in rows:
        row = []
        for col in cols:
            val = record.get(col, '') or ''
            row.append(str(val))
        result.append(row)
    return result


def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Usage: workbook_id access_token refresh_token json_data_base64"}))
        return

    workbook_id          = sys.argv[1]
    master_access_token  = sys.argv[2]
    master_refresh_token = sys.argv[3]
    json_data_b64        = sys.argv[4]

    try:
        data = json.loads(base64.b64decode(json_data_b64).decode('utf-8'))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        return

    try:
        creds = build_credentials(master_access_token, master_refresh_token)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token error: {e}"}))
        return

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)

        tabs = [
            ('AllAwards',        ALL_COLS,      data.get('all',         [])),
            ('SportsAward',      SPORTS_COLS,   data.get('sports',      [])),
            ('CulturalAward',    CULTURAL_COLS, data.get('cultural',    [])),
            ('TrailblazerAward', TRAIL_COLS,    data.get('trailblazer', [])),
        ]

        data_requests = []
        for tab_name, cols, rows in tabs:
            values = rows_to_values(cols, rows)
            data_requests.append({
                'range':  f"'{tab_name}'!A1",
                'values': values,
            })

        # First clear each tab, then write fresh data
        clear_ranges = [f"'{t}'!A:Z" for t, _, __ in tabs]
        sheets_service.spreadsheets().values().batchClear(
            spreadsheetId=workbook_id,
            body={'ranges': clear_ranges},
        ).execute()

        execute_with_retry(
            sheets_service.spreadsheets().values().batchUpdate(
                spreadsheetId=workbook_id,
                body={
                    'valueInputOption': 'USER_ENTERED',
                    'data': data_requests,
                }
            )
        )

        print(json.dumps({"success": True, "tabs_updated": len(tabs)}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()
