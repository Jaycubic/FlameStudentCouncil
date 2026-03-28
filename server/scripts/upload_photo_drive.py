# scripts/upload_photo_drive.py
#
# Simple student-token uploader.
# Photo goes into the student's own Google Drive, shared publicly (anyone=reader).
#
# Usage:
#   python3 upload_photo_drive.py <student_id> <local_photos_dir>
#                                 <student_access_token> <student_refresh_token>
#
# Returns:
#   { success, drive_file_id, already_existed }
#   { success: false, error }

import sys
import json
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png']
MIME_MAP = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
}


def find_local_photo(photos_dir, student_id):
    for ext in PHOTO_EXTENSIONS:
        p = os.path.join(photos_dir, f'{student_id}{ext}')
        if os.path.exists(p):
            return p, ext
    return None, None


def build_creds(access_token, refresh_token):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive']
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        raise RuntimeError(f'Token refresh failed: {e}')
    return creds


def search_existing(service, student_id):
    """Check if photo already uploaded by this student (idempotent)."""
    q = f"trashed = false and name = 'flame_photo_{student_id}'"
    result = service.files().list(
        q=q, fields='files(id, name)', pageSize=3
    ).execute()
    files = result.get('files', [])
    return files[0]['id'] if files else None


def make_public(service, file_id):
    """Set anyone-with-link = reader."""
    try:
        service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'},
            fields='id'
        ).execute()
    except HttpError as e:
        print(f'[WARN] Could not set public permission: {e}', file=sys.stderr)


def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            'success': False,
            'error': 'Usage: upload_photo_drive.py <student_id> <photos_dir> '
                     '<student_access_token> <student_refresh_token>'
        }))
        return

    student_id  = sys.argv[1]
    photos_dir  = sys.argv[2]
    student_at  = sys.argv[3]
    student_rt  = sys.argv[4]

    # ── 1. Find local photo ────────────────────────────────────────────────────
    local_path, ext = find_local_photo(photos_dir, student_id)
    if not local_path:
        print(json.dumps({
            'success': False,
            'error': f'No local photo found for student {student_id}'
        }))
        return

    # ── 2. Build credentials ───────────────────────────────────────────────────
    try:
        creds = build_creds(student_at, student_rt)
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        return

    service = build('drive', 'v3', credentials=creds)

    # ── 3. Idempotency check ───────────────────────────────────────────────────
    try:
        existing_id = search_existing(service, student_id)
    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Drive search error: {e}'}))
        return

    if existing_id:
        # Ensure it's still public (re-set permission, cheap operation)
        make_public(service, existing_id)
        print(json.dumps({
            'success': True,
            'drive_file_id': existing_id,
            'already_existed': True
        }))
        return

    # ── 4. Upload to student's Drive ───────────────────────────────────────────
    mime = MIME_MAP.get(ext, 'image/jpeg')
    metadata = {'name': f'flame_photo_{student_id}'}  # no parents = My Drive root
    media = MediaFileUpload(local_path, mimetype=mime, resumable=False)

    try:
        uploaded = service.files().create(
            body=metadata, media_body=media, fields='id'
        ).execute()
        drive_file_id = uploaded.get('id')
    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Upload failed: {e}'}))
        return

    # ── 5. Make public ─────────────────────────────────────────────────────────
    make_public(service, drive_file_id)

    print(json.dumps({
        'success': True,
        'drive_file_id': drive_file_id,
        'already_existed': False
    }))


if __name__ == '__main__':
    main()
