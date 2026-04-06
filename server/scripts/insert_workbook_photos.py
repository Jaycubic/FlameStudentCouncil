# scripts/insert_workbook_photos.py
#
# Inserts =IMAGE() formulas into column A of all tabs in the Admin Workbook,
# using the Sheets API with USER_ENTERED (same proven approach as
# insert_photo_formula.py which works reliably for individual student sheets).
#
# Also applies mergeCells on the AllAwards tab so same-student rows share
# one photo cell.
#
# Usage:
#   python3 insert_workbook_photos.py \
#       <spreadsheet_id> \
#       <master_access_token> <master_refresh_token> \
#       <photo_data_base64>
#
# photo_data_base64: base64-encoded JSON:
# {
#   "AllAwards":        [{ "photo_drive_id": "...", "email": "..." }, ...],
#   "SportsAward":      [{ "photo_drive_id": "...", "email": "..." }, ...],
#   "CulturalAward":    [{ "photo_drive_id": "...", "email": "..." }, ...],
#   "TrailblazerAward": [{ "photo_drive_id": "...", "email": "..." }, ...]
# }
#
# Returns: { "success": true, "stats": {...} }
#       OR { "success": false, "error": "..." }

import sys
import json
import os
import base64
import time
import socket
from itertools import groupby

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

socket.setdefaulttimeout(120)

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
]

PHOTO_BASE_URL = 'https://lh3.googleusercontent.com/d/'


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
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=SCOPES,
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        raise RuntimeError(f'Master token refresh failed: {e}')
    return creds


def get_photo_formula(drive_file_id):
    if not drive_file_id:
        return ''
    return f'=IMAGE("{PHOTO_BASE_URL}{drive_file_id}")'


def build_merge_requests(sheet_gid, rows, start_row_index=1):
    """Build Sheets API mergeCells requests for column A (Photo),
    grouping consecutive rows with the same email."""
    requests = []
    current  = start_row_index
    for _email, grp in groupby(rows, key=lambda r: r.get('email', '')):
        group_rows = list(grp)
        count      = len(group_rows)
        if count > 1:
            requests.append({
                'mergeCells': {
                    'range': {
                        'sheetId':          sheet_gid,
                        'startRowIndex':    current,
                        'endRowIndex':      current + count,
                        'startColumnIndex': 0,
                        'endColumnIndex':   1,
                    },
                    'mergeType': 'MERGE_ALL'
                }
            })
        current += count
    return requests


def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            'success': False,
            'error': 'Usage: insert_workbook_photos.py spreadsheet_id access_token refresh_token photo_data_base64'
        }))
        return

    spreadsheet_id     = sys.argv[1]
    master_access      = sys.argv[2]
    master_refresh     = sys.argv[3]
    photo_data_b64     = sys.argv[4]

    try:
        photo_data = json.loads(base64.b64decode(photo_data_b64).decode('utf-8'))
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Invalid photo_data JSON: {e}'}))
        return

    # ── Diagnostic: count how many photo_drive_ids are non-empty ──────────────
    stats = {}
    for tab_name, rows in photo_data.items():
        total      = len(rows)
        with_photo = sum(1 for r in rows if r.get('photo_drive_id'))
        stats[tab_name] = {'total': total, 'with_photo': with_photo}
        # Log to stderr for Node.js debug visibility
        print(f"[PhotoInsert] {tab_name}: {with_photo}/{total} rows have photo_drive_id", file=sys.stderr)

    all_have_photo = sum(s['with_photo'] for s in stats.values())
    if all_have_photo == 0:
        print(json.dumps({
            'success': True,
            'warning': 'No photo_drive_id found for any student — wrote empty Photo column',
            'stats': stats
        }))
        return

    try:
        creds = build_credentials(master_access, master_refresh)
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        return

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)

        # ── 1. Write =IMAGE() formulas to column A on every tab ───────────────
        value_data = []
        for tab_name, rows in photo_data.items():
            if not rows:
                continue
            values = [['Photo']]    # row 1: header
            for record in rows:
                formula = get_photo_formula(record.get('photo_drive_id', ''))
                values.append([formula])    # rows 2..N: data
            value_data.append({
                'range':  f"'{tab_name}'!A1",
                'values': values,
            })

        if value_data:
            result = execute_with_retry(
                sheets_service.spreadsheets().values().batchUpdate(
                    spreadsheetId=spreadsheet_id,
                    body={
                        'valueInputOption': 'USER_ENTERED',
                        'data': value_data,
                    }
                )
            )
            updated_cells = result.get('totalUpdatedCells', 0)
            print(f"[PhotoInsert] Sheets API updated {updated_cells} cells", file=sys.stderr)

        # ── 2. Merge AllAwards column A for same-student rows ─────────────────
        all_rows = photo_data.get('AllAwards', [])
        if all_rows:
            meta     = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
            gid_map  = {
                s['properties']['title']: s['properties']['sheetId']
                for s in meta.get('sheets', [])
            }
            all_gid  = gid_map.get('AllAwards')

            if all_gid is not None:
                merge_reqs = build_merge_requests(all_gid, all_rows, start_row_index=1)
                if merge_reqs:
                    execute_with_retry(
                        sheets_service.spreadsheets().batchUpdate(
                            spreadsheetId=spreadsheet_id,
                            body={'requests': merge_reqs}
                        )
                    )
                    print(f"[PhotoInsert] Merged {len(merge_reqs)} groups in AllAwards column A", file=sys.stderr)

        print(json.dumps({'success': True, 'stats': stats}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
