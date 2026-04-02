-- Fix: academic_attachments FK was pointing to form_submissions (wrong).
-- It must reference trailblazer_awards, consistent with sport_attachments
-- and cultural_attachments which also reference their respective award tables.

ALTER TABLE app.academic_attachments
    DROP CONSTRAINT IF EXISTS academic_attachments_submission_id_fkey;

ALTER TABLE app.academic_attachments
    ADD CONSTRAINT academic_attachments_submission_id_fkey
    FOREIGN KEY (submission_id)
    REFERENCES app.trailblazer_awards (id)
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

SELECT 'academic_attachments FK fixed -> trailblazer_awards' AS status;
