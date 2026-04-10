import os
import smtplib
from email.message import EmailMessage
from datetime import datetime

# Attempt to load the NodeJS .env file out of the box
try:
    from dotenv import load_dotenv
    # Assuming scripts/ is inside server/. Find the .env in server/
    dotenv_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    load_dotenv(dotenv_path)
except ImportError:
    print("Warning: python-dotenv not installed. Using environment variables natively.")

EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USER = os.getenv('EMAIL_USER')
EMAIL_PASS = os.getenv('EMAIL_PASS')

AWARD_LABELS = {
    '1': {'key': 'sports_person', 'label': 'SportsPerson of The Year Award', 'icon': '🏅', 'color': '#2563eb'},
    '2': {'key': 'cultural_person', 'label': 'Best in Co-curricular Activities', 'icon': '🎭', 'color': '#ec4899'},
    '3': {'key': 'trailblazer', 'label': 'Trailblazer Award', 'icon': '🔥', 'color': '#f59e0b'},
}

def get_html_body(student_name, award_label, award_icon, award_color, submission_id):
    date_str = datetime.now().strftime("%d %B %Y")
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>FLAME Awards — Submission Confirmed</title>
  <style>
    body  {{ margin:0; padding:0; background:#f0f4f8; font-family:'Segoe UI',Arial,sans-serif; }}
    .wrap {{ max-width:580px; margin:36px auto; background:#ffffff;
            border-radius:20px; box-shadow:0 8px 40px rgba(0,0,0,0.10); overflow:hidden; }}
    .hdr  {{ background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);
            padding:32px 40px 28px; text-align:center; }}
    .hdr h1 {{ color:#fff; margin:0 0 4px; font-size:24px; font-weight:800; letter-spacing:-0.02em; }}
    .hdr p  {{ color:rgba(255,255,255,0.72); margin:0; font-size:12px; letter-spacing:0.02em; }}
    .icon-wrap {{ text-align:center; margin:28px 0 16px; }}
    .icon-wrap span {{ font-size:52px; }}
    .body {{ padding:0 40px 32px; color:#1e293b; font-size:14.5px; line-height:1.8; }}
    .pill {{ display:inline-block; background:{award_color}18; color:{award_color};
            border:1.5px solid {award_color}40; border-radius:99px;
            padding:4px 16px; font-size:12px; font-weight:700; margin-bottom:20px; }}
    .check-box {{ background:#f0fdf4; border:1.5px solid #86efac; border-radius:14px;
                 padding:16px 20px; margin:20px 0; }}
    .check-box p {{ margin:0; font-size:13px; color:#166534; font-weight:600; }}
    .ref  {{ font-size:11px; color:#94a3b8; margin-top:6px; }}
    .divider {{ border:none; border-top:1px solid #e2e8f0; margin:24px 0; }}
    .ftr  {{ background:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 40px;
            text-align:center; font-size:11px; color:#94a3b8; }}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>🏆 FLAME Awards</h1>
      <p>OFFICIAL SUBMISSION CONFIRMATION</p>
    </div>
    <div class="icon-wrap"><span>{award_icon}</span></div>
    <div class="body">
      <p>Dear <strong>{student_name}</strong>,</p>
      <span class="pill">{award_icon} {award_label}</span>
      <p>
        Your application has been <strong>received and recorded</strong> successfully.
        Our team will review your submission and update you on the next steps.
      </p>
      <div class="check-box">
        <p>✅ &nbsp;Submission confirmed — {date_str}</p>
        <p class="ref">Reference: #{submission_id}</p>
      </div>
      <hr class="divider"/>
      <p style="font-size:13px; color:#64748b; margin:0;">
        If you have any questions, please contact us at
        <a href="mailto:student.awards@flame.edu.in" style="color:#2563eb;">student.awards@flame.edu.in</a>
      </p>
    </div>
    <div class="ftr">
      FLAME University Awards Office &nbsp;·&nbsp; This is an automated message — please do not reply.
    </div>
  </div>
</body>
</html>"""

def main():
    print("===========================================")
    print("  Manual Award Submission Email Sender   ")
    print("===========================================")
    
    if not EMAIL_USER or not EMAIL_PASS:
        print("ERROR: EMAIL_USER or EMAIL_PASS not found in environment or .env file.")
        print("Please ensure your .env file in the /server dir is loaded propertly.")
        return

    print("\nSelect Award Type:")
    for key, val in AWARD_LABELS.items():
        print(f"  [{key}]. {val['label']}")
    
    choice = input("\nEnter choice (1/2/3): ").strip()
    if choice not in AWARD_LABELS:
        print("Invalid choice. Exiting.")
        return
        
    award = AWARD_LABELS[choice]
    
    student_name = input("Enter Student Full Name: ").strip()
    student_email = input("Enter Student Email: ").strip()
    submission_id = input("Enter Submission ID # (e.g. 104): ").strip()
    
    print("\n--- Summary ---")
    print(f"  To:     {student_email}")
    print(f"  Name:   {student_name}")
    print(f"  Award:  {award['label']}")
    print(f"  Sub ID: #{submission_id}")
    confirm = input("\nSend confirmation email? (y/n): ").strip().lower()
    
    if confirm != 'y':
        print("Cancelled.")
        return
        
    subject = f"{award['icon']} Submission Confirmed — {award['label']}"
    html_content = get_html_body(student_name, award['label'], award['icon'], award['color'], submission_id)

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = f'"FLAME Awards" <{EMAIL_USER}>'
    msg['To'] = student_email
    msg.set_content("Please view this email in an HTML-capable email client.")
    msg.add_alternative(html_content, subtype='html')

    try:
        print(f"\nConnecting to SMTP via {EMAIL_HOST}:{EMAIL_PORT}...")
        with smtplib.SMTP(EMAIL_HOST, EMAIL_PORT) as server:
            server.starttls()
            server.login(EMAIL_USER, EMAIL_PASS)
            server.send_message(msg)
        print(f"✅ Success! Email manually sent to {student_email}.")
    except Exception as e:
        print(f"❌ Failed to send email: {e}")

if __name__ == "__main__":
    main()
