# scripts/generate_sheet.py
import sys
import json
import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
import shutil

# Usage: python generate_sheet.py <type> <student_email> <access_token> <refresh_token>

def main():
    if len(sys.argv) < 5:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        return

    sheet_type = sys.argv[1] # 'cultural' or 'sports'
    student_email = sys.argv[2]
    access_token = sys.argv[3]
    refresh_token = sys.argv[4]

    creds = Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ.get('GOOGLE_CLIENT_ID'),
        client_secret=os.environ.get('GOOGLE_CLIENT_SECRET'),
        scopes=['https://www.googleapis.com/auth/drive']
    )

    try:
        service_drive = build('drive', 'v3', credentials=creds)
        
        # 1. Locate Local Template
        templates_dir = os.path.join(os.path.dirname(__file__), '..', 'templates')
        template_path = os.path.join(templates_dir, f'master_{sheet_type}.xlsx')
        
        if not os.path.exists(template_path):
            print(json.dumps({"success": False, "error": "Local template not found. Please update template in Admin Panel."}))
            return

        # 2. Upload "New" File (Standard Upload, NOT Copy)
        file_metadata = {
            'name': f"{sheet_type.capitalize()} Sheet - {student_email}",
            'mimeType': 'application/vnd.google-apps.spreadsheet'
        }
        
        media = MediaFileUpload(template_path, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', resumable=True)
        
        file = service_drive.files().create(body=file_metadata, media_body=media, fields='id, webViewLink').execute()
        new_file_id = file.get('id')
        
        # 3. Share with Student
        def callback(request_id, response, exception):
            if exception:
                print(f"Error sharing: {exception}")

        batch = service_drive.new_batch_http_request(callback=callback)
        
        user_permission = {
            'type': 'user',
            'role': 'writer',
            'emailAddress': student_email
        }
        
        batch.add(service_drive.permissions().create(
            fileId=new_file_id,
            body=user_permission,
            fields='id',
        ))
        
        batch.execute()
        
        print(json.dumps({
            "success": True, 
            "sheet_id": new_file_id,
            "link": file.get('webViewLink')
        }))

    except HttpError as error:
        print(json.dumps({"success": False, "error": str(error)}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == '__main__':
    main()
