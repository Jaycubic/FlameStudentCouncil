// server/controllers/formProcessingController.js
const { StudentData, TrailblazerAward, SportsPersonAward, CulturalPersonAward, TimeSettings } = require('../models');
const path = require('path');
const fs = require('fs');

const PHOTO_DIR = '/opt/View/StudentTrackingSystem/server/Photos';

const formProcessingController = {
    // Get data to prefill the form
    async getPrefillData(req, res) {
        try {
            const email = req.user.email;

            // 1. Fetch from StudentData
            const student = await StudentData.findOne({
                where: { email_id: email }
            });

            if (!student) {
                return res.status(404).json({ message: 'Student data not found in registration records.' });
            }

            // 2. Check for photo
            let photoExists = false;
            const extensions = ['.jpg', '.jpeg', '.png'];
            let foundPhoto = null;
            const photoBase = student.photo;

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

            // 3. Check for existing submissions in ALL tables
            const [trailblazer, sports, cultural] = await Promise.all([
                TrailblazerAward.findOne({ where: { email } }),
                SportsPersonAward.findOne({ where: { email } }),
                CulturalPersonAward.findOne({ where: { email } })
            ]);

            const filledRoles = [];
            if (trailblazer) filledRoles.push('Trailblazer');
            if (sports) filledRoles.push('Sports Person');
            if (cultural) filledRoles.push('Cultural Person');

            return res.json({
                prefill: {
                    name: student.student_name,
                    student_id: student.student_cvue_no ? student.student_cvue_no.toString() : '',
                    mobile_number: student.contact_no ? student.contact_no.toString() : '',
                    gender: student.gender,
                    batch: student.batch,
                    email: student.email_id || email,
                    photo: foundPhoto
                },
                photoExists,
                filledRoles
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
