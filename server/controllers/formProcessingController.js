// server/controllers/formProcessingController.js
const { StudentData, ElectionFormResponse, TimeSettings, StudentCgpaCache, Position, ElectionDraft } = require('../models');
const path = require('path');
const fs = require('fs');
const { refreshCgpaInBackground } = require('../services/cgpaLookupService');

const PHOTO_DIR = '/opt/View/StudentTrackingSystem/server/Photos';

const formProcessingController = {
    // Get data to prefill the form
    async getPrefillData(req, res) {
        try {
            const email = req.user.email;

            // 1. Fetch from StudentData
            const { Op } = require('sequelize');
            const student = await StudentData.findOne({
                where: { [Op.or]: [{ EmailID: email }, { email_id: email }] }
            });

            if (!student) {
                return res.status(404).json({ message: 'Student data not found in registration records.' });
            }

            const studentCvueNo = student.StudentCvueNo || student.student_cvue_no;
            const studentPhoto  = student.Photo || student.photo;

            // 2. Check for photo — try student.photo first, fallback to student_cvue_no
            let photoExists = false;
            const extensions = ['.jpg', '.jpeg', '.png'];
            let foundPhoto = null;
            const photoBase = studentPhoto || (studentCvueNo ? studentCvueNo.toString() : null);

            if (photoBase) {
                for (const ext of extensions) {
                    const photoPath = path.join(PHOTO_DIR, `${photoBase}${ext}`);
                    if (fs.existsSync(photoPath)) {
                        photoExists = true;
                        foundPhoto = `${photoBase}${ext}`;
                        break;
                    }
                }
            }

            // 3. Check if student has already submitted
            const existingSubmission = await ElectionFormResponse.findOne({ where: { email } });
            const hasSubmitted = !!existingSubmission;

            const studentId = studentCvueNo ? studentCvueNo.toString() : '';

            const studentBatch   = student.Batch || student.batch;
            const studentName    = student.StudentName || student.student_name;
            const studentContact = student.ContactNo || student.contact_no;
            const studentGender  = student.Gender || student.gender;
            const studentEmail   = student.EmailID || student.email_id || email;

            // Fire-and-forget CGPA refresh — schedules via setImmediate inside the
            // service so it runs AFTER this response is flushed, zero latency added.
            if (studentId && studentBatch) {
                refreshCgpaInBackground(
                    studentId,
                    studentEmail,
                    studentBatch
                );
            }

            // Read latest cached CGPA for this student (null = not found = no gate).
            const cgpaCache = studentId
                ? await StudentCgpaCache.findOne({ where: { student_id: studentId }, attributes: ['cgpa'], raw: true })
                : null;
            const studentCgpa = cgpaCache?.cgpa != null ? parseFloat(cgpaCache.cgpa) : null;

            // 4. Fetch available positions
            const positions = await Position.findAll({
                attributes: ['id', 'description'],
                order: [['description', 'ASC']]
            });

            // 5. Fetch existing draft (for autosave restore)
            const draft = await ElectionDraft.findOne({
                where: { email },
                attributes: ['position_selected', 'community_service', 'statement_of_purpose']
            });

            return res.json({
                prefill: {
                    name: studentName,
                    student_id: studentId,
                    mobile_number: studentContact ? studentContact.toString() : '',
                    gender: studentGender,
                    batch: studentBatch,
                    email: studentEmail,
                    photo: foundPhoto,
                    cgpa: studentCgpa       // null means "no data" — frontend displays as-is
                },
                photoExists,
                hasSubmitted,
                // If the student already submitted, return the position they selected
                submittedPosition: existingSubmission?.position_selected || null,
                positions: positions.map(p => ({ id: p.id, description: p.description })),
                draft: draft ? {
                    position_selected: draft.position_selected,
                    community_service: draft.community_service,
                    statement_of_purpose: draft.statement_of_purpose,
                } : null,
            });

        } catch (error) {
            console.error('Prefill error:', error);
            return res.status(500).json({ message: 'Error fetching prefill data', error: error.message });
        }
    },

    // Check if application period is open
    async getApplicationStatus(req, res) {
        try {
            const settings = await TimeSettings.findOne({
                order: [['created_at', 'DESC']]
            });

            if (!settings) {
                return res.json({ isOpen: true, message: 'Settings not configured, defaulting to open.' });
            }

            const now = new Date();
            const createdAt = new Date(settings.created_at);

            const diffTime = Math.abs(now - createdAt);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > settings.days) {
                return res.json({ isOpen: false, message: 'APPLICATION PERIOD HAS ENDED' });
            }

            const [startH, startM] = settings.start_time.split(':');
            const [endH, endM] = settings.end_time.split(':');

            const startTime = new Date();
            startTime.setHours(parseInt(startH), parseInt(startM), 0);

            const endTime = new Date();
            endTime.setHours(parseInt(endH), parseInt(endM), 0);

            if (now < startTime) {
                return res.json({ isOpen: false, message: 'Applications Not Yet Opened today.' });
            }

            if (now > endTime) {
                return res.json({ isOpen: false, message: 'Application Window Closed for today.' });
            }

            return res.json({ isOpen: true });

        } catch (error) {
            console.error('Status check error:', error);
            return res.status(500).json({ message: 'Error checking application status', error: error.message });
        }
    }
};

module.exports = formProcessingController;
