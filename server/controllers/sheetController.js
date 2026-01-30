// controllers/sheetController.js
const { CulturalUserSheet, SportsUserSheet, User } = require('../models');
const { spawn } = require('child_process');
const path = require('path');

// Master Account Email (should match the one generating tokens)
const MASTER_EMAIL = 'jofrey.joseph@flame.edu.in'; // Hardcoded as per request

const sheetController = {
    /**
     * Generate or Retrieve a Spreadsheet
     * @param {string} type - 'cultural' or 'sports'
     */
    async getSheet(req, res) {
        try {
            // 1. Get User from Session/Token (Middleware should provide req.user)
            const userEmail = req.user.email;
            const type = req.params.type; // 'cultural' or 'sports'

            if (!['cultural', 'sports'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Invalid sheet type' });
            }

            const Model = type === 'cultural' ? CulturalUserSheet : SportsUserSheet;

            // 2. Check DB for existing sheet
            const existingSheet = await Model.findOne({ where: { email: userEmail } });

            if (existingSheet) {
                return res.status(200).json({
                    success: true,
                    sheet_id: existingSheet.user_sheet_id,
                    url: `https://docs.google.com/spreadsheets/d/${existingSheet.user_sheet_id}`,
                    isNew: false
                });
            }

            // 3. If no sheet, Initiate Generation
            // 3a. Fetch Master Token
            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });

            if (!masterUser || !masterUser.access_token) {
                return res.status(500).json({
                    success: false,
                    message: 'Master account configuration missing. Please contact admin.'
                });
            }

            // 3b. Call Python Script
            const scriptPath = path.join(__dirname, '../scripts/generate_sheet.py');
            const process = spawn('python', [
                scriptPath,
                type,
                userEmail,
                masterUser.access_token,
                masterUser.refresh_token
            ]);

            let scriptOutput = '';
            let scriptError = '';

            process.stdout.on('data', (data) => {
                scriptOutput += data.toString();
            });

            process.stderr.on('data', (data) => {
                scriptError += data.toString();
            });

            process.on('close', async (code) => {
                if (code !== 0) {
                    console.error(`Python script failed with code ${code}: ${scriptError}`);
                    return res.status(500).json({ success: false, message: 'Sheet generation failed internally.' });
                }

                try {
                    // Parse JSON output from Python
                    const result = JSON.parse(scriptOutput.trim());

                    if (result.success) {
                        // 3c. Store in DB
                        await Model.create({
                            email: userEmail,
                            user_sheet_id: result.sheet_id
                        });

                        return res.status(201).json({
                            success: true,
                            sheet_id: result.sheet_id,
                            url: `https://docs.google.com/spreadsheets/d/${result.sheet_id}`,
                            isNew: true
                        });
                    } else {
                        console.error('Python script returned error:', result.error);
                        return res.status(500).json({ success: false, message: 'Google API Error: ' + result.error });
                    }
                } catch (parseError) {
                    console.error('Failed to parse Python output:', scriptOutput);
                    return res.status(500).json({ success: false, message: 'Invalid response from generation service.' });
                }
            });

        } catch (error) {
            console.error('Sheet controller error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    },

    /**
     * Update the Local Template from Master Sheet
     * @param {string} type - 'cultural' or 'sports'
     */
    async updateTemplate(req, res) {
        try {
            const type = req.params.type;

            if (!['cultural', 'sports'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Invalid sheet type' });
            }

            // 1. Fetch Master Token
            const masterUser = await User.findOne({ where: { email: MASTER_EMAIL } });

            if (!masterUser || !masterUser.access_token) {
                return res.status(500).json({
                    success: false,
                    message: 'Master account configuration missing.'
                });
            }

            // 2. Call Python Script
            const scriptPath = path.join(__dirname, '../scripts/update_template.py');
            const process = spawn('python', [
                scriptPath,
                type,
                masterUser.access_token,
                masterUser.refresh_token
            ]);

            let scriptOutput = '';
            let scriptError = '';

            process.stdout.on('data', (data) => {
                scriptOutput += data.toString();
            });

            process.stderr.on('data', (data) => {
                scriptError += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Template update failed with code ${code}: ${scriptError}`);
                    return res.status(500).json({ success: false, message: 'Template update failed internally.' });
                }

                try {
                    const result = JSON.parse(scriptOutput.trim());
                    if (result.success) {
                        return res.status(200).json({ success: true, message: 'Template updated successfully.' });
                    } else {
                        return res.status(500).json({ success: false, message: 'Drive Error: ' + result.error });
                    }
                } catch (e) {
                    return res.status(500).json({ success: false, message: 'Invalid response from update service.' });
                }
            });

        } catch (error) {
            console.error('Update template error:', error);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    }
};

module.exports = sheetController;
