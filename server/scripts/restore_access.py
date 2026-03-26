# scripts/restore_access.py
#
# Usage:
#   python3 restore_access.py <file_id> <student_email>
#                             <master_access_token> <master_refresh_token>
#
# Runs as MASTER (owner of the file).
# Re-grants the student writer access on a previously-revoked sheet.
# Returns the new student_permission_id for DB storage.

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


def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            "success": False,
            "error": "Missing arguments. Expected: file_id student_email master_access_token master_refresh_token"
        }))
        return

    file_id              = sys.argv[1]
    student_email        = sys.argv[2]
    master_access_token  = sys.argv[3]
    master_refresh_token = sys.argv[4]

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

        # Add student as writer — master owns the file so this always works
        perm = execute_with_retry(
            service.permissions().create(
                fileId=file_id,
                body={
                    'type': 'user',
                    'role': 'writer',
                    'emailAddress': student_email
                },
                fields='id',
                sendNotificationEmail=False
            )
        )

        print(json.dumps({
            "success": True,
            "student_permission_id": perm.get('id'),
            "message": f"Re-granted writer access to {student_email} on file {file_id}"
        }))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()
