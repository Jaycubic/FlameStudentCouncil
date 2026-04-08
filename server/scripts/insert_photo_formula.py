# scripts/insert_photo_formula.py
#
# Usage:
#   python3 insert_photo_formula.py <sheet_id> <drive_file_id>
#                                   <master_access_token> <master_refresh_token>
#                                   <name> <student_id> <batch> <email> <mobile_number>
#
# Writes =IMAGE() into 'Personal Information'!B13
# Writes student info into 'Personal Information'!C4:D4 through C8:D8
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
                     '<master_access_token> <master_refresh_token> '
                     '[name] [student_id] [batch] [email] [mobile_number]'
        }))
        return

    sheet_id          = sys.argv[1]
    drive_file_id     = sys.argv[2]
    master_access     = sys.argv[3]
    master_refresh    = sys.argv[4]

    # Optional student info args
    name              = sys.argv[5] if len(sys.argv) > 5 else ''
    student_id        = sys.argv[6] if len(sys.argv) > 6 else ''
    batch             = sys.argv[7] if len(sys.argv) > 7 else ''
    email             = sys.argv[8] if len(sys.argv) > 8 else ''
    mobile_number     = sys.argv[9] if len(sys.argv) > 9 else ''

    # ── Build credentials ──────────────────────────────────────────────────────
    try:
        creds = build_master_creds(master_access, master_refresh)
    except RuntimeError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        return

    # ── Build the IMAGE formula ────────────────────────────────────────────────
    data = []

    if drive_file_id and drive_file_id != 'NONE':
        image_url = f'https://lh3.googleusercontent.com/d/{drive_file_id}'
        formula   = f'=IMAGE("{image_url}")'
        data.append({
            'range': "'Personal Information'!B13",
            'values': [[formula]]
        })

    try:
        sheets_service = build('sheets', 'v4', credentials=creds)

        # Student info in merged cells C4:D4 through C8:D8
        if name:
            data.append({'range': "'Personal Information'!C4", 'values': [[name]]})
        if student_id:
            data.append({'range': "'Personal Information'!C5", 'values': [[student_id]]})
        if batch:
            data.append({'range': "'Personal Information'!C6", 'values': [[batch]]})
        if email:
            data.append({'range': "'Personal Information'!C7", 'values': [[email]]})
        if mobile_number:
            data.append({'range': "'Personal Information'!C8", 'values': [[mobile_number]]})

        if not data:
            print(json.dumps({'success': True, 'message': 'No data to insert'}))
            return

        sheets_service.spreadsheets().values().batchUpdate(
            spreadsheetId=sheet_id,
            body={
                'valueInputOption': 'USER_ENTERED',
                'data': data
            }
        ).execute()

        print(json.dumps({'success': True}))

    except HttpError as e:
        print(json.dumps({'success': False, 'error': f'Sheets API error: {e}'}))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))


if __name__ == '__main__':
    main()
