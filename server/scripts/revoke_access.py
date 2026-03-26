# scripts/revoke_access.py
#
# Usage:
#   python3 revoke_access.py <file_id> <master_access_token> <master_refresh_token>
#
# Runs as MASTER (owner of the file).
#
# Strategy:
#   The file lives in master's private folder. After the student submits their
#   form, we no longer need the sheet at all — so just delete it entirely.
#   This guarantees the file disappears from the student's "Shared with me"
#   and any direct links go dead immediately. No permission-revoke edge cases.

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
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Missing arguments. Expected: file_id master_access_token master_refresh_token"}))
        return

    file_id              = sys.argv[1]
    master_access_token  = sys.argv[2]
    master_refresh_token = sys.argv[3]

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

        # Master owns the file → delete it entirely.
        # This removes it from everyone's Drive, including the student's
        # "Shared with me" view, and invalidates any direct links.
        try:
            execute_with_retry(
                service.files().delete(fileId=file_id)
            )
            print(json.dumps({
                "success": True,
                "message": f"File {file_id} permanently deleted."
            }))

        except HttpError as e:
            if e.resp.status == 404:
                # Already gone — treat as success
                print(json.dumps({
                    "success": True,
                    "message": f"File {file_id} already deleted (404)."
                }))
            else:
                raise

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()