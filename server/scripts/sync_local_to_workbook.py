# scripts/sync_local_to_workbook.py
#
# Overwrites all 4 tabs in the awards workbook with fresh local data.
# Mirrors the column layout from generate_awards_workbook.py:
#   • Column A  — Photo  (=IMAGE() formula using local server URL)
#   • Column B+ — data columns
#
# AllAwards tab photo column: intelligently merges same-student rows
# (unmerge → clear → rewrite → re-merge on every sync).
#
# Photo URL pattern: https://flameawards.in/api/photos/<student_id>
#   • Served from local disk — never expires (no Google Drive token issues)
#   • If photo_url is '' (no local photo) — cell is left blank, no broken image
#
# Usage:
#   python3 sync_local_to_workbook.py \
#       <workbook_id> <master_access_token> <master_refresh_token>  (json_data_base64 via stdin)
#
# json_data_base64: same schema as generate_awards_workbook.py
#   (each row has photo_url, student_id, name, email, …)

import sys, json, os, base64, socket, time
from itertools import groupby

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

socket.setdefaulttimeout(120)
SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
]

PHOTO_COL_WIDTH  = 22   # kept for reference — width is already set at workbook creation time

# Data columns (same order as generate_awards_workbook.py — Photo is prepended separately)
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

# URL columns shown as clickable hyperlinks with short labels (USER_ENTERED interprets =HYPERLINK)
HYPERLINK_COLS = {
    'Sports Sheet Link':   'Sports Matrix',
    'Cultural Sheet Link': 'Cultural Matrix',
    'Academic Sheet Link': 'Academic Matrix',
    'Attachment':          'View PDF',
}

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
    """Return =IMAGE() formula using the given local server URL, or '' if empty.

    photo_url is a fully-qualified HTTPS URL like:
        https://flameawards.in/api/photos/<student_id>
    An empty string means no photo was uploaded — leave the cell blank.
    """
    if not photo_url:
        return ''
    return f'=IMAGE("{photo_url}")'


def rows_to_values(cols, rows):
    """
    Build 2D array suitable for values().batchUpdate().
    Row[0] = header  → ['Photo', col1, col2, …]
    Row[n] = data    → [=IMAGE(<local_url>), val1, val2, …]
    URL columns are wrapped in =HYPERLINK() for short clickable labels.
    """
    header = ['Photo'] + list(cols)
    result = [header]
    for record in rows:
        photo    = get_photo_formula(record.get('photo_url', ''))
        row = [photo]
        for col in cols:
            val = record.get(col, '') or ''
            # Wrap URL columns in =HYPERLINK() formula
            if col in HYPERLINK_COLS and val:
                label = HYPERLINK_COLS[col]
                val = f'=HYPERLINK("{val}", "{label}")'
            else:
                val = str(val)
            row.append(val)
        result.append(row)
    return result


def build_unmerge_request(sheet_gid, num_data_rows):
    """Return a Sheets API unmergeCells request for column A (photo col) data rows."""
    if num_data_rows < 1:
        return None
    return {
        "unmergeCells": {
            "range": {
                "sheetId":        sheet_gid,
                "startRowIndex":  1,              # row 2 (0-indexed) = first data row
                "endRowIndex":    1 + num_data_rows,
                "startColumnIndex": 0,            # col A
                "endColumnIndex":   1,
            }
        }
    }


def build_merge_requests(sheet_gid, rows, start_row_index=1):
    """
    Return a list of Sheets API mergeCells requests for column A,
    grouping consecutive rows with the same email.
    rows must be sorted so same-student rows are adjacent (sorted by email in JS).
    """
    requests = []
    current = start_row_index

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
            "error": "Usage: workbook_id access_token refresh_token  (json_data_base64 via stdin)"
        }))
        return

    workbook_id          = sys.argv[1]
    master_access_token  = sys.argv[2]
    master_refresh_token = sys.argv[3]

    # Large JSON payload via stdin — avoids Linux ARG_MAX (E2BIG) limit
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
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        return

    try:
        creds = build_credentials(master_access_token, master_refresh_token)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token error: {e}"}))
        return

    all_rows         = data.get('all',         [])
    sports_rows      = data.get('sports',      [])
    cultural_rows    = data.get('cultural',    [])
    trailblazer_rows = data.get('trailblazer', [])

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

    tabs = [
        ('AllAwards',        ALL_COLS,      all_rows),
        ('SportsAward',      SPORTS_COLS,   sports_rows),
        ('CulturalAward',    CULTURAL_COLS, cultural_rows),
        ('TrailblazerAward', TRAIL_COLS,    trailblazer_rows),
    ]

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)

        # ── 1. Get sheet GIDs (needed for merge/unmerge requests) ─────────────
        meta           = sheets_service.spreadsheets().get(spreadsheetId=workbook_id).execute()
        gid_map        = {
            s['properties']['title']: s['properties']['sheetId']
            for s in meta.get('sheets', [])
        }
        all_gid = gid_map.get('AllAwards')

        # ── 2. Unmerge existing photo-column merges in AllAwards ──────────────
        # (batchClear only clears values, NOT merge state — so we must unmerge
        #  explicitly before re-writing, then re-merge after writing)
        if all_gid is not None and all_rows:
            unmerge_req = build_unmerge_request(all_gid, len(all_rows))
            if unmerge_req:
                try:
                    sheets_service.spreadsheets().batchUpdate(
                        spreadsheetId=workbook_id,
                        body={'requests': [unmerge_req]}
                    ).execute()
                except Exception:
                    # Non-fatal: may fail if no merges existed yet
                    pass

        # ── 3. Clear all tab values ───────────────────────────────────────────
        clear_ranges = [f"'{t}'!A:Z" for t, _, __ in tabs]
        sheets_service.spreadsheets().values().batchClear(
            spreadsheetId=workbook_id,
            body={'ranges': clear_ranges},
        ).execute()

        # ── 4. Write fresh values (Photo col A + data cols B+) ────────────────
        data_requests = []
        for tab_name, cols, rows in tabs:
            values = rows_to_values(cols, rows)
            data_requests.append({
                'range':  f"'{tab_name}'!A1",
                'values': values,
            })

        execute_with_retry(
            sheets_service.spreadsheets().values().batchUpdate(
                spreadsheetId=workbook_id,
                body={
                    'valueInputOption': 'USER_ENTERED',   # interprets =IMAGE() as formula
                    'data': data_requests,
                }
            )
        )

        # ── 5. Re-merge AllAwards photo column for same-student rows ──────────
        if all_gid is not None and all_rows:
            merge_reqs = build_merge_requests(all_gid, all_rows, start_row_index=1)
            if merge_reqs:
                execute_with_retry(
                    sheets_service.spreadsheets().batchUpdate(
                        spreadsheetId=workbook_id,
                        body={'requests': merge_reqs}
                    )
                )

        print(json.dumps({"success": True, "tabs_updated": len(tabs)}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()
