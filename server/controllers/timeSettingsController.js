// controllers/timeSettingsController.js
const { TimeSettings } = require('../models');

const timeSettingsController = {
    /**
     * Get the current active time settings
     */
    async getSettings(req, res) {
        try {
            // Fetch the most recent setting record
            const settings = await TimeSettings.findOne({
                order: [['created_at', 'DESC']]
            });

            if (!settings) {
                return res.status(200).json({
                    success: true,
                    data: {
                        title: 'Award Application',
                        start_date: null,
                        end_date: null,
                        start_time: '09:00',
                        end_time: '18:00',
                        time_zone: 'Asia/Kolkata',
                        days: 7
                    }
                });
            }

            return res.status(200).json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('Error fetching time settings:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error while fetching settings',
                error: error.message
            });
        }
    },

    /**
     * Update or create time settings
     */
    async updateSettings(req, res) {
        try {
            const { title, start_date, end_date, start_time, end_time, days } = req.body;

            // Basic validation
            if (!title || !start_date || !end_date || !start_time || !end_time) {
                return res.status(400).json({
                    success: false,
                    message: 'All fields (title, dates, times) are required.'
                });
            }

            // For simplicity and "Enterprise" feel, we create a new entry to maintain history
            // or we could update the latest one. The prompt suggests a management feature.
            const newSettings = await TimeSettings.create({
                title,
                start_date,
                end_date,
                start_time,
                end_time,
                days: days || 7,
                time_zone: 'Asia/Kolkata' // Fixed as requested
            });

            return res.status(201).json({
                success: true,
                message: 'Time settings updated successfully',
                data: newSettings
            });
        } catch (error) {
            console.error('Error updating time settings:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error while updating settings',
                error: error.message
            });
        }
    }
};

module.exports = timeSettingsController;
