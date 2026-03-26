# scripts/revoke_access.py
#
# Usage:
#   python3 revoke_access.py <file_id> <student_permission_id>
#                            <master_access_token> <master_refresh_token>
#
# Runs as MASTER (owner of the file).
#
# Why this works cleanly now:
#   generate_sheet.py moves the file into master's PRIVATE folder before we
#   ever store the permission ID. A private folder breaks domain-wide inherited
#   permissions, so the student's entry is always an explicit permission —
#   permissions().delete() succeeds with no 403 edge cases.

import sys
import json
import os
import time
import socket

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

socket.setdefaulttimeout(30)


# ─── Retry helper ─────────────────────────────────────────────────────────────

def execute_with_retry(request, max_retries=4):
    for attempt in range(max_retries):
        try:
            return request.execute()
        except HttpError as e:
            status = e.resp.status
            if status in (429, 500, 503) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                raise


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments. Expected: file_id student_permission_id master_access_token master_refresh_token"}))
        return

    file_id               = sys.argv[1]
    student_permission_id = sys.argv[2]
    master_access_token   = sys.argv[3]
    master_refresh_token  = sys.argv[4]

    creds = Credentials(
        token=master_access_token,
        refresh_token=master_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive']
    )

    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Master token refresh failed: {str(e)}"}))
        return

    try:
        service = build('drive', 'v3', credentials=creds)

        # The file lives in master's private folder → student's permission is
        # always explicit (no domain inheritance) → delete succeeds cleanly.
        # The file itself stays intact in master's Drive.
        try:
            execute_with_retry(
                service.permissions().delete(
                    fileId=file_id,
                    permissionId=student_permission_id
                )
            )
            print(json.dumps({
                "success": True,
                "message": f"Removed student permission {student_permission_id} from file {file_id}. File retained in master Drive."
            }))

        except HttpError as e:
            if e.resp.status == 404:
                # Permission already gone — treat as success
                print(json.dumps({
                    "success": True,
                    "message": "Permission already removed (404). File retained in master Drive."
                }))
            else:
                raise

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()