# scripts/read_sheet_score.py
#
# Reads all 3 scores from the student's single workbook.
# The "Total Point" sheet has:
#   B3 = Academic Score (may be a formula — use UNFORMATTED_VALUE to resolve)
#   C3 = Sports Score
#   D3 = Cultural Score
#
# Usage:
#   python3 read_sheet_score.py <spreadsheet_id>
#                               <master_access_token> <master_refresh_token>
#
# Returns:
#   { success: true, academic_score: 8.5, sports_score: 12.0, cultural_score: 5.0 }
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
            'https://www.googleapis.com/auth/spreadsheets'
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

        # Read B3:D3 from "Total Point" sheet
        # B3 = Academic, C3 = Sports, D3 = Cultural
        # UNFORMATTED_VALUE resolves formulas to their computed values
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range="'Total Point'!B3:D3",
            valueRenderOption='UNFORMATTED_VALUE'
        ).execute()

        values = result.get('values', [])

        academic_score = None
        sports_score   = None
        cultural_score = None

        if values and len(values) > 0:
            row = values[0]
            if len(row) > 0 and row[0] is not None and row[0] != '':
                academic_score = row[0]
            if len(row) > 1 and row[1] is not None and row[1] != '':
                sports_score = row[1]
            if len(row) > 2 and row[2] is not None and row[2] != '':
                cultural_score = row[2]

        print(json.dumps({
            'success': True,
            'academic_score': academic_score,
            'sports_score':   sports_score,
            'cultural_score': cultural_score,
        }))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
