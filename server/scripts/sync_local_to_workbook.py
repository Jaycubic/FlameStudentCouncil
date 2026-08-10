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
# Photo URL pattern: https://flamestudentcouncil.in/api/photos/<student_id>
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

ELECTION_COLS = [
    'student_id', 'name', 'email', 'gender', 'batch', 'mobile_number',
    'position_selected', 'community_service', 'statement_of_purpose', 'more_info',
    'read_handbook', 'not_on_probation', 'tru_statement',
    'academic_score', 'sports_score', 'cultural_score',
    'sports_director_score', 'cultural_director_score',
    'sports_verified_score', 'cultural_verified_score', 'academic_verified_score',
    'total_verified_score', 'submission_date',
    'Workbook Link', 'Attachment'
]

# URL columns shown as clickable hyperlinks with short labels (USER_ENTERED interprets =HYPERLINK)
HYPERLINK_COLS = {
    'Workbook Link': 'Student Workbook',
    'Attachment':    'View PDF',
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
        https://flamestudentcouncil.in/api/photos/<student_id>
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
    for idx, record in enumerate(rows):
        ri = idx + 2   # row 2 is first data row
        photo = get_photo_formula(record.get('photo_url', ''))
        row = [photo]
        for col in cols:
            if col == 'sports_verified_score':
                val = f'=IFERROR(IF(VALUE(P{ri})<=150, ROUND(VALUE(P{ri})/15, 2), ROUND(MIN(10 + 0.05*(VALUE(P{ri})-150), 12), 2)), 0)'
            elif col == 'cultural_verified_score':
                val = f'=IFERROR(IF(VALUE(Q{ri})<=150, ROUND(VALUE(Q{ri})/15, 2), ROUND(MIN(10 + 0.05*(VALUE(Q{ri})-150), 12), 2)), 0)'
            elif col == 'academic_verified_score':
                val = f'=IFERROR(VALUE(O{ri}), 0)'
            elif col == 'total_verified_score':
                val = f'=MIN(30, ROUND(SUM(T{ri}:V{ri}) + IFERROR(VALUE(R{ri}), 0) + IFERROR(VALUE(S{ri}), 0), 2))'
            else:
                val = record.get(col, '')
                if isinstance(val, bool):
                    val = 'True' if val else 'False'
                elif str(val).lower() == 'true':
                    val = 'True'
                elif str(val).lower() == 'false':
                    val = 'False'
                elif val is None:
                    val = ''
                elif col in HYPERLINK_COLS and val:
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

    all_rows    = data.get('all', [])
    by_position = data.get('byPosition', {})

    def safe_score(row, key='total_verified_score'):
        try:
            val = row.get(key)
            if val is None or str(val).strip() == '' or str(val).strip() == '—':
                return 0.0
            return float(val)
        except (ValueError, TypeError):
            return 0.0

    all_rows.sort(key=lambda r: safe_score(r), reverse=True)
    for pos in by_position:
        by_position[pos].sort(key=lambda r: safe_score(r), reverse=True)

    tabs = [('All Responses', ELECTION_COLS, all_rows)]

    used_titles = {'All Responses'}
    for pos_name, pos_rows in by_position.items():
        safe_title = pos_name[:31].replace('[', '').replace(']', '').replace('*', '').replace(':', '').replace('?', '').replace('/', '\\')
        if not safe_title or safe_title in used_titles:
            safe_title = f"{safe_title[:27]}_{len(used_titles)}"
        used_titles.add(safe_title)
        tabs.append((safe_title, ELECTION_COLS, pos_rows))

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)

        # ── 1. Get sheet GIDs ───────────────────────────────────────────────
        meta    = sheets_service.spreadsheets().get(spreadsheetId=workbook_id).execute()
        gid_map = {
            s['properties']['title']: s['properties']['sheetId']
            for s in meta.get('sheets', [])
        }

        # ── 2. Clear all tab values ───────────────────────────────────────────
        clear_ranges = [f"'{t}'!A:Z" for t, _, __ in tabs if t in gid_map]
        if clear_ranges:
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
