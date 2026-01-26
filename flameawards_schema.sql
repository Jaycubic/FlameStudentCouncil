-- flameawards_schema.sql
-- PostgreSQL Schema Migration for FlameAwards (Hybrid Architecture)

-- Create the dedicated application schema
CREATE SCHEMA IF NOT EXISTS app;

-- 1. Organizations
CREATE TABLE IF NOT EXISTS app.organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website_link VARCHAR(255),
    contact_person_name VARCHAR(255) NOT NULL,
    contact_person_mobile VARCHAR(50) NOT NULL,
    person_email VARCHAR(255),
    gst_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Locations
CREATE TABLE IF NOT EXISTS app.locations (
    id SERIAL PRIMARY KEY,
    location_name VARCHAR(255) NOT NULL UNIQUE,
    organization_name VARCHAR(255) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Departments
CREATE TABLE IF NOT EXISTS app.departments (
    id SERIAL PRIMARY KEY,
    department_name VARCHAR(255) NOT NULL UNIQUE,
    location_name VARCHAR(255) NOT NULL,
    hod_name VARCHAR(255),
    hod_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Roles
CREATE TABLE IF NOT EXISTS app.roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Users
CREATE TABLE IF NOT EXISTS app.users (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    employee_name VARCHAR(255),
    user_type VARCHAR(50),
    email VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(255),
    password TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    role_id INTEGER REFERENCES app.roles(id),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    two_fa_secret TEXT,
    two_fa_setup BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token TEXT,
    token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Role Settings
CREATE TABLE IF NOT EXISTS app.role_settings (
    role_id INTEGER NOT NULL REFERENCES app.roles(id),
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT NOT NULL,
    PRIMARY KEY (role_id, setting_key)
);

-- 7. Settings (Global)
CREATE TABLE IF NOT EXISTS app.settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT NOT NULL
);

-- 8. Activity Tracker
CREATE TABLE IF NOT EXISTS app.activity_tracker (
    id SERIAL PRIMARY KEY,
    performed_by INTEGER REFERENCES app.users(id),
    activity_type VARCHAR(100) NOT NULL,
    details JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. User Notification Status
CREATE TABLE IF NOT EXISTS app.user_notification_status (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES app.users(id),
    activity_id INTEGER NOT NULL REFERENCES app.activity_tracker(id),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    is_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Student Logs
CREATE TABLE IF NOT EXISTS app.student_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(255),
    password TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    role_id INTEGER REFERENCES app.roles(id),
    access_token TEXT,
    refresh_token TEXT,
    expiry_date TIMESTAMP WITH TIME ZONE,
    two_fa_secret TEXT,
    two_fa_setup BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token TEXT,
    token_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Positions
CREATE TABLE IF NOT EXISTS app.positions (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    max_score INTEGER NOT NULL,
    priority INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Form Submissions
CREATE TABLE IF NOT EXISTS app.form_submissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    student_id CHAR(10) NOT NULL,
    mobile_number VARCHAR(20) NOT NULL,
    position VARCHAR(255) NOT NULL,
    cgpa DECIMAL(4, 2) NOT NULL,
    cgpa_verification VARCHAR(255) NOT NULL,
    sports_score VARCHAR(255) NOT NULL,
    cultural_score VARCHAR(255) NOT NULL,
    community_service TEXT NOT NULL,
    statement_of_purpose TEXT NOT NULL,
    not_on_probation BOOLEAN NOT NULL,
    read_handbook BOOLEAN NOT NULL,
    tru_statement BOOLEAN NOT NULL,
    email VARCHAR(255) NOT NULL,
    submission_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'pending',
    ramzi_score DECIMAL(10, 2),
    farrokh_score DECIMAL(10, 2),
    gender VARCHAR(20),
    batch VARCHAR(50),
    photo VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Academic Attachments
CREATE TABLE IF NOT EXISTS app.academic_attachments (
    id SERIAL PRIMARY KEY,
    submission_id INTEGER NOT NULL REFERENCES app.form_submissions(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL
);

-- 14. Wellbeing Declarations
CREATE TABLE IF NOT EXISTS app.wellbeing_declarations (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(50) NOT NULL UNIQUE,
    student_id VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    program VARCHAR(100) NOT NULL,
    psychological_concerns_yes BOOLEAN DEFAULT FALSE,
    psychological_concerns_no BOOLEAN DEFAULT FALSE,
    consulted_psychotherapist_yes BOOLEAN DEFAULT FALSE,
    consulted_psychotherapist_no BOOLEAN DEFAULT FALSE,
    current_treatment_yes BOOLEAN DEFAULT FALSE,
    current_treatment_no BOOLEAN DEFAULT FALSE,
    wants_counselling_services_yes BOOLEAN DEFAULT FALSE,
    wants_counselling_services_no BOOLEAN DEFAULT FALSE,
    learning_challenges_yes BOOLEAN DEFAULT FALSE,
    learning_challenges_no BOOLEAN DEFAULT FALSE,
    parent_name VARCHAR(255) NOT NULL,
    parent_contact VARCHAR(50) NOT NULL,
    parent_email VARCHAR(255) NOT NULL,
    signature TEXT NOT NULL,
    student_signature TEXT,
    consent_form BOOLEAN DEFAULT FALSE,
    supporting_documents TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Counters
CREATE TABLE IF NOT EXISTS app.counters (
    id SERIAL PRIMARY KEY,
    counter_name VARCHAR(255) NOT NULL,
    department_name VARCHAR(255) NOT NULL REFERENCES app.departments(department_name),
    UNIQUE (counter_name, department_name)
);

-- 16. Queue
CREATE TABLE IF NOT EXISTS app.queue (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    department VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    counter_id INTEGER REFERENCES app.counters(id),
    device_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'WAIT',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Legal Documents
CREATE TABLE IF NOT EXISTS app.legal_documents (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Footer
CREATE TABLE IF NOT EXISTS app.footer (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    signature TEXT NOT NULL
);

-- 19. Room Keys
CREATE TABLE IF NOT EXISTS app.room_keys (
    id SERIAL PRIMARY KEY,
    student_id VARCHAR(255) NOT NULL,
    student_name VARCHAR(255) NOT NULL,
    rc_name VARCHAR(255) NOT NULL,
    housing_block VARCHAR(255) NOT NULL,
    issued TIMESTAMP WITH TIME ZONE,
    returned TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_role_id ON app.users(role_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_student_id ON app.form_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_queue_status ON app.queue(status);

-- Initial Data Seeds
INSERT INTO app.roles (id, name, description, permissions, created_at, updated_at)
VALUES (1, 'admin', 'Administrator role', '{"roles": true, "users": true, "settings": true, "dashboard": true}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO app.users (id, user_id, username, email, department, password, is_active, role_id, created_at, updated_at)
VALUES (1, 11111, 'Jofrey Joseph', 'jofreyjohnmrutu01@gmail.com', 'IT', '$2b$10$dAW5XFQ3hVIevAxND5QaheMj/44jfUGnk1wwBp3QQnBjD3dyRsUx2', TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- Reset sequences to account for manual ID insertion
SELECT setval('app.roles_id_seq', COALESCE((SELECT MAX(id) FROM app.roles), 1));
SELECT setval('app.users_id_seq', COALESCE((SELECT MAX(id) FROM app.users), 1));
