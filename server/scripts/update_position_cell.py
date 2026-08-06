# scripts/update_position_cell.py
#
# Lightweight surgical update script:
# ONLY updates cell B7 in 'Personal Information' sheet with the new position_selected.
#
# Usage:
#   python3 update_position_cell.py <sheet_id> <master_access_token> <master_refresh_token> <position_selected>
#
# Takes ~100ms via Google Sheets API values.update.

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
        scopes=['https://www.googleapis.com/auth/spreadsheets']
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
            'error': 'Usage: update_position_cell.py <sheet_id> <master_access_token> <master_refresh_token> <position_selected>'
        }))
        return

    sheet_id          = sys.argv[1]
    master_access     = sys.argv[2]
    master_refresh    = sys.argv[3]
    position_selected = sys.argv[4]

    try:
        creds = build_master_creds(master_access, master_refresh)
        service = build('sheets', '4', credentials=creds)

        # Single surgical write to cell B7
        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range="'Personal Information'!B7",
            valueInputOption='USER_ENTERED',
            body={'values': [[position_selected]]}
        ).execute()

        print(json.dumps({'success': True}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Google API error: {str(e)}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
