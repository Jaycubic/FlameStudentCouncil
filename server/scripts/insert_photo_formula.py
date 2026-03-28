# scripts/insert_photo_image.py
#
# Usage:
#   python3 insert_photo_image.py <sheet_id> <drive_file_id>
#                                 <master_access_token> <master_refresh_token>
#
# Inserts the photo as a real in-cell image (not a formula) into B2.
# Sheets fetches + snapshots the image at write-time using the master session,
# so viewers never see an "external parties" prompt.
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

    # lh3.googleusercontent.com/d/ is Google's image CDN.
    # The master session has Drive access, so this URL resolves during the
    # batchUpdate call — the image is fetched and stored server-side.
    # Viewers later see a cached copy, not a live external request.
    image_url = f'https://lh3.googleusercontent.com/d/{drive_file_id}'

    try:
        service = build('sheets', 'v4', credentials=creds)

        # First call: get the real sheetId (tab id) of the first sheet.
        # spreadsheetId != sheetId — batchUpdate ranges need the integer sheetId.
        meta = service.spreadsheets().get(
            spreadsheetId=sheet_id,
            fields='sheets.properties'
        ).execute()
        sheet_tab_id = meta['sheets'][0]['properties']['sheetId']  # usually 0

        # Write an in-cell IMAGE value (not a formula) to B2 (row 1, col 1, 0-indexed)
        body = {
            'requests': [{
                'updateCells': {
                    'rows': [{
                        'values': [{
                            'userEnteredValue': {
                                'image': {
                                    'imageSource': image_url,
                                    # PUT_IMAGE_IN_CELL keeps it contained within B2.
                                    # Use BRING_TO_FRONT for a floating overlay instead.
                                    'imageSourceType': 'IMAGE',
                                }
                            }
                        }]
                    }],
                    'fields': 'userEnteredValue',
                    'range': {
                        'sheetId':          sheet_tab_id,
                        'startRowIndex':    1,   # row 2
                        'endRowIndex':      2,
                        'startColumnIndex': 1,   # col B
                        'endColumnIndex':   2,
                    }
                }
            }]
        }

        service.spreadsheets().batchUpdate(
            spreadsheetId=sheet_id,
            body=body
        ).execute()

        print(json.dumps({'success': True}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()