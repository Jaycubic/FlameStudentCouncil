-- SQL Script to create the student_data table in PostgreSQL
-- Ensure the 'app' schema exists
CREATE SCHEMA IF NOT EXISTS app;

-- Create the student_data table
CREATE TABLE IF NOT EXISTS app.student_data (
    id SERIAL PRIMARY KEY,
    rc_name VARCHAR(255),
    batch VARCHAR(255),
    student_name VARCHAR(255),
    photo VARCHAR(255),
    status VARCHAR(255),
    student_status VARCHAR(255),
    with_drawn_date TIMESTAMP WITH TIME ZONE,
    with_drawn_reason VARCHAR(255),
    with_drawn_comment TEXT,
    gender VARCHAR(50),
    no_of_days FLOAT,
    dob DATE,
    email_id VARCHAR(255),
    contact_no DOUBLE PRECISION,
    home_town VARCHAR(255),
    house VARCHAR(255),
    housing_block VARCHAR(255),
    father_name VARCHAR(255),
    father_email_id VARCHAR(255),
    father_mobile_no DOUBLE PRECISION,
    mother_name VARCHAR(255),
    mother_email_id VARCHAR(255),
    mother_mobile_no DOUBLE PRECISION,
    student_cvue_no INTEGER,
    inout VARCHAR(50),
    device_name VARCHAR(255),
    last_punch_date TIMESTAMP WITH TIME ZONE,
    device_id DOUBLE PRECISION,
    reported SMALLINT DEFAULT 0,
    accompany_with INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_student_data_email_id ON app.student_data(email_id);
CREATE INDEX IF NOT EXISTS idx_student_data_batch ON app.student_data(batch);
