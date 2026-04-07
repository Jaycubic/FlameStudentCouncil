# scripts/rename_and_share.py
#
# Hot-path script: takes a pre-created pool sheet, renames it for the student,
# and grants them writer access. Only 2 Drive API calls — no upload, no copy.
#
# Usage:
#   python3 rename_and_share.py <sheet_id> <student_email> <display_name>
#                               <master_access_token> <master_refresh_token>
#
# Returns: { success, student_permission_id } or { success: false, error }

import sys
import json
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def main():
    if len(sys.argv) < 6:
        print(json.dumps({
            "success": False,
            "error": (
                "Usage: rename_and_share.py <sheet_id> <student_email> <display_name> "
                "<master_access_token> <master_refresh_token>"
            )
        }))
        return

    sheet_id      = sys.argv[1]
    student_email = sys.argv[2]
    display_name  = sys.argv[3]   # e.g. "Sports Matrix - 12345"
    access_token  = sys.argv[4]
    refresh_token = sys.argv[5]

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive']
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token refresh failed: {e}"}))
        return

    try:
        service = build('drive', 'v3', credentials=creds)

        # Call 1 — Rename (master already owns the file, this is instant)
        service.files().update(
            fileId=sheet_id,
            body={'name': display_name},
            fields='id'
        ).execute()

        # Call 2 — Share with student
        perm = service.permissions().create(
            fileId=sheet_id,
            body={
                'type':         'user',
                'role':         'writer',
                'emailAddress': student_email,
            },
            fields='id',
            sendNotificationEmail=False
        ).execute()

        student_perm_id = perm.get('id')
        if not student_perm_id:
            print(json.dumps({"success": False, "error": "Permission created but no ID returned"}))
            return

        print(json.dumps({
            "success":              True,
            "student_permission_id": student_perm_id
        }))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()