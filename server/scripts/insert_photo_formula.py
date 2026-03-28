# scripts/insert_photo_image.py
#
# Usage:
#   python3 insert_photo_image.py <sheet_id> <drive_file_id>
#                                 <master_access_token> <master_refresh_token>
#
# Strategy:
#   1. Make the Drive photo publicly readable (link-only, not searchable).
#      → lh3.googleusercontent.com/d/<id> resolves without auth.
#   2. Write =IMAGE("https://lh3.googleusercontent.com/d/<id>") into B2
#      via USER_ENTERED so Sheets parses the formula.
#      → Because the CDN URL is Google-first-party + publicly accessible,
#        Sheets fetches it silently — no "external parties" prompt.
#
# NOTE: userEnteredValue.image is NOT in the public Sheets REST API v4.
#       It exists only in internal protos and the REST layer rejects it (HTTP 400).
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


def make_photo_public(drive_service, drive_file_id):
    """
    Grant 'anyone with the link → reader' on the photo file.
    allowFileDiscovery=False means it won't appear in public search results.
    This makes lh3.googleusercontent.com/d/<id> resolve without auth,
    so Sheets never needs to prompt the user for access.
    """
    drive_service.permissions().create(
        fileId=drive_file_id,
        body={
            'type': 'anyone',
            'role': 'reader',
            'allowFileDiscovery': False
        },
        fields='id'
    ).execute()


def insert_image_formula(sheets_service, sheet_id, drive_file_id):
    """
    Write =IMAGE("https://lh3.googleusercontent.com/d/<id>") into cell B2.

    Why lh3.googleusercontent.com instead of drive.google.com/uc?id=:
      - drive.google.com/uc?id= is a redirect endpoint → Sheets treats it as
        an external download, raises the "external parties" warning.
      - lh3.googleusercontent.com/d/ is Google's image CDN → Sheets treats it
        as first-party when the file is publicly readable, fetches silently.

    Why USER_ENTERED instead of RAW:
      - USER_ENTERED tells Sheets to parse the string as a formula.
      - RAW would store the literal text "=IMAGE(...)" as a string.
    """
    image_url = f'https://lh3.googleusercontent.com/d/{drive_file_id}'
    formula   = f'=IMAGE("{image_url}")'

    sheets_service.spreadsheets().values().update(
        spreadsheetId=sheet_id,
        range='Sheet1!B2',           # explicit sheet name is safer than bare 'B2'
        valueInputOption='USER_ENTERED',
        body={'values': [[formula]]}
    ).execute()


def main():
    if len(sys.argv) < 5:
        print(json.dumps({
            'success': False,
            'error': 'Usage: insert_photo_image.py <sheet_id> <drive_file_id> '
                     '<master_access_token> <master_refresh_token>'
        }))
        return

    sheet_id       = sys.argv[1]
    drive_file_id  = sys.argv[2]
    master_access  = sys.argv[3]
    master_refresh = sys.argv[4]

    try:
        creds = build_master_creds(master_access, master_refresh)
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        return

    try:
        drive_service  = build('drive',  'v3', credentials=creds)
        sheets_service = build('sheets', 'v4', credentials=creds)

        # Step 1 — Make the photo publicly readable so lh3 CDN resolves without auth
        make_photo_public(drive_service, drive_file_id)

        # Step 2 — Write the IMAGE formula into B2
        insert_image_formula(sheets_service, sheet_id, drive_file_id)

        print(json.dumps({'success': True}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'API error: {e}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()