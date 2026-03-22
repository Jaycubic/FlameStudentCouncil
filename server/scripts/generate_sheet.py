# scripts/generate_sheet.py
#
# Usage:
#   python3 generate_sheet.py <type> <student_email> <student_access_token>
#                             <student_refresh_token> <master_email>
#
# What this script does (all via STUDENT credentials):
#   1. Snapshot the local template to a temp file (avoids admin-update race)
#   2. Upload template → student becomes owner
#   3. Add master as writer → get master's permission ID
#   4. Transfer ownership from student to master (student token does the push)
#   5. List permissions to retrieve student's new writer permissionId
#   6. Print JSON: { success, sheet_id, link, student_permission_id }
#
# The student_permission_id is stored in the DB so revoke_access.py can
# delete it precisely when the student submits their form.

import sys
import json
import os
import time
import shutil
import tempfile
import socket

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

# Hard cap on every HTTP operation — prevents zombie processes on stalled uploads
socket.setdefaulttimeout(90)


# ─── Retry helper ─────────────────────────────────────────────────────────────

def execute_with_retry(request, max_retries=4):
    """
    Executes a Google API request with exponential backoff.
    Retries on 429 (rate limit), 500, and 503 errors.
    """
    for attempt in range(max_retries):
        try:
            return request.execute()
        except HttpError as e:
            status = e.resp.status
            if status in (429, 500, 503) and attempt < max_retries - 1:
                wait_seconds = 2 ** attempt  # 1s, 2s, 4s, 8s
                time.sleep(wait_seconds)
            else:
                raise


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 6:
        print(json.dumps({"success": False, "error": "Missing arguments. Expected: type email access_token refresh_token master_email"}))
        return

    sheet_type         = sys.argv[1]   # 'cultural' or 'sports'
    student_email      = sys.argv[2]
    access_token       = sys.argv[3]
    refresh_token      = sys.argv[4]
    master_email       = sys.argv[5]

    # ── Build student credentials ─────────────────────────────────────────────
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive']
    )

    # Proactively refresh if expired (avoids a failed first call)
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token refresh failed: {str(e)}"}))
        return

    # ── Locate & snapshot template ────────────────────────────────────────────
    templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
    template_path = os.path.join(templates_dir, f'master_{sheet_type}.xlsx')

    if not os.path.exists(template_path):
        print(json.dumps({"success": False, "error": "Template not found. Please update template via Admin Panel."}))
        return

    # Copy to a temp file so admin can safely overwrite the master template
    # while this upload is in progress (eliminates the read/write race)
    tmp_file = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    tmp_path = tmp_file.name
    tmp_file.close()
    shutil.copy2(template_path, tmp_path)

    try:
        service = build('drive', 'v3', credentials=creds)

        # ── Step 1: Upload — student creates the file, student = owner ────────
        file_metadata = {
            'name': f"{sheet_type.capitalize()} Sheet - {student_email}",
            'mimeType': 'application/vnd.google-apps.spreadsheet'
        }
        media = MediaFileUpload(
            tmp_path,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            resumable=True
        )
        file = execute_with_retry(
            service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,webViewLink'
            )
        )
        file_id = file.get('id')

        # ── Step 2: Add master as writer ──────────────────────────────────────
        # We need master's permissionId to perform the ownership transfer next.
        master_perm = execute_with_retry(
            service.permissions().create(
                fileId=file_id,
                body={
                    'type': 'user',
                    'role': 'writer',
                    'emailAddress': master_email
                },
                fields='id',
                sendNotificationEmail=False
            )
        )
        master_perm_id = master_perm.get('id')

        # ── Step 3: Transfer ownership to master ──────────────────────────────
        # This MUST be called using the student's token (the current owner).
        # After this call:
        #   master  → owner
        #   student → writer  (automatically demoted)
        execute_with_retry(
            service.permissions().update(
                fileId=file_id,
                permissionId=master_perm_id,
                body={'role': 'owner'},
                transferOwnership=True,
                fields='id,role'
            )
        )

        # ── Step 4: Get student's permissionId (now as writer) ────────────────
        # We store this ID so revoke_access.py can delete it precisely
        # without listing all permissions again later.
        perms_response = execute_with_retry(
            service.permissions().list(
                fileId=file_id,
                fields='permissions(id,emailAddress,role)'
            )
        )
        student_perm_id = None
        for perm in perms_response.get('permissions', []):
            if perm.get('emailAddress', '').lower() == student_email.lower():
                student_perm_id = perm.get('id')
                break

        if not student_perm_id:
            # Non-fatal: revocation just won't be possible later.
            # Log it but still return success.
            import sys as _sys
            print(f"[WARN] Could not find student permission for {student_email} on file {file_id}", file=_sys.stderr)

        print(json.dumps({
            "success": True,
            "sheet_id": file_id,
            "link": file.get('webViewLink'),
            "student_permission_id": student_perm_id
        }))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        # Always clean up the temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == '__main__':
    main()