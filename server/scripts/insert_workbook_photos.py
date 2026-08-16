# scripts/insert_workbook_photos.py
#
# Inserts =IMAGE() formulas into column A of all tabs in the Admin Workbook,
# using the Sheets API with USER_ENTERED (same proven approach as
# insert_photo_formula.py which works reliably for individual student sheets).
#
# Photos are served from the local server (https://flamestudentcouncil.in/api/photos/<student_id>)
# which never expires — unlike Google Drive URLs that break when a student's
# OAuth token is revoked.
#
# PHOTO MATCHING: Photos are matched to rows by student_id (column B in the
# spreadsheet), NOT by array index. This prevents the mismatch bug caused by
# different sort orders between the controller (email-sorted) and the Python
# workbook generator (score-sorted).
#
# Also applies mergeCells on the All Responses tab so same-student rows share
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
#   "All Responses": [{ "photo_url": "https://...", "email": "...", "student_id": "..." }, ...],
# }
# If photo_url is empty for a student, their Photo cell is left blank (no broken image).
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


def get_photo_formula(photo_url):
    """Return =IMAGE() formula using the given local server URL, or '' if empty.

    photo_url should be a fully-qualified HTTPS URL such as:
        https://flamestudentcouncil.in/api/photos/<student_id>
    An empty string means the student has no uploaded photo — leave the cell blank.
    """
    if not photo_url:
        return ''
    return f'=IMAGE("{photo_url}")'


def build_merge_requests(sheet_gid, student_ids, start_row_index=1):
    """Build Sheets API mergeCells requests for column A (Photo),
    grouping consecutive rows with the same student_id."""
    requests = []
    current  = start_row_index
    for _sid, grp in groupby(student_ids):
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

    # ── Diagnostic: count how many photo_urls are non-empty ───────────────────────
    stats = {}
    for tab_name, rows in photo_data.items():
        total      = len(rows)
        with_photo = sum(1 for r in rows if r.get('photo_url'))
        stats[tab_name] = {'total': total, 'with_photo': with_photo}
        # Log to stderr for Node.js debug visibility
        print(f"[PhotoInsert] {tab_name}: {with_photo}/{total} rows have photo_url", file=sys.stderr)

    all_have_photo = sum(s['with_photo'] for s in stats.values())
    if all_have_photo == 0:
        print(json.dumps({
            'success': True,
            'warning': 'No photo_url found for any student — wrote empty Photo column',
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

        # ── Build student_id → photo_url map from input payload ──────────────
        # This decouples photo assignment from array order entirely.
        sid_photo_maps = {}
        for tab_name, rows in photo_data.items():
            photo_map = {}
            for record in rows:
                sid = str(record.get('student_id', '')).strip()
                if sid:
                    photo_map[sid] = record.get('photo_url', '')
            sid_photo_maps[tab_name] = photo_map

        # ── Read student_id column (B) from each tab in the actual spreadsheet ──
        # This tells us the real row order after any sorting the generator applied.
        read_ranges = [f"'{tab_name}'!B:B" for tab_name in photo_data.keys()]
        if read_ranges:
            batch_result = execute_with_retry(
                sheets_service.spreadsheets().values().batchGet(
                    spreadsheetId=spreadsheet_id,
                    ranges=read_ranges,
                )
            )
            range_results = batch_result.get('valueRanges', [])
        else:
            range_results = []

        # ── Write =IMAGE() formulas to column A, matched by student_id ───────
        value_data = []
        tab_student_id_order = {}   # tab_name → [student_ids in spreadsheet order]

        for i, tab_name in enumerate(photo_data.keys()):
            photo_map = sid_photo_maps.get(tab_name, {})
            if not photo_map:
                continue

            # Get the student_id column values from the spreadsheet
            if i < len(range_results):
                col_b_values = range_results[i].get('values', [])
            else:
                col_b_values = []

            if len(col_b_values) < 2:
                # No data rows in the sheet — skip
                print(f"[PhotoInsert] {tab_name}: no data rows found in column B — skipping", file=sys.stderr)
                continue

            # col_b_values[0] = header ('student_id'), col_b_values[1:] = data
            values = [['Photo']]   # header row
            sheet_student_ids = []

            for row_data in col_b_values[1:]:
                sid = str(row_data[0]).strip() if row_data else ''
                sheet_student_ids.append(sid)
                # Look up the photo for THIS student_id
                photo_url = photo_map.get(sid, '')
                formula = get_photo_formula(photo_url)
                values.append([formula])

            value_data.append({
                'range':  f"'{tab_name}'!A1",
                'values': values,
            })
            tab_student_id_order[tab_name] = sheet_student_ids

            matched = sum(1 for sid in sheet_student_ids if photo_map.get(sid))
            print(f"[PhotoInsert] {tab_name}: matched {matched}/{len(sheet_student_ids)} rows by student_id", file=sys.stderr)

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

        # ── Merge All Responses column A for same-student rows ───────────────
        all_sids = tab_student_id_order.get('All Responses', [])
        if all_sids:
            meta     = sheets_service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
            gid_map  = {
                s['properties']['title']: s['properties']['sheetId']
                for s in meta.get('sheets', [])
            }
            all_gid  = gid_map.get('All Responses')

            if all_gid is not None:
                merge_reqs = build_merge_requests(all_gid, all_sids, start_row_index=1)
                if merge_reqs:
                    execute_with_retry(
                        sheets_service.spreadsheets().batchUpdate(
                            spreadsheetId=spreadsheet_id,
                            body={'requests': merge_reqs}
                        )
                    )
                    print(f"[PhotoInsert] Merged {len(merge_reqs)} groups in All Responses column A", file=sys.stderr)

        print(json.dumps({'success': True, 'stats': stats}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
