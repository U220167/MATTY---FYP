const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const JWT_OPTIONS = { expiresIn: process.env.JWT_EXPIRES_IN || '15m' };
const SALT_ROUNDS = 10;

router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, role, student_id, department_id } = req.body;
    if (!email || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Missing required fields' });
    }
    if (!['LECTURER', 'STUDENT', 'ADMIN'].includes(role)) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Invalid role' });
    }
    if (role === 'STUDENT' && !student_id) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Students must provide student_id' });
    }
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, student_id, department_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, first_name, last_name, role, student_id`,
      [email, password_hash, first_name, last_name, role, role === 'STUDENT' ? student_id : null, department_id || null]
    );
    const user = result.rows[0];
    res.status(201).json({ message: 'User registered successfully', user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name } });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ success: false, error: 'EMAIL_EXISTS', message: 'Email already registered' });
    }
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Email and password required' });
    }
    const userResult = await pool.query(
      'SELECT id, email, password_hash, first_name, last_name, role, student_id FROM users WHERE email = $1 AND is_active = true',
      [email]
    );
    const user = userResult.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ success: false, error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, JWT_OPTIONS);
    const refreshToken = jwt.sign({ id: user.id }, process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET, { expiresIn: '7d' });
    await pool.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'7 days\')', [user.id, refreshToken]);
    res.json({
      token,
      refresh_token: refreshToken,
      user: { id: user.id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name, student_id: user.student_id },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR', message: 'Login failed' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'refresh_token required' });
    const rt = await pool.query('SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP', [refresh_token]);
    if (rt.rows.length === 0) return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Invalid or expired refresh token' });
    const userResult = await pool.query('SELECT id, email, role FROM users WHERE id = $1 AND is_active = true', [rt.rows[0].user_id]);
    if (userResult.rows.length === 0) return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    const user = userResult.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, JWT_OPTIONS);
    res.json({ token });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.student_id, d.id AS department_id, d.name AS department_name, d.code AS department_code
       FROM users u LEFT JOIN departments d ON u.department_id = d.id WHERE u.id = $1`,
      [req.user.id]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const user = {
      id: row.id,
      email: row.email,
      role: row.role,
      first_name: row.first_name,
      last_name: row.last_name,
      student_id: row.student_id,
      department: row.department_id ? { id: row.department_id, name: row.department_name, code: row.department_code } : null,
    };
    res.json(user);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, error: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;
