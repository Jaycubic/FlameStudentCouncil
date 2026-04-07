# scripts/copy_sheet.py
#
# Copies the master template using files.copy() on the master account.
# All quota is on master — student account is never touched here.
#
# Usage:
#   python3 copy_sheet.py <type> <master_access_token> <master_refresh_token>
#
# Template Drive IDs are read from environment variables:
#   SPORTS_TEMPLATE_ID, CULTURAL_TEMPLATE_ID, ACADEMIC_TEMPLATE_ID
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
    'sports':   'SPORTS_TEMPLATE_ID',
    'cultural': 'CULTURAL_TEMPLATE_ID',
    'academic': 'ACADEMIC_TEMPLATE_ID',
}

NAME_MAP = {
    'sports':   'Sports Matrix',
    'cultural': 'Socio-Cultural Matrix',
    'academic': 'Academic Matrix',
}

# Master-owned private folder — same one used in generate_sheet.py
FOLDER_ID = '1EKS37zB71mAXyGRz5Mu1VxUEZJI2KXyI'


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
            "error": f"Invalid type '{sheet_type}'. Expected: sports, cultural, academic"
        }))
        return

    env_key     = ENV_KEY_MAP[sheet_type]
    template_id = os.environ.get(env_key, '').strip()

    if not template_id:
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