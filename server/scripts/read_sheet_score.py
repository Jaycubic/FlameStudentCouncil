# scripts/read_sheet_score.py
#
# Reads the computed value of cell B1 from a Google Spreadsheet.
# B1 contains =SUM(J5:J495) — we want the result, not the formula.
#
# Usage:
#   python3 read_sheet_score.py <spreadsheet_id>
#                               <master_access_token> <master_refresh_token>
#
# Returns:
#   { success: true, value: 8.5 }   — the computed numeric value
#   { success: false, error: "..." }

import sys
import json
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


def build_creds(access_token, refresh_token):
    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=[
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets'  # must match what master token was granted
        ]
    )
    try:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
    except Exception as e:
        raise RuntimeError(f'Token refresh failed: {e}')
    return creds



def main():
    if len(sys.argv) < 4:
        print(json.dumps({
            'success': False,
            'error': 'Usage: read_sheet_score.py <spreadsheet_id> <access_token> <refresh_token>'
        }))
        return

    spreadsheet_id = sys.argv[1]
    access_token   = sys.argv[2]
    refresh_token  = sys.argv[3]

    try:
        creds   = build_creds(access_token, refresh_token)
        service = build('sheets', 'v4', credentials=creds)

        # UNFORMATTED_VALUE returns the actual computed number, not the formula string
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range='B1',
            valueRenderOption='UNFORMATTED_VALUE'   # raw number, e.g. 8.5
        ).execute()

        values = result.get('values', [])

        if not values or not values[0]:
            # Cell is empty or formula evaluates to 0/blank
            print(json.dumps({'success': True, 'value': None}))
            return

        raw = values[0][0]

        # Return as-is (may be int or float — let caller decide how to store)
        print(json.dumps({'success': True, 'value': raw}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
