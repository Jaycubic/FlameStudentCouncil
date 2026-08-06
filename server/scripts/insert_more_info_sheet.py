# scripts/insert_more_info_sheet.py
#
# Adds a new sheet tab named 'More Information' upon final form submission IF more_info is provided.
# Formats B2 as a large title ("More Information") and B3 as the student's additional text (wrapped).
# Sets column B width to 650px for clean reading by admins.
#
# Usage:
#   python3 insert_more_info_sheet.py <sheet_id> <master_access_token> <master_refresh_token> <more_info_text>

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
            'error': 'Usage: insert_more_info_sheet.py <sheet_id> <master_access_token> <master_refresh_token> <more_info_text>'
        }))
        return

    sheet_id       = sys.argv[1]
    master_access  = sys.argv[2]
    master_refresh = sys.argv[3]
    more_info      = sys.argv[4]

    if not more_info or not more_info.strip():
        print(json.dumps({'success': True, 'message': 'No more_info text provided — skipping sheet insertion'}))
        return

    try:
        creds = build_master_creds(master_access, master_refresh)
        service = build('sheets', 'v4', credentials=creds)

        # 1. Fetch spreadsheet metadata to check existing sheets
        meta = service.spreadsheets().get(spreadsheetId=sheet_id).execute()
        sheets = meta.get('sheets', [])
        
        info_sheet_id = None
        for s in sheets:
            props = s.get('properties', {})
            if props.get('title') == 'More Information':
                info_sheet_id = props.get('sheetId')
                break

        # 2. Add 'More Information' sheet tab if it doesn't exist
        if info_sheet_id is None:
            add_req = {
                'requests': [{
                    'addSheet': {
                        'properties': {
                            'title': 'More Information'
                        }
                    }
                }]
            }
            res = service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body=add_req).execute()
            new_sheet_props = res['replies'][0]['addSheet']['properties']
            info_sheet_id = new_sheet_props['sheetId']

        # 3. Write B2 header and B3 content
        service.spreadsheets().values().update(
            spreadsheetId=sheet_id,
            range="'More Information'!B2:B3",
            valueInputOption='USER_ENTERED',
            body={
                'values': [
                    ['More Information'],
                    [more_info]
                ]
            }
        ).execute()

        # 4. Format B2 (Title: Bold, Size 14), B3 (Wrap text), and set Column B width
        format_reqs = [
            # B2 Title styling
            {
                'repeatCell': {
                    'range': {
                        'sheetId': info_sheet_id,
                        'startRowIndex': 1,
                        'endRowIndex': 2,
                        'startColumnIndex': 1,
                        'endColumnIndex': 2
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'textFormat': {
                                'bold': True,
                                'fontSize': 14
                            }
                        }
                    },
                    'fields': 'userEnteredFormat.textFormat(bold,fontSize)'
                }
            },
            # B3 Wrap text
            {
                'repeatCell': {
                    'range': {
                        'sheetId': info_sheet_id,
                        'startRowIndex': 2,
                        'endRowIndex': 3,
                        'startColumnIndex': 1,
                        'endColumnIndex': 2
                    },
                    'cell': {
                        'userEnteredFormat': {
                            'wrapStrategy': 'WRAP'
                        }
                    },
                    'fields': 'userEnteredFormat.wrapStrategy'
                }
            },
            # Column B width (650px)
            {
                'updateDimensionProperties': {
                    'range': {
                        'sheetId': info_sheet_id,
                        'dimension': 'COLUMNS',
                        'startIndex': 1,
                        'endIndex': 2
                    },
                    'properties': {
                        'pixelSize': 650
                    },
                    'fields': 'pixelSize'
                }
            }
        ]

        service.spreadsheets().batchUpdate(spreadsheetId=sheet_id, body={'requests': format_reqs}).execute()

        print(json.dumps({'success': True}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Google API error: {str(e)}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
