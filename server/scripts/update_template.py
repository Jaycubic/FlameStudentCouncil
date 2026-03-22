import sys
import json
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload
import io

# Usage: python update_template.py <type> <access_token> <refresh_token>

def main():
    if len(sys.argv) < 4:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        return

    sheet_type = sys.argv[1] # 'cultural' or 'sports'
    access_token = sys.argv[2]
    refresh_token = sys.argv[3]

    MASTER_SHEET_ID_CULTURAL = '1W5c-6KTh5KxZUZktriJdsHCeLwzGjmHu'
    MASTER_SHEET_ID_SPORTS = '1xjOG7lsXD1YKTsztB0owmzsY1E0Hxf9Q7K9VTX0m_pk'

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
        
        file_id = MASTER_SHEET_ID_CULTURAL if sheet_type == 'cultural' else MASTER_SHEET_ID_SPORTS
        
        # Export as XLSX
        request = service.files().export_media(fileId=file_id, mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        
        # Ensure templates directory exists
        templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
        os.makedirs(templates_dir, exist_ok=True)
        
        destination = os.path.join(templates_dir, f'master_{sheet_type}.xlsx')
        
        fh = io.FileIO(destination, 'wb')
        downloader = MediaIoBaseDownload(fh, request)
        done = False
        while done is False:
            status, done = downloader.next_chunk()
            
        print(json.dumps({"success": True, "message": "Template updated successfully"}))

    except HttpError as error:
        print(json.dumps({"success": False, "error": str(error)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
