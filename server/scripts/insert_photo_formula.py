# scripts/insert_photo_formula.py
#
# Usage:
#   python3 insert_photo_formula.py <sheet_id> <drive_file_id>
#                                   <master_access_token> <master_refresh_token>
#
# Writes  =IMAGE("https://drive.google.com/uc?id=<drive_file_id>")
# into cell B2 of the given Google Spreadsheet using the master token.
#
# Returns: { success: true }  OR  { success: false, error }

import sys
import json
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def build_master_creds(access_token, refresh_token):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=[
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'
        ]
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        raise RuntimeError(f'Master token refresh failed: {e}')
    return creds


def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            'success': False,
            'error': 'Usage: insert_photo_formula.py <sheet_id> <drive_file_id> '
                     '<master_access_token> <master_refresh_token>'
        }))
        return

    sheet_id          = sys.argv[1]
    drive_file_id     = sys.argv[2]
    master_access     = sys.argv[3]
    master_refresh    = sys.argv[4]

    # ── Build credentials ──────────────────────────────────────────────────────
    try:
        creds = build_master_creds(master_access, master_refresh)
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        return

    # ── Build the IMAGE formula ────────────────────────────────────────────────
    # lh3.googleusercontent.com/d/ is Google's image CDN — Sheets treats it as
    # a first-party trusted source and skips the "external parties" access prompt.
    # drive.google.com/uc?id= triggers the prompt because Sheets sees it as an
    # external download redirect, even though it's the same file.
    image_url = f'https://lh3.googleusercontent.com/d/{drive_file_id}'
    formula   = f'=IMAGE("{image_url}")'

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)
        sheets_service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range='B2',
            valueInputOption='USER_ENTERED',   # allows formula parsing
            body={'values': [[formula]]}
        ).execute()

        print(json.dumps({'success': True}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
