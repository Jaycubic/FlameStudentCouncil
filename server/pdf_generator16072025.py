from flask import Flask, request, jsonify
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from reportlab.lib.colors import HexColor
import os
import time
import io
import base64

app = Flask(__name__)

# Define colors
flame_blue = HexColor("#09466F")
flame_yellow = HexColor("#FDB515")
flame_red = HexColor("#BF1E2D")
flame_black = HexColor("#000000")
flame_white = colors.white

# Load the FLAME University logo
try:
    with open('FlameBase64.js', 'r') as f:
        flame_logo_base64 = f.read().split("'")[1]
    flame_logo_data = base64.b64decode(flame_logo_base64.split(',')[1])
    flame_logo = ImageReader(io.BytesIO(flame_logo_data))
except Exception as e:
    print(f"Error loading logo: {e}")
    flame_logo = None

# Define ID card dimensions (standard size: 3.375 x 2.125 inches at 72 dpi)
ID_WIDTH = 243  # 3.375 inches * 72 pt/inch
ID_HEIGHT = 153  # 2.125 inches * 72 pt/inch
GAP = 10  # Space between front and back

# Define positions for vertical stacking (adjusted for larger size)
ID_POSITIONS = []
TOP_MARGIN = 30  # Reduced to fit 5 pairs
SPACING = 5      # Reduced to fit 5 pairs
for i in range(5):
    x_base = 50
    y_base = 792 - TOP_MARGIN - i * (ID_HEIGHT + SPACING)
    ID_POSITIONS.append({'x': x_base, 'y': y_base})

def draw_front(c, student, x_base, y_base, width, height, border_thickness=1, border_color=flame_black, 
               bg_color=flame_white, text_color=flame_black, header_color=flame_blue):
    # Background for entire front (white)
    c.setFillColor(bg_color)
    c.rect(x_base, y_base - height, width, height, fill=1)

    # Yellow background for left section
    left_width = 160  # Adjusted for larger card
    c.setFillColor(flame_yellow)
    c.rect(x_base, y_base - height, left_width, height, fill=1)

    # White background for logo area
    logo_width = 90   # Scaled up for larger card
    logo_height = 50
    c.setFillColor(flame_white)
    c.rect(x_base + 5, y_base - logo_height - 5, logo_width, logo_height, fill=1)

    # Logo
    if flame_logo:
        c.drawImage(flame_logo, x_base + 5, y_base - logo_height - 5, width=logo_width, height=logo_height)
    else:
        c.setFillColor(colors.gray)
        c.rect(x_base + 5, y_base - logo_height - 5, logo_width, logo_height, fill=1)

    # University name
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(header_color)
    c.drawString(x_base + logo_width + 10, y_base - 25, "FLAME UNIVERSITY")

    # Student photo
    photo_width = 65
    photo_height = 65
    photo_x = x_base + 10
    photo_y = y_base - logo_height - photo_height - 10
    if 'Photo' in student and student['Photo']:
        try:
            photo_data = base64.b64decode(student['Photo'])
            photo = ImageReader(io.BytesIO(photo_data))
            c.drawImage(photo, photo_x, photo_y, width=photo_width, height=photo_height, preserveAspectRatio=True)
        except Exception:
            c.setFillColor(colors.gray)
            c.rect(photo_x, photo_y, photo_width, photo_height, fill=1)
    else:
        c.setFillColor(colors.gray)
        c.rect(photo_x, photo_y, photo_width, photo_height, fill=1)

    # Student details
    text_x = photo_x + photo_width + 10
    c.setFont("Helvetica-Bold", 12)
    c.setFillColor(text_color)
    c.drawString(text_x, y_base - 45, f"{student.get('StudentName', 'Unknown')}")
    c.setFont("Helvetica", 11)
    c.drawString(text_x, y_base - 60, f"ID: {student.get('StudentID', 'N/A')}")
    c.setFont("Helvetica", 10)
    c.drawString(text_x, y_base - 75, f"DOB: {student.get('DOB', 'N/A')}")
    c.drawString(text_x, y_base - 90, f"Validity: {student.get('CardValidity', 'N/A')}")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(text_x, y_base - 105, f"Blood: {student.get('BloodGroup', 'N/A')}")

    # Vertical strip
    strip_width = 20
    strip_x = x_base + width - strip_width
    c.setFillColor(flame_blue)
    c.rect(strip_x, y_base - height / 2, strip_width, height / 2, fill=1)
    c.setFillColor(flame_red)
    c.rect(strip_x, y_base - height, strip_width, height / 2, fill=1)

    # "S UG" text in vertical strip
    c.saveState()
    c.translate(strip_x + strip_width / 2, y_base - height / 2)
    c.rotate(90)
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(flame_white)
    c.drawCentredString(0, -5, "S")
    c.setFont("Helvetica", 6)
    c.drawCentredString(0, 12, "UG")
    c.restoreState()

    # Footer
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(header_color)
    c.drawString(x_base + 5, y_base - height + 10, "www.flame.edu.in Helpline +91-86009 98501")
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(flame_red)
    c.drawString(x_base + 5, y_base - height + 25, "Igniting Minds.")

    # Border
    c.setStrokeColor(border_color)
    c.setLineWidth(border_thickness)
    c.rect(x_base, y_base - height, width, height)

def draw_back(c, x_base, y_base, width, height, border_thickness=1, border_color=flame_black, 
              bg_color=flame_white, text_color=flame_black):
    # Background for entire back (white)
    c.setFillColor(bg_color)
    c.rect(x_base, y_base - height, width, height, fill=1)

    # Address
    address_x = x_base + 10
    c.setFont("Times-Roman", 8)
    c.setFillColor(text_color)
    c.drawString(address_x, y_base - 25, "GAT No. 1270, Lavale,")
    c.drawString(address_x, y_base - 35, "Off. Pune-Bangalore Highway,")
    c.drawString(address_x, y_base - 45, "Pune 412115, India")
    c.drawString(address_x, y_base - 55, "Ph +91-20-6790 6235")

    # Emergency information
    c.setFont("Helvetica", 8)
    c.drawString(address_x, y_base - 70, "For Emergency Information:")
    c.drawString(address_x, y_base - 80, "+91-20-6790 6235")
    c.drawString(address_x, y_base - 90, "Toll-free: 1-800-209-4567")

    # Disclaimer
    c.setFont("Helvetica", 8)
    c.drawString(address_x, y_base - height + 10, "This card is the property of FLAME University.")
    c.drawString(address_x, y_base - height + 20, "If found, please call the numbers given above")
    c.drawString(address_x, y_base - height + 30, "or return to the address overleaf.")

    # Border
    c.setStrokeColor(border_color)
    c.setLineWidth(border_thickness)
    c.rect(x_base, y_base - height, width, height)

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    try:
        data = request.json
        students = data['students']
        output_dir = "/opt/View/StudentTrackingSystem/server/generated_pdfs"
        os.makedirs(output_dir, exist_ok=True)
        pdf_filename = f"student_ids_{int(time.time())}.pdf"
        pdf_path = os.path.join(output_dir, pdf_filename)
        c = canvas.Canvas(pdf_path, pagesize=letter)

        students_per_page = 5
        total_pages = (len(students) + students_per_page - 1) // students_per_page

        for page_num in range(total_pages):
            start = page_num * students_per_page
            end = min(start + students_per_page, len(students))
            page_students = students[start:end]

            for i, student in enumerate(page_students):
                id_position = ID_POSITIONS[i]
                x_base_front = id_position['x']
                y_base = id_position['y']
                # Draw front
                draw_front(c, student, x_base_front, y_base, ID_WIDTH, ID_HEIGHT)
                # Draw back to the right of front
                x_base_back = x_base_front + ID_WIDTH + GAP
                draw_back(c, x_base_back, y_base, ID_WIDTH, ID_HEIGHT)

            c.showPage()

        c.save()
        return jsonify({"message": "PDF generated successfully", "path": pdf_path})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
