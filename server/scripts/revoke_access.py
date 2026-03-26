# scripts/revoke_access.py
#
# Usage:
#   python3 revoke_access.py <file_id> <student_permission_id>
#                            <master_access_token> <master_refresh_token>
#
# Runs as MASTER (who is now the owner of the file).
# Deletes the student's writer permission — student loses all access.
#
# This works because sheets are now created inside a private master-only folder
# with no inherited domain permissions. The student's only access is the explicit
# permission we granted, which is fully controllable.

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

    # ── Build master credentials ──────────────────────────────────────────────
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

        # Delete the student's permission — they lose all access immediately.
        # This works because sheets now live in a private folder with no
        # inherited domain permissions.
        execute_with_retry(
            service.permissions().delete(
                fileId=file_id,
                permissionId=student_permission_id
            )
        )

        print(json.dumps({"success": True, "message": f"Revoked permission {student_permission_id} on file {file_id}"}))

    except HttpError as e:
        # 404 = permission already removed (idempotent — treat as success)
        if e.resp.status == 404:
            print(json.dumps({"success": True, "message": "Permission already removed (404 — idempotent)."}))
        else:
            print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()