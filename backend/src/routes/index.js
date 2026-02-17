const express = require('express');
const auth = require('./auth');
const lecturer = require('./lecturer');
const student = require('./student');

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));

router.use('/auth', auth);
router.use('/lecturer', lecturer);
router.use('/student', student);

module.exports = router;
