const { StudentData, formSubmissions, TimeSettings } = require('../models');
const path = require('path');
const fs = require('fs');

const PHOTO_DIR = '/opt/View/StudentTrackingSystem/server/Photos';

const formProcessingController = {
    // Get data to prefill the form
    async getPrefillData(req, res) {
        try {
            const { studentId, email } = req.user; // Assumes validateToken sets req.user

            // 1. Fetch from StudentData
            const student = await StudentData.findOne({
                where: { student_cvue_no: studentId }
            });

            if (!student) {
                return res.status(404).json({ message: 'Student data not found in registration records.' });
            }

            // 2. Check for photo in local directory
            let photoExists = false;
            const extensions = ['.jpg', '.jpeg', '.png'];
            let foundPhoto = null;

            for (const ext of extensions) {
                if (fs.existsSync(path.join(PHOTO_DIR, `${studentId}${ext}`))) {
                    photoExists = true;
                    foundPhoto = `${studentId}${ext}`;
                    break;
                }
            }

            // 3. Check for existing submission status
            const existingSubmission = await formSubmissions.findOne({
                where: { email: email }
            });

            const filledRoles = [];
            if (existingSubmission) {
                if (existingSubmission.cgpa && parseFloat(existingSubmission.cgpa) !== 0) {
                    filledRoles.push('Trailblazer');
                }
                if (existingSubmission.sports_score && existingSubmission.sports_score !== '0') {
                    filledRoles.push('Sports Person');
                }
                if (existingSubmission.cultural_score && existingSubmission.cultural_score !== '0') {
                    filledRoles.push('Cultural Person');
                }
            }

            return res.json({
                prefill: {
                    name: student.student_name,
                    student_id: student.student_cvue_no,
                    mobile_number: student.contact_no ? student.contact_no.toString() : '',
                    gender: student.gender,
                    batch: student.batch,
                    email: student.email_id || email,
                    photo: foundPhoto
                },
                photoExists,
                filledRoles,
                submission_id: existingSubmission ? existingSubmission.id : null
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
                // If no settings found, we might want to default to closed or open
                return res.json({ isOpen: true, message: 'Settings not configured, defaulting to open.' });
            }

            const now = new Date();
            const createdAt = new Date(settings.created_at);

            // Calculate days difference
            const diffTime = Math.abs(now - createdAt);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > settings.days) {
                return res.json({ isOpen: false, message: 'APPLICATION PERIOD HAS ENDED' });
            }

            // Time parsing logic (simplified)
            const [startH, startM] = settings.start_time.split(':');
            const [endH, endM] = settings.end_time.split(':');

            const startTime = new Date();
            startTime.setHours(startH, startM, 0);

            const endTime = new Date();
            endTime.setHours(endH, endM, 0);

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
