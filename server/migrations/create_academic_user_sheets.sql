-- Fixed: removed duplicate PRIMARY KEY constraint
CREATE TABLE IF NOT EXISTS app.academic_user_sheets (
    id              SERIAL       PRIMARY KEY,
    email           VARCHAR(255) NOT NULL,
    user_sheet_id   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMPTZ  DEFAULT CURRENT_TIMESTAMP,
    student_permission_id VARCHAR(255),
    CONSTRAINT unique_academic_email UNIQUE (email)
);

ALTER TABLE IF EXISTS app.academic_user_sheets OWNER TO jofrey;

SELECT 'academic_user_sheets table ready' AS status;
