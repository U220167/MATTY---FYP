const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { pool } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('LECTURER'));

const QR_TTL_DEFAULT = 30;
const QR_TTL_MIN = 15;
const QR_TTL_MAX = 120;
const frontendUrl = () => process.env.FRONTEND_URL || 'https://matty-fyp.onrender.com';

function parseQrExpiry(val) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return QR_TTL_DEFAULT;
  return Math.min(QR_TTL_MAX, Math.max(QR_TTL_MIN, n));
}

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
    const { module_id, module_code, module_name, title, lecture_date, start_time, end_time, location, repeat_weeks, verification_question, verification_answer, qr_expiry_seconds } = req.body;
    if (!title || !lecture_date || !start_time || !end_time) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'title, lecture_date, start_time, end_time required' });
    }
    const weeks = Math.min(Math.max(parseInt(repeat_weeks, 10) || 1, 1), 52);
    const q = (typeof verification_question === 'string' && verification_question.trim()) ? verification_question.trim() : null;
    const a = (typeof verification_answer === 'string' && verification_answer.trim()) ? verification_answer.trim() : null;
    const qrExpiry = parseQrExpiry(qr_expiry_seconds);

    let resolvedModuleId = module_id || null;
    if (!resolvedModuleId && module_code && typeof module_code === 'string' && module_code.trim()) {
      const code = module_code.trim().toUpperCase();
      const name = (module_name && typeof module_name === 'string' && module_name.trim()) ? module_name.trim() : code;
      const mod = await pool.query('SELECT id FROM modules WHERE code = $1', [code]);
      if (mod.rows.length > 0) {
        resolvedModuleId = mod.rows[0].id;
      } else {
        const ins = await pool.query('INSERT INTO modules (code, name) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name = $2 RETURNING id', [code, name]);
        resolvedModuleId = ins.rows[0].id;
      }
    }

    const created = [];
    for (let w = 0; w < weeks; w++) {
      const d = new Date(lecture_date);
      d.setDate(d.getDate() + w * 7);
      const dateStr = d.toISOString().slice(0, 10);
      const ins = await pool.query(
        `INSERT INTO lectures (lecturer_id, module_id, title, lecture_date, start_time, end_time, location, verification_question, verification_answer, qr_expiry_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, title, lecture_date, start_time, end_time, location, status, verification_question, verification_answer, qr_expiry_seconds`,
        [req.user.id, resolvedModuleId, title, dateStr, start_time, end_time, location || null, q, a, qrExpiry]
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
              l.verification_question, l.verification_answer, l.qr_expiry_seconds,
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

router.put('/lectures/:id', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const { title, lecture_date, start_time, end_time, location, verification_question, verification_answer, qr_expiry_seconds } = req.body;
    const r = await pool.query('SELECT id FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const updates = [];
    const values = [];
    let idx = 1;
    if (title !== undefined) { updates.push(`title = $${idx}`); values.push(title); idx++; }
    if (lecture_date !== undefined) { updates.push(`lecture_date = $${idx}`); values.push(lecture_date); idx++; }
    if (start_time !== undefined) { updates.push(`start_time = $${idx}`); values.push(start_time); idx++; }
    if (end_time !== undefined) { updates.push(`end_time = $${idx}`); values.push(end_time); idx++; }
    if (location !== undefined) { updates.push(`location = $${idx}`); values.push(location); idx++; }
    if (verification_question !== undefined) { updates.push(`verification_question = $${idx}`); values.push(verification_question && String(verification_question).trim() ? String(verification_question).trim() : null); idx++; }
    if (verification_answer !== undefined) { updates.push(`verification_answer = $${idx}`); values.push(verification_answer && String(verification_answer).trim() ? String(verification_answer).trim() : null); idx++; }
    if (qr_expiry_seconds !== undefined) { updates.push(`qr_expiry_seconds = $${idx}`); values.push(parseQrExpiry(qr_expiry_seconds)); idx++; }
    if (updates.length === 0) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No fields to update' });
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(lectureId, req.user.id);
    const q = await pool.query(
      `UPDATE lectures SET ${updates.join(', ')} WHERE id = $${idx} AND lecturer_id = $${idx + 1} RETURNING id, title, lecture_date, start_time, end_time, location, status, verification_question, verification_answer, qr_expiry_seconds`,
      values
    );
    if (q.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json(q.rows[0]);
  } catch (err) {
    console.error('Update lecture:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

// Permanently remove a lecture. DB cascade will clean up its QR sessions and attendance.
router.delete('/lectures/:id', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('DELETE FROM lectures WHERE id = $1 AND lecturer_id = $2 RETURNING id', [lectureId, req.user.id]);
    if (r.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Lecture not found' });
    }
    res.status(200).json({ success: true, message: 'Lecture deleted' });
  } catch (err) {
    console.error('Delete lecture:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.post('/lectures/:id/qr/generate', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('SELECT id, qr_expiry_seconds FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const ttl = parseQrExpiry(r.rows[0].qr_expiry_seconds);
    await pool.query("UPDATE qr_sessions SET is_active = false WHERE lecture_id = $1", [lectureId]);
    const token = generateQrToken();
    const expiresAt = new Date(Date.now() + ttl * 1000);
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
      expires_in_seconds: ttl,
    });
  } catch (err) {
    console.error('QR generate:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.post('/lectures/:id/qr/stop', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('SELECT id FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });

    const stopped = await pool.query(
      'UPDATE qr_sessions SET is_active = false WHERE lecture_id = $1 AND is_active = true RETURNING id',
      [lectureId]
    );

    res.json({
      success: true,
      message: stopped.rows.length > 0 ? 'Active QR session stopped' : 'No active QR session to stop',
      stopped_count: stopped.rows.length,
    });
  } catch (err) {
    console.error('QR stop:', err);
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

function escapeCsvField(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

router.get('/lectures/:id/attendance/csv', async (req, res) => {
  try {
    const lectureId = req.params.id;
    const r = await pool.query('SELECT id, title, lecture_date, start_time, end_time FROM lectures WHERE id = $1 AND lecturer_id = $2', [lectureId, req.user.id]);
    if (r.rows.length === 0) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const lecture = r.rows[0];
    const att = await pool.query(
      `SELECT a.checked_in_at, a.status, a.minutes_late, u.student_id, u.first_name, u.last_name
       FROM attendance a JOIN users u ON a.student_id = u.id WHERE a.lecture_id = $1 ORDER BY a.checked_in_at`,
      [lectureId]
    );
    const header = ['Student ID', 'First Name', 'Last Name', 'Checked In At', 'Status', 'Minutes Late'];
    const rows = att.rows.map((a) => [
      escapeCsvField(a.student_id),
      escapeCsvField(a.first_name),
      escapeCsvField(a.last_name),
      escapeCsvField(a.checked_in_at ? new Date(a.checked_in_at).toISOString() : ''),
      escapeCsvField(a.status || 'PRESENT'),
      escapeCsvField(a.minutes_late ?? ''),
    ]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
    const filename = `attendance-${lecture.title.replace(/[^a-zA-Z0-9-_]/g, '_')}-${lecture.lecture_date}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  } catch (err) {
    console.error('Attendance CSV export:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
