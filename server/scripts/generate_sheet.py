# scripts/generate_sheet.py
#
# Usage:
#   python3 generate_sheet.py <type> <student_email>
#                             <student_access_token> <student_refresh_token>
#                             <master_email> <master_access_token> <master_refresh_token>
#                             <folder_id>
#
# Two-token hybrid flow:
#
#   STUDENT TOKEN (heavy work — quota on student):
#     1. Snapshot local template to temp file (race-free)
#     2. Upload file → student becomes owner
#     3. Add master as writer
#     4. Transfer ownership to master (must be pushed by current owner)
#
#   MASTER TOKEN (lightweight — 2 API calls):
#     5. Move file into private master-only folder
#        → breaks domain-wide inheritance → explicit permissions only
#     6. List permissions → capture student's permissionId
#
#   Returns: { success, sheet_id, link, student_permission_id }
#
#   student_permission_id stored in DB.
#   revoke_access.py deletes it cleanly after form submission.

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

socket.setdefaulttimeout(90)


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
    student_access_token  = sys.argv[3]
    student_refresh_token = sys.argv[4]
    master_email          = sys.argv[5]
    master_access_token   = sys.argv[6]
    master_refresh_token  = sys.argv[7]
    folder_id             = sys.argv[8]  # Private master-only folder

    # ── Build both credential objects ─────────────────────────────────────────
    try:
        student_creds = build_credentials(student_access_token, student_refresh_token, 'Student')
        master_creds  = build_credentials(master_access_token,  master_refresh_token,  'Master')
    except RuntimeError as e:
        print(json.dumps({"success": False, "error": str(e)}))
        return

    # ── Locate & snapshot template ────────────────────────────────────────────
    templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
    template_path = os.path.join(templates_dir, f'master_{sheet_type}.xlsx')

    if not os.path.exists(template_path):
        print(json.dumps({"success": False, "error": "Template not found. Please update via Admin Panel."}))
        return

    # Snapshot so admin can safely overwrite master template mid-upload
    tmp_file = tempfile.NamedTemporaryFile(suffix='.xlsx', delete=False)
    tmp_path = tmp_file.name
    tmp_file.close()
    shutil.copy2(template_path, tmp_path)

    file_id = None

    try:
        student_service = build('drive', 'v3', credentials=student_creds)
        master_service  = build('drive', 'v3', credentials=master_creds)

        # ── PHASE 1: Student token ─────────────────────────────────────────────
        # File created in student's own Drive root (no parent specified).
        # No parent = no inherited domain folder permissions at creation time.

        # Step 1 — Upload (student = owner, lands in student's My Drive root)
        file_metadata = {
            'name': f"{sheet_type.capitalize()} Sheet - {student_email}",
            'mimeType': 'application/vnd.google-apps.spreadsheet'
            # Intentionally NO parents key here
        }
        media = MediaFileUpload(
            tmp_path,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            resumable=True
        )
        file = execute_with_retry(
            student_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,webViewLink,parents'
            )
        )
        file_id = file.get('id')
        original_parent = file.get('parents', [None])[0]  # student's My Drive root id

        # Step 2 — Add master as writer, capture permissionId for ownership transfer
        master_perm = execute_with_retry(
            student_service.permissions().create(
                fileId=file_id,
                body={'type': 'user', 'role': 'writer', 'emailAddress': master_email},
                fields='id',
                sendNotificationEmail=False
            )
        )
        master_perm_id = master_perm.get('id')

        # Step 3 — Transfer ownership to master
        # Must be called by current owner (student token).
        # After this: master = owner, student = writer (auto-demoted)
        execute_with_retry(
            student_service.permissions().update(
                fileId=file_id,
                permissionId=master_perm_id,
                body={'role': 'owner'},
                transferOwnership=True,
                fields='id,role'
            )
        )

        # ── PHASE 2: Master token (2 lightweight calls) ────────────────────────

        # Step 4 — Move file from student's Drive root into master's private folder.
        # This is the key step: once inside the private folder (no domain sharing),
        # the student's only remaining access is their explicit writer permission
        # which can now be cleanly deleted by revoke_access.py on form submit.
        execute_with_retry(
            master_service.files().update(
                fileId=file_id,
                addParents=folder_id,
                removeParents=original_parent,
                fields='id,parents'
            )
        )

        # Step 5 — List permissions to capture student's exact permissionId.
        # Stored in DB so revoke_access.py can target it precisely.
        perms_response = execute_with_retry(
            master_service.permissions().list(
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
            print(f"[WARN] Could not find student permissionId for {student_email} on {file_id}",
                  file=sys.stderr)

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
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == '__main__':
    main()