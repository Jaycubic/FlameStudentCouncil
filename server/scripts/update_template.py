# scripts/update_template.py
#
# Usage: python update_template.py <type> <access_token> <refresh_token>
# type: 'cultural', 'sports', or 'academic'

import sys
import json
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
import io


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        return

    sheet_type = sys.argv[1]  # 'cultural', 'sports', or 'academic'
    access_token = sys.argv[2]
    refresh_token = sys.argv[3]

    # Master workbook file IDs (Google Drive)
    MASTER_IDS = {
        'sports':   '1btB3-q4kZjigr0rlMpH3YngWBWbvPWJ-',
        'cultural': '1uUVRe_9fa_Op10M3dVDmH88ITTRf7pp8',
        'academic': '1pbleLoKSdHyZEQafP06prqmovWRempTh',
    }

    if sheet_type not in MASTER_IDS:
        print(json.dumps({"success": False, "error": f"Invalid type: {sheet_type}. Expected: sports, cultural, academic"}))
        return

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive.readonly']
    )

    try:
        service = build('drive', 'v3', credentials=creds)
        file_id = MASTER_IDS[sheet_type]

        # Check if native Google Sheet or uploaded Excel file
        file_info = service.files().get(fileId=file_id, fields='mimeType').execute()
        mime_type = file_info.get('mimeType')

        if mime_type == 'application/vnd.google-apps.spreadsheet':
            # Export native Google Sheet as XLSX (preserves all tabs)
            request = service.files().export_media(
                fileId=file_id,
                mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
        else:
            # Download file as is (e.g., already an XLSX file)
            request = service.files().get_media(fileId=file_id)

        # Ensure templates directory exists
        templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
        os.makedirs(templates_dir, exist_ok=True)

        destination = os.path.join(templates_dir, f'master_{sheet_type}.xlsx')

        fh = io.FileIO(destination, 'wb')
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()

        print(json.dumps({"success": True, "message": f"{sheet_type} template updated successfully"}))

    except HttpError as error:
        print(json.dumps({"success": False, "error": str(error)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
