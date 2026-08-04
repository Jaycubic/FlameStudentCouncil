import sys
import json
import os
import time
import socket

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
import io

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
    # Using the standard 'drive' scope which encompasses both reading files and spreadsheets.
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive']
    )
    try:
        # We manually refresh if token is expired, though the googleapiclient handles some of this
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        raise RuntimeError(f"{label} token refresh failed: {str(e)}")
    return creds


# ─── File fetch handler ───────────────────────────────────────────────────────

def get_all_items(service, query):
    """
    Fetches all items matching the provided Google Drive API query, handling pagination.
    """
    items = []
    page_token = None
    while True:
        response = execute_with_retry(
            service.files().list(
                q=query,
                spaces='drive',
                fields='nextPageToken, files(id, name, mimeType, owners)',
                pageToken=page_token,
                pageSize=1000
            )
        )
        for file in response.get('files', []):
            items.append({
                'id': file.get('id'),
                'name': file.get('name'),
                'mimeType': file.get('mimeType'),
                'owners': [owner.get('emailAddress') for owner in file.get('owners', [])]
            })
        
        page_token = response.get('nextPageToken', None)
        if page_token is None:
            break
            
    return items


import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# ─── DB helper ────────────────────────────────────────────────────────────────

def get_tokens_from_db(email):
    pg_config = {
        'host': os.getenv('DBP_HOST', '127.0.0.1'),
        'user': os.getenv('DBP_USER', ''),
        'password': os.getenv('DBP_PASSWORD', ''),
        'database': os.getenv('DBP_NAME', 'studentcouncil'),
        'port': int(os.getenv('DBP_PORT', 5432))
    }
    conn = None
    try:
        conn = psycopg2.connect(**pg_config)
        cursor = conn.cursor()
        
        # In a generic SQLAlchemy setup without schema it might be in public schema
        # but in this application some tables are in 'app' schema.
        # Let's try 'users' first.
        try:
            cursor.execute("SELECT access_token, refresh_token FROM users WHERE email = %s", (email,))
        except psycopg2.errors.UndefinedTable:
            conn.rollback()
            cursor.execute("SELECT access_token, refresh_token FROM app.users WHERE email = %s", (email,))

        row = cursor.fetchone()
        if not row:
            raise RuntimeError(f"User {email} not found in database.")
        
        access_token, refresh_token = row
        if not access_token or not refresh_token:
            raise RuntimeError(f"Tokens are missing in the database for {email}.")
            
        return access_token, refresh_token
    finally:
        if conn:
            conn.close()

def download_file(service, file_id, file_name, mime_type):
    if mime_type.startswith('application/vnd.google-apps.'):
        if mime_type == 'application/vnd.google-apps.spreadsheet':
            request = service.files().export_media(fileId=file_id, mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            if not file_name.endswith('.xlsx'):
                file_name += '.xlsx'
        elif mime_type == 'application/vnd.google-apps.document':
            request = service.files().export_media(fileId=file_id, mimeType='application/pdf')
            if not file_name.endswith('.pdf'):
                file_name += '.pdf'
        else:
            print(f"[WARN] Skipping unsupported Google workspace type: {mime_type}", file=sys.stderr)
            return
    else:
        request = service.files().get_media(fileId=file_id)
        
    try:
        fh = io.FileIO(file_name, 'wb')
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        print(f"[INFO] Initiating download for '{file_name}'...", file=sys.stderr)
        while done is False:
            status, done = downloader.next_chunk()
            if status:
                print(f"[INFO] Download {int(status.progress() * 100)}%...", file=sys.stderr)
        print(f"[INFO] ✅ Download Complete: {file_name}", file=sys.stderr)
    except Exception as e:
        print(f"[ERROR] Failed to download {file_name}: {e}", file=sys.stderr)


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Missing arguments. Expected: student_email [file_to_download]"
        }))
        sys.exit(1)

    student_email = sys.argv[1]
    file_to_download = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        student_access_token, student_refresh_token = get_tokens_from_db(student_email)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Database error: {str(e)}"}))
        sys.exit(1)

    # 1. Build credential object
    try:
        student_creds = build_credentials(student_access_token, student_refresh_token, f'Student ({student_email})')
    except RuntimeError as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

    try:
        service = build('drive', 'v3', credentials=student_creds)

        # ── Scope 1: List all files and folders ────────────────────────────────
        print(f"[INFO] Fetching all files and folders (excluding trashed) for {student_email}...", file=sys.stderr)
        all_items = get_all_items(service, "trashed = false")
        
        folders = [item for item in all_items if item['mimeType'] == 'application/vnd.google-apps.folder']
        files = [item for item in all_items if item['mimeType'] != 'application/vnd.google-apps.folder']
        
        print(f"[INFO] Found {len(folders)} folders and {len(files)} files.", file=sys.stderr)

        # ── Scope 2: List all spreadsheets she owns ────────────────────────────
        print(f"[INFO] Fetching spreadsheets owned by {student_email}...", file=sys.stderr)
        owned_spreadsheets = get_all_items(
            service, 
            f"mimeType = 'application/vnd.google-apps.spreadsheet' and '{student_email}' in owners and trashed = false"
        )
        print(f"[INFO] Found {len(owned_spreadsheets)} spreadsheets owned by {student_email}.", file=sys.stderr)

        # ── Output Results ─────────────────────────────────────────────────────
        
        # Also write results nicely to a .txt file
        output_filename = f"drive_files_{student_email.replace('@', '_at_')}.txt"
        with open(output_filename, 'w', encoding='utf-8') as f:
            f.write(f"Google Drive Report for: {student_email}\n")
            f.write("=" * 60 + "\n\n")
            f.write(f"Summary:\n")
            f.write(f"  Total Files: {len(files)}\n")
            f.write(f"  Total Folders: {len(folders)}\n")
            f.write(f"  Total Owned Spreadsheets: {len(owned_spreadsheets)}\n\n")
            
            f.write("─── Owned Spreadsheets ───\n")
            if not owned_spreadsheets:
                f.write("  (None)\n")
            else:
                for idx, sheet in enumerate(owned_spreadsheets, 1):
                    f.write(f"  {idx}. {sheet['name']} (ID: {sheet['id']})\n")
            
            f.write("\n─── Other Files ───\n")
            if not files:
                f.write("  (None)\n")
            else:
                for idx, item in enumerate(files, 1):
                    f.write(f"  {idx}. [{item['mimeType'].split('.')[-1]}] {item['name']} (ID: {item['id']})\n")

            f.write("\n─── Folders ───\n")
            if not folders:
                f.write("  (None)\n")
            else:
                for idx, item in enumerate(folders, 1):
                    f.write(f"  {idx}. {item['name']} (ID: {item['id']})\n")
        
        print(f"[INFO] Details successfully written to {output_filename}", file=sys.stderr)

        # ── Download Logic ──────────────────────────────────────────────────────
        if file_to_download:
            print(f"\n[INFO] Searching for file to download: '{file_to_download}'...", file=sys.stderr)
            matches = [f for f in all_items if f['name'] == file_to_download]
            if not matches:
                print(f"[WARN] Could not find '{file_to_download}' in the user's Drive.", file=sys.stderr)
            else:
                for match in matches:
                    f_name = match['name']
                    if len(matches) > 1:
                        f_name = f"{match['id'][:8]}_{f_name}"
                    download_file(service, match['id'], f_name, match['mimeType'])

        result = {
            "success": True,
            "student_email": student_email,
            "summary": {
                "total_files": len(files),
                "total_folders": len(folders),
                "total_owned_spreadsheets": len(owned_spreadsheets)
            },
            "output_file": output_filename,
            "data": {
                "folders": folders,
                "files": files,
                "owned_spreadsheets": owned_spreadsheets
            }
        }
        
        # Printing standard JSON output to stdout
        print(json.dumps(result, indent=2))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
