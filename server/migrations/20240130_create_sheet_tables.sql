-- Migration to create tables for tracking user spreadsheets
-- Table: app.cultural_user_sheets
CREATE TABLE IF NOT EXISTS app.cultural_user_sheets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    user_sheet_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_cultural_email UNIQUE (email)
);

-- Table: app.sports_user_sheets
CREATE TABLE IF NOT EXISTS app.sports_user_sheets (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    user_sheet_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_sports_email UNIQUE (email)
);
