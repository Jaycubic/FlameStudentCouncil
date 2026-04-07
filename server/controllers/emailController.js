// server/controllers/emailController.js
//
// Handles bulk SMTP email sending for Award Notifications.
// Sends to each recipient individually (no BCC leakage),
// with configurable per-message delay to respect SMTP rate limits.

const nodemailer = require('nodemailer');
const { EmailLog } = require('../models');
const log = require('../utils/logger').child({ module: 'EmailController' });

// ─── Transporter (connection pooled) ─────────────────────────────────────────
const transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    pool:           true,   // reuse SMTP connection across messages
    maxConnections: 3,       // max simultaneous SMTP connections
    maxMessages:    200,     // messages per connection before recycling
    rateDelta:      1000,    // minimum ms between rate-limit windows
    rateLimit:      5,       // max messages per rateDelta window
});

// Verify transporter on startup (non-fatal)
transporter.verify().then(() => {
    log.info('[Email] SMTP transporter ready');
}).catch(err => {
    log.warn({ err: err.message }, '[Email] SMTP transporter verify failed — will retry on first send');
});

// ─── Email HTML wrapper template ─────────────────────────────────────────────
function buildEmailHtml(bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FLAME Awards Notification</title>
  <style>
    body  { margin:0; padding:0; background:#f0f4f8; font-family:'Segoe UI',Arial,sans-serif; }
    .wrap { max-width:620px; margin:36px auto; background:#ffffff;
            border-radius:20px; box-shadow:0 8px 40px rgba(0,0,0,0.10); overflow:hidden; }
    .hdr  { background:linear-gradient(135deg,#1e3a8a 0%,#2563eb 100%);
            padding:32px 40px 28px; }
    .hdr h1 { color:#fff; margin:0 0 4px; font-size:22px; font-weight:800;
              letter-spacing:-0.02em; }
    .hdr p  { color:rgba(255,255,255,0.75); margin:0; font-size:12px; }
    .body { padding:32px 40px; color:#1e293b; font-size:14.5px; line-height:1.75; }
    .body h1,.body h2,.body h3 { margin-top:0; }
    .body ul,.body ol { padding-left:22px; }
    .body a  { color:#2563eb; }
    .body hr { border:none; border-top:1px solid #e2e8f0; margin:16px 0; }
    .ftr  { background:#f8fafc; border-top:1px solid #e2e8f0; padding:18px 40px;
            text-align:center; font-size:11px; color:#94a3b8; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hdr">
      <h1>🏆 FLAME Awards</h1>
      <p>Official Award Notification &nbsp;·&nbsp; student.awards@flame.edu.in</p>
    </div>
    <div class="body">${bodyHtml}</div>
    <div class="ftr">
      This email was sent by the FLAME Awards system.
      Please do not reply directly to this message.
    </div>
  </div>
</body>
</html>`;
}

// ─── Send notification emails ─────────────────────────────────────────────────
// POST /api/email/send-notifications
// Body: { to: string[], cc?: string[], subject: string, html: string, batchDelayMs?: number }
//
// Each recipient gets their OWN email (no BCC, emails are private).
// CC goes on every message. batchDelayMs defaults to 250 ms between sends.

const DEFAULT_BATCH_DELAY = 250;

async function sendNotifications(req, res) {
    try {
        const {
            to             = [],
            recipients     = [],
            awardCategory  = 'Unknown',
            cc             = [],
            subject,
            html,
            batchDelayMs   = DEFAULT_BATCH_DELAY,
        } = req.body;

        const allRecipients = (Array.isArray(recipients) && recipients.length > 0)
            ? recipients
            : (Array.isArray(to) ? to.map(email => ({ email })) : []);

        // ── Validate ──────────────────────────────────────────────────────────
        if (allRecipients.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one recipient is required.' });
        }
        if (!subject?.trim()) {
            return res.status(400).json({ success: false, message: 'Subject is required.' });
        }
        if (!html?.trim()) {
            return res.status(400).json({ success: false, message: 'Email body is required.' });
        }

        const ccStr  = Array.isArray(cc) ? cc.filter(Boolean).join(', ') : '';
        const sent   = [];
        const failed = [];

        log.info({ total: allRecipients.length, cc: cc.length }, '[Email] Starting batch send');

        // Regex matches variations of "[Student's Name]" including HTML entity codes
        const studentNameRegex = /\[Student(?:'|’|&#39;|&apos;|&lsquo;|&rsquo;)?s? Name\]/gi;
        const awardsRegex = /\[Awards\]/gi;

        // ── Send individually ─────────────────────────────────────────────────
        for (let i = 0; i < allRecipients.length; i++) {
            const rData = allRecipients[i];
            const recipientEmail = typeof rData === 'string' ? rData : rData.email;
            
            if (!recipientEmail) {
                failed.push({ email: 'Unknown', error: 'Missing email' });
                continue;
            }

            try {
                const rName = rData.name || 'Student';
                const rAwards = rData.rejected_awards || rData.award_name || 'Award';

                const customizedHtml = html
                    .replace(studentNameRegex, rName)
                    .replace(awardsRegex, rAwards);
                
                const customizedSubject = subject
                    .replace(studentNameRegex, rName)
                    .replace(awardsRegex, rAwards);

                const finalHtml = buildEmailHtml(customizedHtml);

                await transporter.sendMail({
                    from:    `"FLAME Awards" <${process.env.EMAIL_USER}>`,
                    to:      recipientEmail,
                    cc:      ccStr || undefined,
                    subject: customizedSubject.trim(),
                    html:    finalHtml,
                });
                
                await EmailLog.create({
                    student_id: rData.student_id || null,
                    email: recipientEmail,
                    award_category: awardCategory,
                    status: 'sent',
                    error_message: null
                });

                sent.push(recipientEmail);
                log.info({ recipient: recipientEmail }, '[Email] ✓ Sent');
            } catch (err) {
                try {
                    await EmailLog.create({
                        student_id: rData.student_id || null,
                        email: recipientEmail,
                        award_category: awardCategory,
                        status: 'failed',
                        error_message: err.message
                    });
                } catch(dbErr) {
                    log.error({ err: dbErr.message }, '[Email] Failed to write log');
                }
                failed.push({ email: recipientEmail, error: err.message });
                log.error({ recipient: recipientEmail, err: err.message }, '[Email] ✗ Failed');
            }

            // Inter-message delay to respect SMTP rate limits
            if (batchDelayMs > 0 && i < allRecipients.length - 1) {
                await new Promise(r => setTimeout(r, batchDelayMs));
            }
        }

        log.info({ sent: sent.length, failed: failed.length }, '[Email] Batch complete');

        return res.json({
            success: true,
            total:   to.length,
            sent:    sent.length,
            failed:  failed.length,
            details: { sent, failed },
        });

    } catch (err) {
        log.error({ err: err.message }, '[Email] sendNotifications error');
        return res.status(500).json({ success: false, message: err.message });
    }
}

module.exports = { sendNotifications };
