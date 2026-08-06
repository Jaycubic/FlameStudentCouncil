// server/controllers/electionDraftController.js
//
// Autosave controller for election form drafts.
// Students can save their in-progress position selection, SOP, and
// community service text so they don't lose work on page refresh.
//
// Used by both HTTP (fallback) and Socket.IO (primary autosave channel).

const { ElectionDraft } = require('../models');
const log = require('../utils/logger').child({ module: 'ElectionDraftController' });

const electionDraftController = {

    /**
     * POST /api/election-draft
     * Upsert a draft by the authenticated user's email.
     */
    async saveDraft(req, res) {
        try {
            const email = req.user.email;
            const { position_selected, community_service, statement_of_purpose } = req.body;

            const [draft, created] = await ElectionDraft.upsert(
                {
                    email,
                    position_selected:    position_selected    ?? null,
                    community_service:    community_service    ?? null,
                    statement_of_purpose: statement_of_purpose ?? null,
                },
                { returning: true }
            );

            return res.json({
                success: true,
                message: created ? 'Draft created' : 'Draft updated',
            });
        } catch (err) {
            log.error({ err: err.message }, '[Draft] saveDraft error');
            return res.status(500).json({ success: false, message: err.message });
        }
    },

    /**
     * GET /api/election-draft
     * Returns the current user's saved draft (if any).
     */
    async getDraft(req, res) {
        try {
            const email = req.user.email;
            const draft = await ElectionDraft.findOne({
                where: { email },
                attributes: ['position_selected', 'community_service', 'statement_of_purpose', 'updated_at'],
            });

            if (!draft) {
                return res.json({ success: true, draft: null });
            }

            return res.json({ success: true, draft });
        } catch (err) {
            log.error({ err: err.message }, '[Draft] getDraft error');
            return res.status(500).json({ success: false, message: err.message });
        }
    },
};

module.exports = electionDraftController;
