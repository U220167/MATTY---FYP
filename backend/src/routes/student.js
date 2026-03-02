const express = require('express');
const { pool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

const LATE_THRESHOLD_MINUTES = 5;

/** GET check-in info by token: returns lecture title and verification question (no answer). Requires student auth. */
router.get('/attendance/checkin-info', authenticate, requireRole('STUDENT'), async (req, res) => {
  try {
    const token = req.query.token;
    if (!token) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'token required' });
    }
    const session = await pool.query(
      'SELECT lecture_id, expires_at FROM qr_sessions WHERE qr_token = $1 AND is_active = true',
      [token]
    );
    if (session.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'QR_TOKEN_EXPIRED', message: 'The QR code has expired or is invalid.' });
    }
    const row = session.rows[0];
    if (new Date(row.expires_at) < new Date()) {
      return res.status(400).json({ success: false, error: 'QR_TOKEN_EXPIRED', message: 'The QR code has expired.' });
    }
    const lecture = await pool.query(
      'SELECT id, title, verification_question FROM lectures WHERE id = $1',
      [row.lecture_id]
    );
    if (lecture.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'LECTURE_NOT_FOUND', message: 'Invalid QR code or lecture not found.' });
    }
    const lec = lecture.rows[0];
    res.json({
      lecture_title: lec.title,
      verification_question: lec.verification_question || null,
    });
  } catch (err) {
    console.error('Check-in info:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Failed to load check-in info' });
  }
});

router.post('/attendance/checkin', authenticate, requireRole('STUDENT'), async (req, res) => {
  try {
    const { qr_token, answer } = req.body;
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
      'SELECT id, title, lecture_date, start_time, end_time, verification_question, verification_answer FROM lectures WHERE id = $1',
      [row.lecture_id]
    );
    if (lecture.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'LECTURE_NOT_FOUND', message: 'Invalid QR code or lecture not found.' });
    }
    const lec = lecture.rows[0];
    if (lec.verification_answer != null && String(lec.verification_answer).trim() !== '') {
      const expected = String(lec.verification_answer).trim().toLowerCase();
      const given = (answer != null ? String(answer).trim() : '').toLowerCase();
      if (given !== expected) {
        return res.status(400).json({ success: false, error: 'VERIFICATION_FAILED', message: 'Incorrect answer. Please try again.' });
      }
    }
    const existing = await pool.query(
      'SELECT id FROM attendance WHERE student_id = $1 AND lecture_id = $2',
      [req.user.id, row.lecture_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'ALREADY_CHECKED_IN', message: 'You have already checked in for this lecture.' });
    }
    const now = new Date();
    const dateStr = typeof lec.lecture_date === 'string' ? lec.lecture_date : lec.lecture_date?.toISOString?.().slice(0, 10);
    const startTimeStr = typeof lec.start_time === 'string' ? lec.start_time : (lec.start_time && lec.start_time.length >= 8 ? lec.start_time : '00:00:00');
    const endTimeStr = typeof lec.end_time === 'string' ? lec.end_time : (lec.end_time && lec.end_time.length >= 8 ? lec.end_time : '23:59:59');
    const lectureStart = new Date(`${dateStr}T${startTimeStr}`);
    const lectureEnd = new Date(`${dateStr}T${endTimeStr}`);
    const minutesLateNum = (now - lectureStart) / 60000;
    const minutesLate = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, Math.floor(Number.isFinite(minutesLateNum) ? minutesLateNum : 0)));
    let status = 'PRESENT';
    if (now > lectureEnd) {
      status = 'ABSENT';
    } else if (minutesLate >= LATE_THRESHOLD_MINUTES) {
      status = 'LATE';
    }
    await pool.query(
      `INSERT INTO attendance (student_id, lecture_id, qr_token, checked_in_at, status, minutes_late)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.user.id, row.lecture_id, qr_token, now.toISOString(), status, minutesLate]
    );
    const userRow = await pool.query('SELECT student_id FROM users WHERE id = $1', [req.user.id]);
    const message = status === 'PRESENT' ? 'Attendance recorded successfully'
      : status === 'LATE' ? 'Attendance recorded, but you checked in late.'
      : 'Attendance recorded as absent (you checked in after the lecture ended).';
    res.json({
      success: true,
      message,
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
