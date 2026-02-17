const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('LECTURER'));

const QR_TTL_SECONDS = 60;
const frontendUrl = () => process.env.FRONTEND_URL || 'https://matty-fyp.onrender.com';

function generateQrToken() {
  return 'att_' + crypto.randomBytes(16).toString('hex') + '_' + Math.floor(Date.now() / 1000);
}

router.get('/lectures', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.title, l.lecture_date, l.start_time, l.end_time, l.location, l.status, l.module_id,
              m.code AS module_code, m.name AS module_name
       FROM lectures l LEFT JOIN modules m ON l.module_id = m.id
       WHERE l.lecturer_id = $1 ORDER BY l.lecture_date, l.start_time`,
      [req.user.id]
    );
    res.json({ lectures: result.rows });
  } catch (err) {
    console.error('Lecturer lectures list:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.post('/lectures', async (req, res) => {
  try {
    const { module_id, title, lecture_date, start_time, end_time, location, repeat_weeks } = req.body;
    if (!title || !lecture_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'title, lecture_date, start_time, end_time required' });
    }
    const weeks = Math.min(Math.max(parseInt(repeat_weeks, 10) || 1, 1), 52);
    const created = [];
    for (let w = 0; w < weeks; w++) {
      const d = new Date(lecture_date);
      d.setDate(d.getDate() + w * 7);
      const dateStr = d.toISOString().slice(0, 10);
      const ins = await pool.query(
        `INSERT INTO lectures (lecturer_id, module_id, title, lecture_date, start_time, end_time, location)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, title, lecture_date, start_time, end_time, location, status`,
        [req.user.id, module_id || null, title, dateStr, start_time, end_time, location || null]
      );
      created.push(ins.rows[0]);
    }
    res.status(201).json(weeks === 1 ? created[0] : { created: created.length, lectures: created });
  } catch (err) {
    console.error('Create lecture(s):', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/lectures/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT l.id, l.title, l.lecture_date, l.start_time, l.end_time, l.location, l.status, l.module_id,
              m.code AS module_code, m.name AS module_name
       FROM lectures l LEFT JOIN modules m ON l.module_id = m.id
       WHERE l.id = $1 AND l.lecturer_id = $2`,
      [req.params.id, req.user.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('Get lecture:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.post('/lectures/:id/qr/generate', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('SELECT id FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    await pool.query("UPDATE qr_sessions SET is_active = false WHERE lecture_id = $1", [lectureId]);
    const token = generateQrToken();
    const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);
    await pool.query(
      'INSERT INTO qr_sessions (lecture_id, qr_token, expires_at) VALUES ($1, $2, $3)',
      [lectureId, token, expiresAt]
    );
    const qrUrl = `${frontendUrl()}/student-checkin.html?token=${token}`;
    const qrCode = await QRCode.toDataURL(qrUrl, { width: 400 });
    res.json({
      qr_code: qrCode,
      qr_token: token,
      qr_url: qrUrl,
      expires_at: expiresAt.toISOString(),
      expires_in_seconds: QR_TTL_SECONDS,
    });
  } catch (err) {
    console.error('QR generate:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/lectures/:id/qr/current', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('SELECT id FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const q = await pool.query(
      'SELECT qr_token, expires_at FROM qr_sessions WHERE lecture_id = $1 AND is_active = true AND expires_at > CURRENT_TIMESTAMP ORDER BY created_at DESC LIMIT 1',
      [lectureId]
    );
    if (q.rows.length === 0) {
      return res.status(404).json({ error: 'No active QR code found for this lecture' });
    }
    const row = q.rows[0];
    const expiresAt = new Date(row.expires_at);
    const secondsLeft = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const qrUrl = `${frontendUrl()}/student-checkin.html?token=${row.qr_token}`;
    const qrCode = await QRCode.toDataURL(qrUrl, { width: 400 });
    res.json({
      qr_code: qrCode,
      qr_token: row.qr_token,
      expires_at: expiresAt.toISOString(),
      expires_in_seconds: secondsLeft,
      is_active: true,
    });
  } catch (err) {
    console.error('QR current:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/lectures/:id/attendance', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('SELECT id, title, lecture_date, start_time, end_time FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const lecture = r.rows[0];
    const att = await pool.query(
      `SELECT a.id, a.checked_in_at, a.status, a.minutes_late, u.student_id, u.first_name, u.last_name
       FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.lecture_id = $1 ORDER BY a.checked_in_at`,
      [lectureId]
    );
    res.json({
      lecture: { id: lecture.id, title: lecture.title, lecture_date: lecture.lecture_date, start_time: lecture.start_time, end_time: lecture.end_time },
      attendance: att.rows.map((a) => ({
        id: a.id,
        student_id: a.student_id,
        first_name: a.first_name,
        last_name: a.last_name,
        checked_in_at: a.checked_in_at,
        status: a.status,
        minutes_late: a.minutes_late,
      })),
    });
  } catch (err) {
    console.error('Attendance list:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
