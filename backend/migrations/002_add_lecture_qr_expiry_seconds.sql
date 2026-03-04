-- Add QR expiry seconds to lectures (per-lecture config for QR code duration)
-- Run this on existing databases. New installs can add to DATABASE_SCHEMA.sql.

ALTER TABLE lectures
  ADD COLUMN IF NOT EXISTS qr_expiry_seconds INTEGER DEFAULT 30;

COMMENT ON COLUMN lectures.qr_expiry_seconds IS 'Seconds until QR code expires (15-120); default 30';
