// workers/submissionEmailWorker.js
//
// BullMQ worker — concurrency 5.
// Sends a short, nicely-formatted submission confirmation email to the student
// after they submit a Student Council election application.

const { Worker }   = require('bullmq');
const nodemailer   = require('nodemailer');
const { connection } = require('../queues/submissionEmailQueue');
const log = require('../utils/logger').child({ module: 'SubmissionEmailWorker' });

// ─── SMTP transporter (pooled, same config as emailController) ────────────────
const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    pool:           true,
    maxConnections: 2,
    maxMessages:    100,
    rateLimit:      5,
    rateDelta:      1000,
});

// ─── Email HTML builder ───────────────────────────────────────────────────────
function buildConfirmationEmail({ studentName, positionSelected, submissionId }) {
    const date = new Date().toLocaleDateString('en-IN', {
        day: 'numeric', month: 'long', year: 'numeric',
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Student Council — Submission Confirmed</title>
  <style>
    body  { margin:0; padding:0; background:#f0f4f8; font-family:'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:580px; margin:36px auto; background:#ffffff;
            border-radius:20px; box-shadow:0 8px 40px rgba(0,0,0,0.10); overflow:hidden; }
    .hdr  { background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);
            padding:32px 40px 28px; text-align:center; }
    .hdr h1 { color:#fff; margin:0 0 4px; font-size:24px; font-weight:800; letter-spacing:-0.02em; }
    .hdr p  { color:rgba(255,255,255,0.72); margin:0; font-size:12px; letter-spacing:0.02em; }
    .icon-wrap { text-align:center; margin:28px 0 16px; }
    .icon-wrap span { font-size:52px; }
    .body { padding:0 40px 32px; color:#1e293b; font-size:14.5px; line-height:1.8; }
    .pill { display:inline-block; background:#2563eb18; color:#2563eb;
            border:1.5px solid #2563eb40; border-radius:99px;
            padding:4px 16px; font-size:12px; font-weight:700; margin-bottom:20px; }
    .check-box { background:#f0fdf4; border:1.5px solid #86efac; border-radius:14px;
                 padding:16px 20px; margin:20px 0; }
    .check-box p { margin:0; font-size:13px; color:#166534; font-weight:600; }
    .ref  { font-size:11px; color:#94a3b8; margin-top:6px; }
    .divider { border:none; border-top:1px solid #e2e8f0; margin:24px 0; }
    .ftr  { background:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 40px;
            text-align:center; font-size:11px; color:#94a3b8; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>🏛️ Student Council</h1>
      <p>OFFICIAL SUBMISSION CONFIRMATION</p>
    </div>

    <div class="icon-wrap"><span>🗳️</span></div>

    <div class="body">
      <p>Dear <strong>${studentName}</strong>,</p>

      <span class="pill">🗳️ ${positionSelected}</span>

      <p>
        Your Student Council election application has been <strong>received and recorded</strong> successfully.
        Our team will review your submission and update you on the next steps.
      </p>

      <div class="check-box">
        <p>✅ &nbsp;Submission confirmed — ${date}</p>
        <p class="ref">Reference: #${submissionId}</p>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:#64748b; margin:0;">
        If you have any questions, please contact us at
        <a href="mailto:student.awards@flame.edu.in" style="color:#2563eb;">student.awards@flame.edu.in</a>
      </p>
    </div>

    <div class="ftr">
      FLAME University Student Council &nbsp;·&nbsp; This is an automated message — please do not reply.
    </div>
  </div>
</body>
</html>`;
}

// ─── Worker ───────────────────────────────────────────────────────────────────
const worker = new Worker('submission-email', async (job) => {
    const { studentEmail, studentName, positionSelected, submissionId } = job.data;

    log.info({ studentEmail, positionSelected, submissionId, attempt: job.attemptsMade + 1 },
        '[SubmissionEmail] Sending confirmation');

    const html = buildConfirmationEmail({
        studentName:      studentName || 'Student',
        positionSelected: positionSelected || 'Student Council Position',
        submissionId,
    });

    await transporter.sendMail({
        from:    `"Student Council" <${process.env.EMAIL_USER}>`,
        to:      studentEmail,
        subject: `🗳️ Submission Confirmed — ${positionSelected || 'Student Council'}`,
        html,
    });

    log.info({ studentEmail, positionSelected }, '[SubmissionEmail] ✅ Confirmation sent');
    return { sent: true };

}, {
    connection,
    concurrency: 5,
    limiter: { max: 10, duration: 60_000 },
});

// ─── Events ───────────────────────────────────────────────────────────────────
worker.on('completed', job => {
    log.info({ jobId: job.id }, '[SubmissionEmail] Job completed');
});

worker.on('failed', (job, err) => {
    log.error({
        jobId:   job?.id,
        attempt: job?.attemptsMade,
        err:     err.message,
    }, '[SubmissionEmail] Job failed');
});

worker.on('error', err => {
    log.error({ err: err.message }, '[SubmissionEmail] Worker connection error');
});

log.info({ concurrency: 5 }, '[SubmissionEmail] Worker started');

module.exports = worker;
