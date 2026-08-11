// workers/submissionProcessingWorker.js
//
// BullMQ worker for post-submission background tasks (concurrency: 5).
// Handles: Dynamic sheet tabs, PDF merging, confirmation emails,
//          cloud sync, and dashboard updates.
//
// Score reading and workbook revocation are kept SYNCHRONOUS in the controller.

const { Worker }       = require('bullmq');
const { spawn }        = require('child_process');
const path             = require('path');
const fs               = require('fs');
const { connection }   = require('../queues/submissionProcessingQueue');
const {
    ElectionFormResponse,
    ElectionAttachment,
    AcademicUserSheet,
    User
} = require('../models');
const { insertSopSheetTab, insertMoreInfoSheetTab } = require('../controllers/sheetController');
const { triggerAutoCloudSync }  = require('../controllers/awardsWorkbookController');
const { emitDashboardUpdate }   = require('../controllers/dashboardController');
const { submissionEmailQueue }  = require('../queues/submissionEmailQueue');
const log = require('../utils/logger').child({ module: 'SubmissionProcessingWorker' });

const MASTER_EMAIL    = 'student.awards@flame.edu.in';
const ATTACHMENT_DIR  = '/opt/View/FlameStudentCouncil/server/Attachments';

// ─── Python script runner (with timeout) ──────────────────────────────────────
function runPythonScript(scriptPath, args, timeoutMs = 120_000) {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', [scriptPath, ...args]);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', d => { stdout += d.toString(); });
        proc.stderr.on('data', d => { stderr += d.toString(); });

        const timer = setTimeout(() => {
            proc.kill('SIGTERM');
            reject(new Error(`Script timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);

        proc.on('close', code => {
            clearTimeout(timer);
            if (code !== 0) {
                return reject(new Error(`Script exited ${code}: ${stderr.trim()}`));
            }
            try {
                resolve(JSON.parse(stdout.trim()));
            } catch {
                reject(new Error(`Non-JSON output: ${stdout.trim()}`));
            }
        });
    });
}

// ─── Job processor ────────────────────────────────────────────────────────────
async function processSubmissionJob(job) {
    const {
        submissionId,
        email,
        studentName,
        positionSelected,
        studentId,
        statementOfPurpose,
        moreInfo,
    } = job.data;

    log.info({ submissionId, email, attempt: job.attemptsMade + 1 },
        '[SubmissionProcessing] Processing background tasks');

    const submission = await ElectionFormResponse.findByPk(submissionId);
    if (!submission) {
        throw new Error(`Submission ${submissionId} not found`);
    }

    const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });

    // ── 1. Dynamic Sheet Tabs (SOP & More Info) ──────────────────────────────
    try {
        const sheet = await AcademicUserSheet.findOne({ where: { email } });
        if (sheet?.user_sheet_id && masterUser?.access_token) {
            if (statementOfPurpose) {
                await insertSopSheetTab(sheet.user_sheet_id, statementOfPurpose, masterUser);
                log.info({ email }, '[SheetTabs] SOP tab inserted');
            }
            if (moreInfo && moreInfo.trim()) {
                await insertMoreInfoSheetTab(sheet.user_sheet_id, moreInfo, masterUser);
                log.info({ email }, '[SheetTabs] More Info tab inserted');
            }
        }
    } catch (err) {
        log.warn({ err: err.message, email }, '[SheetTabs] Failed to insert — non-fatal');
    }

    // ── 2. PDF Merge ─────────────────────────────────────────────────────────
    try {
        const sidForMerge = (studentId || '').toString().trim();
        if (sidForMerge) {
            const aFiles = await ElectionAttachment.findAll({
                where: { submission_id: submissionId },
                attributes: ['file_name']
            });
            const pdfPaths = aFiles
                .map(f => path.join(ATTACHMENT_DIR, 'election', f.file_name))
                .filter(p => fs.existsSync(p));

            if (pdfPaths.length > 0) {
                const outputPath = path.join(ATTACHMENT_DIR, 'election', `${sidForMerge}_election_merged.pdf`);
                const scriptPath = path.join(__dirname, '../scripts/merge_pdfs.py');
                const result = await runPythonScript(scriptPath, [outputPath, ...pdfPaths], 60_000);

                if (result.success) {
                    log.info({ sidForMerge, merged: result.merged, output: result.output }, '[PdfMerge] ✅ Merged');
                } else {
                    log.error({ sidForMerge, error: result.error }, '[PdfMerge] ❌ Script failure');
                }
            } else {
                log.info({ sidForMerge }, '[PdfMerge] No PDF files found — skipping');
            }
        }
    } catch (err) {
        log.error({ err: err.message }, '[PdfMerge] Error during merge — non-fatal');
    }

    // ── 3. Confirmation Email ────────────────────────────────────────────────
    try {
        await submissionEmailQueue.add(
            `confirm:${submissionId}`,
            {
                studentEmail: email,
                studentName: studentName || email,
                positionSelected: positionSelected || 'Student Council Position',
                submissionId,
            },
            { jobId: `confirm-${submissionId}`, attempts: 3 }
        );
        await submission.update({ notification_status: 'pending' });
        log.info({ email, submissionId }, '[Email] Confirmation email queued');
    } catch (err) {
        // Persist failure so self-healing can pick it up
        await submission.update({ notification_status: 'failed' }).catch(() => {});
        log.error({ err: err.message, email }, '[Email] Failed to enqueue — status set to failed');
    }

    // ── 4. Cloud Sync & Dashboard ────────────────────────────────────────────
    try {
        await triggerAutoCloudSync();
        log.info({ email }, '[CloudSync] Master workbook sync triggered');
    } catch (err) {
        log.warn({ err: err.message }, '[CloudSync] Background sync error — non-fatal');
    }

    emitDashboardUpdate();

    log.info({ submissionId, email }, '[SubmissionProcessing] ✅ All background tasks completed');
    return { success: true };
}

// ─── Start worker ─────────────────────────────────────────────────────────────
const worker = new Worker('submission-processing', processSubmissionJob, {
    connection,
    concurrency: 5,
    limiter: {
        max: 20,
        duration: 60_000,
    },
});

// ─── Events ───────────────────────────────────────────────────────────────────
worker.on('completed', job => {
    log.info({ jobId: job.id, email: job.data.email }, '[SubmissionProcessing] Job completed');
});

worker.on('failed', (job, err) => {
    log.error({
        jobId:   job?.id,
        email:   job?.data?.email,
        attempt: job?.attemptsMade,
        err:     err.message,
    }, '[SubmissionProcessing] Job failed');
});

worker.on('error', err => {
    log.error({ err: err.message }, '[SubmissionProcessing] Worker connection error');
});

log.info({ concurrency: 5 }, '[SubmissionProcessing] Worker started');

module.exports = worker;
