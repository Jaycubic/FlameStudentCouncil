# scripts/generate_sheet.py
#
# Usage:
#   python3 generate_sheet.py <type> <student_email>
#                             <student_access_token> <student_refresh_token>
#                             <master_email> <master_access_token> <master_refresh_token>
#                             <folder_id>
#                             [student_id]
#
# Fallback path: used when the pre-built pool is empty.
#
# Since the template is a native Google Sheet, we use files.copy() on the
# master account (fast, server-side, no upload needed).
#
# Flow:
#   1. Master copies the template via files.copy()  → master owns the copy
#   2. Master shares (writer) with the student
#   3. Master moves copy into private folder
#   4. Return { success, sheet_id, link, student_permission_id }
#
# The student does NOT need to own the file — master owns everything.
# revoke_access.py removes the student's writer permission after submission.

import sys
import json
import os
import time
import socket

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

socket.setdefaulttimeout(90)

# Template Drive ID — native Google Sheet
DEFAULT_TEMPLATE_ID = '1qB2m7mRO21NkhWZWxw68K4nkjBTuERJSy5M8ctFnyeE'

# Master-owned private folder
FOLDER_ID = '1EKS37zB71mAXyGRz5Mu1VxUEZJI2KXyI'

NAME_MAP = {
    'workbook': 'Student Council Workbook',
}


# ─── Retry helper ─────────────────────────────────────────────────────────────

def execute_with_retry(request, max_retries=4):
    for attempt in range(max_retries):
        try:
            return request.execute()
        except HttpError as e:
            status = e.resp.status
            if status in (429, 500, 503) and attempt < max_retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s, 4s, 8s
            else:
                raise


# ─── Credentials builder ──────────────────────────────────────────────────────

def build_credentials(access_token, refresh_token, label):
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
        raise RuntimeError(f"{label} token refresh failed: {str(e)}")
    return creds


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 9:
        print(json.dumps({
            "success": False,
            "error": "Missing arguments. Expected: type student_email student_access_token "
                     "student_refresh_token master_email master_access_token master_refresh_token folder_id"
        }))
        return

    sheet_type            = sys.argv[1]
    student_email         = sys.argv[2]
    # student_access_token and student_refresh_token kept for API compatibility
    # but no longer needed — master does everything now
    master_email          = sys.argv[5]
    master_access_token   = sys.argv[6]
    master_refresh_token  = sys.argv[7]
    folder_id             = sys.argv[8]
    student_id            = sys.argv[9] if len(sys.argv) > 9 else "Unknown"

    # Resolve template ID
    env_key = 'WORKBOOK_TEMPLATE_ID'
    template_id = os.environ.get(env_key, '').strip() or DEFAULT_TEMPLATE_ID

    # Build master credentials
    try:
        master_creds = build_credentials(master_access_token, master_refresh_token, 'Master')
    except RuntimeError as e:
        print(json.dumps({"success": False, "error": str(e)}))
        return

    try:
        master_service = build('drive', 'v3', credentials=master_creds)

        # ── Step 1: Copy the native Google Sheet template ─────────────────────
        prefix = NAME_MAP.get(sheet_type, sheet_type.capitalize())
        display_name = f"{prefix} - {student_id}"

        copied = execute_with_retry(
            master_service.files().copy(
                fileId=template_id,
                body={
                    'name':    display_name,
                    'parents': [folder_id],
                },
                fields='id,webViewLink'
            )
        )

        file_id = copied.get('id')
        if not file_id:
            print(json.dumps({"success": False, "error": "Copy succeeded but no file ID returned"}))
            return

        # ── Step 2: Share with student (writer) ───────────────────────────────
        perm = execute_with_retry(
            master_service.permissions().create(
                fileId=file_id,
                body={
                    'type': 'user',
                    'role': 'writer',
                    'emailAddress': student_email,
                },
                fields='id',
                sendNotificationEmail=False
            )
        )

        student_perm_id = perm.get('id')

        print(json.dumps({
            "success": True,
            "sheet_id": file_id,
            "link": copied.get('webViewLink', f"https://docs.google.com/spreadsheets/d/{file_id}"),
            "student_permission_id": student_perm_id
        }))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()