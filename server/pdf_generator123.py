from flask import Flask, request, jsonify
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
import os
import time
import io
import base64
from PyPDF2 import PdfReader, PdfWriter


app = Flask(__name__)

# Positioning constants (aligned with Node.js controller)
ID_POSITIONS = [
    {'x': 50, 'y': 700},
    {'x': 300, 'y': 700},
    {'x': 550, 'y': 700},
    {'x': 50, 'y': 350},
    {'x': 300, 'y': 350},
]
PHOTO_POS = {'x': 10, 'y': 250, 'width': 100, 'height': 100}
NAME_POS = {'x': 10, 'y': 200}
BATCH_POS = {'x': 10, 'y': 180}
DOB_POS = {'x': 10, 'y': 160}

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    try:
        # Get student data from the request
        data = request.json
        students = data['students']

        # Ensure the output directory exists
        output_dir = "/opt/View/StudentTrackingSystem/server/generated_pdfs"
        os.makedirs(output_dir, exist_ok=True)

        # Generate a unique PDF filename
        pdf_filename = f"student_ids_{int(time.time())}.pdf"
        pdf_path = os.path.join(output_dir, pdf_filename)

        # Load the template PDF
        template_path = "/opt/View/StudentTrackingSystem/server/controllers/IDtemplate.pdf"
        template_pdf = PdfReader(template_path)
        output_pdf = PdfWriter()

        # Create a canvas for overlaying content
        packet = io.BytesIO()
        c = canvas.Canvas(packet, pagesize=letter)

        students_per_page = 5
        total_pages = (len(students) + students_per_page - 1) // students_per_page

        for page_num in range(total_pages):
            # Start a new page in the canvas
            if page_num > 0:
                c.showPage()

            start = page_num * students_per_page
            end = min(start + students_per_page, len(students))
            page_students = students[start:end]

            c.setFont("Helvetica", 12)
            for i, student in enumerate(page_students):
                id_position = ID_POSITIONS[i]
                x_base = id_position['x']
                y_base = id_position['y']

                # Add photo
                if 'Photo' in student and student['Photo']:
                    photo_data = base64.b64decode(student['Photo'])
                    photo = ImageReader(io.BytesIO(photo_data))
                    c.drawImage(photo, x_base + PHOTO_POS['x'], y_base + PHOTO_POS['y'], 
                              width=PHOTO_POS['width'], height=PHOTO_POS['height'])
                else:
                    # Draw a placeholder rectangle if no photo
                    c.setFillColor(colors.gray)
                    c.rect(x_base + PHOTO_POS['x'], y_base + PHOTO_POS['y'], 
                          PHOTO_POS['width'], PHOTO_POS['height'], fill=1)

                # Add text
                c.setFillColor(colors.black)
                c.drawString(x_base + NAME_POS['x'], y_base + NAME_POS['y'], 
                           student.get('StudentName', 'Unknown'))
                c.drawString(x_base + BATCH_POS['x'], y_base + BATCH_POS['y'], 
                           student.get('Batch', 'NA'))
                dob_text = student.get('DOB', 'N/A')
                c.drawString(x_base + DOB_POS['x'], y_base + DOB_POS['y'], dob_text)

            # Save the canvas content and merge with template
            c.save()
            packet.seek(0)
            overlay_pdf = PdfReader(packet)
            template_page = template_pdf.pages[0]
            template_page.merge_page(overlay_pdf.pages[0])
            output_pdf.add_page(template_page)

        # Write the final PDF
        with open(pdf_path, 'wb') as output_file:
            output_pdf.write(output_file)

        # Return the PDF path for Node.js to serve
        return jsonify({"message": "PDF generated successfully", "path": pdf_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
