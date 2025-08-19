import fitz         # PyMuPDF
from flask import Flask, request, jsonify
import os, time, base64, io

app = Flask(__name__)

TEMPLATE_PATH = "/opt/View/StudentTrackingSystem/server/controllers/IDtemplate.pdf"
OUTPUT_DIR    = "/opt/View/StudentTrackingSystem/server/generated_pdfs"

# ─── InDesign blueprint (same as before) ────────────────────────────────────────
blueprint = [
    {"label":"Name",       "bounds":[0.99616310014396,1.57385826771528,1.24692690002325,3.01385826771528]},
    {"label":"StudentID",  "bounds":[1.28505198903285,1.57385826771528,1.43905048519442,2.43385826771528]},
    {"label":"DOB",        "bounds":[1.4668282629722, 2.13163604549306,1.5791600924671, 2.99163604549306]},
    {"label":"Validity",   "bounds":[1.62082675913376,2.12885826771528,1.73315858862866,2.89685826771528]},
    {"label":"Blood",      "bounds":[1.77482525529533,2.1340804899375, 1.88715708479023,2.9940804899375]},
    {"label":"Batch",      "bounds":[1.77482525529533,3.57385826771528,1.93305048519442,3.77385826771528]},
    {"label":"Photo",      "bounds":[0.94505048519442,0.5735,          1.93305048519442,1.3415]},
    # … repeat for slots 2,3,4 with "Name 2", "Name 3" … etc …
]

# Map InDesign label → JSON key
FIELD_KEYS = {
    "Name":      "StudentName",
    "StudentID": "StudentCvueNo",
    "DOB":       "DOB",
    "Validity":  "Validity",
    "Blood":     "Blood",
    "Batch":     "Batch",
    "Photo":     "Photo",
}

def inches_to_points(arr):
    return [v*72 for v in arr]

@app.route('/generate_pdf', methods=['POST'])
def generate_pdf():
    students = request.json.get("students", [])
    if not students:
        return jsonify(error="No students provided"), 400

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    ts = int(time.time())
    intermediate_path = os.path.join(OUTPUT_DIR, f"ids_{ts}_filled.pdf")
    final_path        = os.path.join(OUTPUT_DIR, f"ids_{ts}_final.pdf")

    # 1) Open template
    doc = fitz.open(TEMPLATE_PATH)
    page = doc[0]
    print(f"Loaded template: {TEMPLATE_PATH}")

    # 2) For each student (5 per page), fill fields & draw photos
    for idx, student in enumerate(students):
        slot = idx % 5
        label = blueprint[slot]["label"]
        bounds = inches_to_points(blueprint[slot]["bounds"])
        key = FIELD_KEYS[label]

        # a) If text field exists in AcroForm, set its value & flags
        try:
            widget = page.widgets()[slot*len(FIELD_KEYS)]  # simplistic index; see note below
            # better: iterate all widgets, match widget.field_name to blueprint[slot]["label"]
        except Exception:
            widget = None

        # But PyMuPDF lets us set by name:
        fname = f"{label}{'' if slot==0 else f' {slot+1}'}"
        w = page.firstWidget  # iterate
        while w:
            if w.field_name == fname:
                print(f"Filling field '{fname}' with '{student.get(key,'N/A')}'")
                w.field_value = student.get(key,'N/A')
                w.set_flags(fitz.PDF_ANNOT_FLAG_READONLY)  # make read‑only
                # regenerate appearance so it’s visible
                w.update()
                break
            w = w.next

        # b) Draw photo (if any) into the same rectangle
        if key == "Photo" and student.get("Photo"):
            img_rect = fitz.Rect(bounds)
            img_data = base64.b64decode(student["Photo"])
            page.insertImage(img_rect, stream=img_data, keep_proportion=True)
            print(f"Placed photo for slot {slot}")

        # After five, or at end, we could copy to new page—but here single‐page template

    # Save intermediate (filled but still editable)
    doc.save(intermediate_path)
    print("Saved filled form:", intermediate_path)

    # 3) Now remove all widget annotations (flatten) but keep the look
    doc2 = fitz.open(intermediate_path)
    for p in doc2:
        for w in p.widgets():
            r = w.rect
            # render the widget into the page content
            pix = p.getPixmap(matrix=fitz.Matrix(1,1), clip=r)
            p.insertImage(r, pixmap=pix)
            # then delete the widget
            p.deleteWidget(w)
    doc2.save(final_path)
    print("Saved final flattened PDF:", final_path)

    return jsonify(message="PDF generated", filled=intermediate_path, final=final_path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
