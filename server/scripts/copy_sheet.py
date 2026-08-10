# scripts/copy_sheet.py
#
# Copies the master template using files.copy() on the master account.
# All quota is on master — student account is never touched here.
#
# Usage:
#   python3 copy_sheet.py <type> <master_access_token> <master_refresh_token>
#
# Template Drive ID is read from environment variable:
#   WORKBOOK_TEMPLATE_ID
#
# Returns: { success, sheet_id } or { success: false, error }

import sys
import json
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


ENV_KEY_MAP = {
    'workbook': 'WORKBOOK_TEMPLATE_ID',
}

NAME_MAP = {
    'workbook': 'Student Council Matrix',
}

DEFAULT_TEMPLATE_ID = '1qB2m7mRO21NkhWZWxw68K4nkjBTuERJSy5M8ctFnyeE'

# Master-owned private folder — read from env var GOOGLE_DRIVE_FOLDER_ID
FOLDER_ID = os.environ.get('GOOGLE_DRIVE_FOLDER_ID', '').strip() or '1GBzDVaUcwehFAMrziH9zt8Cnjx-sN7ly'


def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            "success": False,
            "error": "Usage: copy_sheet.py <type> <master_access_token> <master_refresh_token>"
        }))
        return

    sheet_type    = sys.argv[1]
    access_token  = sys.argv[2]
    refresh_token = sys.argv[3]

    if sheet_type not in ENV_KEY_MAP:
        print(json.dumps({
            "success": False,
            "error": f"Invalid type '{sheet_type}'. Expected: workbook"
        }))
        return

    env_key     = ENV_KEY_MAP[sheet_type]
    template_id = os.environ.get(env_key, '').strip() or DEFAULT_TEMPLATE_ID

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

        # files.copy() is a single server-side clone — no data leaves Google
        copied = service.files().copy(
            fileId=template_id,
            body={
                'name':    f"[POOL] {NAME_MAP.get(sheet_type, sheet_type.capitalize())}",
                'parents': [FOLDER_ID],
                'mimeType': 'application/vnd.google-apps.spreadsheet',
            },
            fields='id'
        ).execute()

        sheet_id = copied.get('id')
        if not sheet_id:
            print(json.dumps({"success": False, "error": "Copy succeeded but no file ID returned"}))
            return

        print(json.dumps({"success": True, "sheet_id": sheet_id}))

    except HttpError as e:
        print(json.dumps({"success": False, "error": f"Google API error: {str(e)}"}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == '__main__':
    main()