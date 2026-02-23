const express = require('express');
const { pool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const LATE_THRESHOLD_MINUTES = 5;

router.post('/attendance/checkin', authenticate, requireRole('STUDENT'), async (req, res) => {
  try {
    const { qr_token } = req.body;
    if (!qr_token) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'qr_token required' });
    }
    const session = await pool.query(
      'SELECT id, lecture_id, expires_at FROM qr_sessions WHERE qr_token = $1 AND is_active = true',
      [qr_token]
    );
    if (session.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'QR_TOKEN_EXPIRED', message: 'The QR code has expired or is invalid.' });
    }
    const row = session.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'QR_TOKEN_EXPIRED', message: 'The QR code has expired. Please ask your lecturer for a new one.' });
    }
    const lecture = await pool.query(
      'SELECT id, title, lecture_date, start_time FROM lectures WHERE id = $1',
      [row.lecture_id]
    );
    if (lecture.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'LECTURE_NOT_FOUND', message: 'Invalid QR code or lecture not found.' });
    }
    const existing = await pool.query(
      'SELECT id FROM attendance WHERE student_id = $1 AND lecture_id = $2',
      [req.user.id, row.lecture_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'ALREADY_CHECKED_IN', message: 'You have already checked in for this lecture.' });
    }
    const now = new Date();
    const lec = lecture.rows[0];
    const dateStr = typeof lec.lecture_date === 'string' ? lec.lecture_date : lec.lecture_date?.toISOString?.().slice(0, 10);
    const timeStr = typeof lec.start_time === 'string' ? lec.start_time : (lec.start_time && lec.start_time.length >= 8 ? lec.start_time : '00:00:00');
    const lectureStart = new Date(`${dateStr}T${timeStr}`);
    const minutesLateNum = (now - lectureStart) / 60000;
    const minutesLate = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number.isFinite(minutesLateNum) ? minutesLateNum : 0)));
    let status = 'PRESENT';
    if (minutesLate >= LATE_THRESHOLD_MINUTES) status = 'LATE';
    await pool.query(
      `INSERT INTO attendance (student_id, lecture_id, qr_token, checked_in_at, status, minutes_late)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, row.lecture_id, qr_token, now.toISOString(), status, minutesLate]
    );
    const userRow = await pool.query('SELECT student_id FROM users WHERE id = $1', [req.user.id]);
    res.json({
      success: true,
      message: status === 'PRESENT' ? 'Attendance recorded successfully' : 'Attendance recorded, but you checked in late.',
      attendance: {
        lecture: { id: lecture.rows[0].id, title: lecture.rows[0].title, lecture_date: lecture.rows[0].lecture_date, start_time: lecture.rows[0].start_time },
        checked_in_at: now,
        status,
        minutes_late: minutesLate,
        student_id: userRow.rows[0]?.student_id,
      },
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Check-in failed' });
  }
});

module.exports = router;
