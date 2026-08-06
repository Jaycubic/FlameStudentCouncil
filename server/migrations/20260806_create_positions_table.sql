-- server/migrations/20260806_create_positions_table.sql
-- Create Positions table under app schema and seed initial positions

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app."Positions" (
    id SERIAL PRIMARY KEY,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app."Positions" (description) VALUES
('FLAME University Vice Captain (PG)- PG2 Batch'),
('FLAME University Vice Captain (UG) - UG4, UG3 Batch'),
('House Captain Aryabhatta (PG2, UG4, UG3 Batch) - House Colour Blue'),
('House Captain Chanakya (PG2, UG4, UG3 Batch) - House Colour Green'),
('House Captain Kalidas (PG2, UG4, UG3 Batch) - House Colour Red'),
('House Captain Vivekananda (PG2, UG4, UG3 Batch) - House Colour Yellow'),
('Batch Captain PG B 1'),
('Batch Captain PGB 2'),
('Batch Captain PG C 1'),
('Batch Captain PGC 2'),
('Batch Captain PGPEI'),
('Batch Captain MSC1'),
('Batch Captain UG 4'),
('Batch Captain UG 3'),
('Batch Captain UG 2'),
('Batch Captain UG 1'),
('Batch Captain B.Des 4'),
('Batch Captain B.Des 3'),
('Batch Captain B.Des 2'),
('Batch Captain B.Des 1'),
('Secretary, Sports Committee (PG2, UG4, UG3 Batch)'),
('Joint Secretary, Sports Committee (other Batch)'),
('Secretary, Student Welfare (PG2, UG4, UG3 Batch)'),
('Joint Secretary, Student Welfare Committee (other Batch)'),
('Secretary, Cultural Committee (PG2, UG4, UG3 Batch)'),
('Joint Secretary, Cultural Committee (other Batch)')
ON CONFLICT DO NOTHING;
