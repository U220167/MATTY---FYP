/**
 * Run pending migrations on startup. Safe to run every time (uses IF NOT EXISTS where applicable).
 */
const { pool } = require('./config/database');

async function runMigrations() {
  try {
    await pool.query(`
      ALTER TABLE lectures
        ADD COLUMN IF NOT EXISTS verification_question TEXT,
        ADD COLUMN IF NOT EXISTS verification_answer TEXT;
    `);
    await pool.query(`
      ALTER TABLE lectures
        ADD COLUMN IF NOT EXISTS qr_expiry_seconds INTEGER DEFAULT 30;
    `);
    console.log('Migrations OK');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

module.exports = { runMigrations };
