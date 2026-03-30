-- Create the AwardsWorkbook table (single-row, stores the master workbook Google Sheet ID)
CREATE TABLE IF NOT EXISTS awards_workbooks (
    id           SERIAL       PRIMARY KEY,
    workbook_id  VARCHAR(200) NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for fast single-row lookup
CREATE UNIQUE INDEX IF NOT EXISTS awards_workbooks_singleton
    ON awards_workbooks ((TRUE));   -- ensures only one row ever exists

SELECT 'awards_workbooks table ready' AS status;
