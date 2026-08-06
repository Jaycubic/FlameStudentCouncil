-- ============================================================
-- FLAME Student Council — Migration Script
-- Drop 3 award tables → Create ElectionFormResponse + supporting tables
-- RUN THIS ON YOUR SERVER: psql -U <user> -d <dbname> -f this_file.sql
-- ============================================================

BEGIN;

-- 1. Drop old award tables
DROP TABLE IF EXISTS app.cultural_person_awards CASCADE;
DROP TABLE IF EXISTS app.sports_person_awards CASCADE;
DROP TABLE IF EXISTS app.trailblazer_awards CASCADE;

-- 2. Convert sheet_pool 'type' column to VARCHAR(50) and remove old non-workbook sheets
ALTER TABLE app.sheet_pool ALTER COLUMN type TYPE VARCHAR(50);
DELETE FROM app.sheet_pool WHERE type != 'workbook';

-- 2. Create ElectionFormResponse (mirrors TrailblazerAward + new columns)
CREATE TABLE IF NOT EXISTS app.election_form_responses (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(255) NOT NULL,
    student_id              CHAR(10) NOT NULL,
    mobile_number           VARCHAR(20) NOT NULL,
    gender                  VARCHAR(50) NOT NULL,
    batch                   VARCHAR(100),
    email                   VARCHAR(255) NOT NULL,
    position_selected       VARCHAR(255) NOT NULL,
    community_service       TEXT NOT NULL,
    statement_of_purpose    TEXT NOT NULL,
    more_info               TEXT,
    read_handbook           BOOLEAN NOT NULL DEFAULT FALSE,
    sports_score            VARCHAR(255),
    academic_score          DECIMAL(6,2),
    cultural_score          VARCHAR(255),
    not_on_probation        BOOLEAN,
    tru_statement           BOOLEAN,
    submission_date         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status                  VARCHAR(50) NOT NULL DEFAULT 'Submitted',
    photo                   VARCHAR(255),
    sports_verified_score   VARCHAR(255),
    cultural_verified_score VARCHAR(255),
    academic_verified_score VARCHAR(255),
    total_verified_score    DECIMAL(6,2),
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create ElectionDraft (autosave for Position, SOP, Community Service, More Info)
CREATE TABLE IF NOT EXISTS app.election_drafts (
    id                      SERIAL PRIMARY KEY,
    email                   VARCHAR(255) NOT NULL UNIQUE,
    position_selected       VARCHAR(255),
    community_service       TEXT,
    statement_of_purpose    TEXT,
    more_info               TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Alter tables if already existing
ALTER TABLE app.election_form_responses ADD COLUMN IF NOT EXISTS more_info TEXT;
ALTER TABLE app.election_drafts ADD COLUMN IF NOT EXISTS more_info TEXT;

-- 4. Create ElectionAttachment (single generic attachment table)
CREATE TABLE IF NOT EXISTS app.election_attachments (
    id                      SERIAL PRIMARY KEY,
    submission_id           INTEGER NOT NULL REFERENCES app.election_form_responses(id) ON DELETE CASCADE,
    file_name               VARCHAR(500) NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
