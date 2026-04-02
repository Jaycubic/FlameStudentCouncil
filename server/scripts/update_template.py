# scripts/update_template.py
#
# Usage:
#   python update_template.py <type> <access_token> <refresh_token>
#
# type: 'cultural', 'sports', or 'academic'
#
# The Drive file IDs are read from environment variables:
#   SPORTS_TEMPLATE_ID
#   CULTURAL_TEMPLATE_ID
#   ACADEMIC_TEMPLATE_ID
#
# Set these once in your .env file. Never hardcoded.
#
# Returns: { success, message } or { success: false, error }

import sys
import json
import os
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
import io


def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            "success": False,
            "error": "Usage: update_template.py <type> <access_token> <refresh_token>"
        }))
        return

    sheet_type    = sys.argv[1]
    access_token  = sys.argv[2]
    refresh_token = sys.argv[3]

    ENV_KEY_MAP = {
        'sports':   'SPORTS_TEMPLATE_ID',
        'cultural': 'CULTURAL_TEMPLATE_ID',
        'academic': 'ACADEMIC_TEMPLATE_ID',
    }

    if sheet_type not in ENV_KEY_MAP:
        print(json.dumps({
            "success": False,
            "error": f"Invalid type '{sheet_type}'. Expected: sports, cultural, academic"
        }))
        return

    env_key = ENV_KEY_MAP[sheet_type]
    file_id = os.environ.get(env_key, '').strip()

    if not file_id:
        print(json.dumps({
            "success": False,
            "error": (
                f"Environment variable '{env_key}' is not set. "
                f"Add it to your .env file: {env_key}=<Google Drive file ID>"
            )
        }))
        return

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive.readonly']
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Token refresh failed: {e}"}))
        return

    try:
        service = build('drive', 'v3', credentials=creds)

        # Check mime type — native Sheets need export; uploaded XLSX downloaded directly
        file_info = service.files().get(
            fileId=file_id,
            fields='mimeType,name'
        ).execute()
        mime_type = file_info.get('mimeType', '')

        if mime_type == 'application/vnd.google-apps.spreadsheet':
            # Native Google Sheet — export as XLSX (all tabs preserved)
            request = service.files().export_media(
                fileId=file_id,
                mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        else:
            # Already an XLSX upload — download directly
            request = service.files().get_media(fileId=file_id)

        templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
        os.makedirs(templates_dir, exist_ok=True)
        destination = os.path.join(templates_dir, f'master_{sheet_type}.xlsx')

        fh = io.FileIO(destination, 'wb')
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        fh.close()

        print(json.dumps({
            "success": True,
            "message": f"{sheet_type.capitalize()} template updated from \"{file_info.get('name', file_id)}\""
        }))

    except HttpError as error:
        print(json.dumps({"success": False, "error": str(error)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()
