-- Add verification question/answer to lectures (case-insensitive check on answer)
-- Run this on existing databases. New installs can use DATABASE_SCHEMA.sql with columns included.

ALTER TABLE lectures
  ADD COLUMN IF NOT EXISTS verification_question TEXT,
  ADD COLUMN IF NOT EXISTS verification_answer TEXT;

COMMENT ON COLUMN lectures.verification_question IS 'Optional question shown to students at check-in';
COMMENT ON COLUMN lectures.verification_answer IS 'Expected answer (compared case-insensitive); required for check-in when set';
