-- ============================================================
-- Migration: create app.student_cgpa_cache
-- Database  : FlameAwards (main system DB — NOT academicplanning)
-- Run once  : psql -U <user> -d <flameawards_db> -f this_file.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS app.student_cgpa_cache (
    id              SERIAL PRIMARY KEY,
    student_id      TEXT        NOT NULL,
    email           TEXT        NOT NULL,
    cgpa            NUMERIC(4,2),           -- latest cumulative GPA (null = not found)
    my_term         INTEGER,                -- the my_term from which cgpa was extracted
    batch           TEXT,                   -- class_year value at fetch time
    program_type    TEXT,                   -- 'UG' | 'PG'
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one cache row per student_id + email
ALTER TABLE app.student_cgpa_cache
    DROP CONSTRAINT IF EXISTS uq_cgpa_cache_student_id;
ALTER TABLE app.student_cgpa_cache
    ADD CONSTRAINT uq_cgpa_cache_student_id UNIQUE (student_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_cgpa_cache_email      ON app.student_cgpa_cache (email);
CREATE INDEX IF NOT EXISTS idx_cgpa_cache_student_id ON app.student_cgpa_cache (student_id);
CREATE INDEX IF NOT EXISTS idx_cgpa_cache_batch       ON app.student_cgpa_cache (batch);

COMMENT ON TABLE app.student_cgpa_cache IS
    'Pre-fetched latest CGPA values for students who log in to the FlameAwards system. '
    'Populated/refreshed in the background on each form load. '
    'UG/BDES data sourced from app.degreeprogressaudit; '
    'PG/MSC/PGPEI/PGC data sourced from app.pg_degree_progress_audit (academicplanning DB).';
