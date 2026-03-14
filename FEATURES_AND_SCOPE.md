# Maynooth Attendance Tool — Features and Scope

**Document for:** Examiner / Supervisor (Final Year Project)

The Maynooth Attendance Tool is a web application for lecturers to record student attendance using time-limited QR codes. Students check in by scanning the QR or entering the token manually. The system records attendance as PRESENT, LATE, or ABSENT based on lecture start/end times.

Live site: https://matty-fyp.onrender.com

On Render free tier, the first request after inactivity can take 30–60 seconds (cold start).

---

## Architecture

Frontend: static HTML, CSS, vanilla JavaScript. Backend: Node.js, Express, PostgreSQL. No Redis. JWT for auth. QR codes generated with the `qrcode` library.

```
Frontend (static)  →  HTTPS/REST  →  Backend (Express)  →  PostgreSQL
```

---

## Implemented features

### Authentication

- **Registration**: Email, password, first name, last name, role (LECTURER or STUDENT). Students must supply an 8-digit student ID. Passwords hashed with bcrypt.
- **Login**: Returns JWT access token and refresh token. Frontend validates role.
- **Token refresh**: POST `/auth/refresh` with refresh token returns a new access token. Refresh tokens stored in DB with expiry.
- **Current user**: GET `/auth/me` returns profile (id, email, role, name, student_id for students, department when set).

No password recovery, email verification, or SSO.

---

### Lecturer: lectures

- **List**: GET `/lecturer/lectures` returns all lectures for the lecturer, ordered by date and time. Includes module code/name.
- **Create**: POST `/lecturer/lectures`. Required: title, lecture_date, start_time, end_time. Optional: module_id or module_code, location, repeat_weeks (1–52), verification_question, verification_answer, qr_expiry_seconds (15–120, default 30). When repeat_weeks > 1, one lecture per week is created from the start date.
- **Get one**: GET `/lecturer/lectures/:id`.
- **Update**: PUT `/lecturer/lectures/:id`. Partial update; only sent fields change.
- **Delete**: DELETE `/lecturer/lectures/:id`. Cascade removes QR sessions and attendance.
- **Verification Q&A**: Optional question and answer per lecture. Answer compared case-insensitively at check-in. If set, students must answer correctly to submit.
- **Edit UI**: Edit button opens modal with form pre-filled from API. Submit sends PUT and refreshes list.

---

### Lecturer: dashboard and calendar

- **Month calendar**: Sun–Sat grid with previous/next month and Today button.
- **Day selection**: Clicking a day shows that day’s timetable. Days with lectures show a badge count.
- **Timetable**: For the selected day, lectures listed with time, title, module, location. Each row has Generate QR, View Attendance, Edit, Delete.
- **Statistics**: Summary cards for lectures on selected day and totals.

---

### Lecturer: QR codes

- **Generate**: POST `/lecturer/lectures/:id/qr/generate`. Deactivates any existing active session, creates new one. Returns QR image (base64), qr_token, expires_at, expires_in_seconds. Expiry uses lecture’s qr_expiry_seconds (default 30, range 15–120).
- **Stop**: POST `/lecturer/lectures/:id/qr/stop`. Deactivates active QR sessions.
- **Current**: GET `/lecturer/lectures/:id/qr/current`. Returns active QR if one exists and is not expired.
- **QR page**: lecture-qr.html shows QR image, token, countdown. Refresh generates new code; Stop deactivates on backend. View Attendance links to attendance list.
- **Check-in URL**: QR encodes `{FRONTEND_URL}/student-checkin.html?token={qr_token}`.

---

### Lecturer: attendance

- **Attendance list**: GET `/lecturer/lectures/:id/attendance`. Returns lecture plus rows with student_id, first_name, last_name, checked_in_at, status, minutes_late.
- **Attendance page**: attendance-list.html shows table with check-in time and status badges (PRESENT / LATE / ABSENT). Frontend computes present/late/absent counts.
- **CSV export**: GET `/lecturer/lectures/:id/attendance/csv` returns CSV with BOM for Excel. Columns: Student ID, First Name, Last Name, Checked In At, Status, Minutes Late.

---

### Student: check-in

- **Token**: From QR scan (opens check-in URL) or manual entry on check-in page.
- **Login**: Students log in with email and password before submitting. JWT sent with check-in requests.
- **Check-in info**: GET `/student/attendance/checkin-info?token=...` returns lecture_title and verification_question. Used to show the question when the lecture has one.
- **Verification**: If the lecture has a question, the form shows it and a required text field. Answer compared case-insensitively on the server.
- **Submit**: POST `/student/attendance/checkin` with qr_token and optional answer. Validates token, expiry, verification (if required), duplicate check-in. Inserts one attendance row per student per lecture.
- **Status rules**: PRESENT = check-in within 5 minutes of start. LATE = 5+ minutes after start but before lecture end. ABSENT = after lecture end.
- **Feedback**: Success shows check-in time and status. Errors: QR expired, already checked in, lecture not found, verification failed.

---

### Database

PostgreSQL: users, departments, modules, lectures, qr_sessions, attendance, attendance_analytics. Schema in DATABASE_SCHEMA.sql.

On startup, the backend runs migrations that add verification_question, verification_answer, and qr_expiry_seconds to lectures if missing. Manual migrations in `backend/migrations/` for reference.

---

## Not in scope

- Microsoft SSO or other external identity providers
- Email verification, forgot password, password reset
- Student dashboard (attendance history, module scores)
- Lecturer assignment of students to modules
- Rate limiting, analytics endpoints

---

## Known issues

- **Cold start**: Render free tier sleeps after inactivity. First request 30–60s.
- **Date display after create**: If API returns lecture_date in a different format than the calendar filter (YYYY-MM-DD), the new lecture may not show for the selected day until refresh.
- **Verification question**: If check-in info fails to load (e.g. network error), the question may not appear; submit without answer will fail. Retry or refresh.
- **Browser support**: Tested in Chrome, Firefox, Edge, Safari. Older browsers may have issues with ES modules.

---

## Other docs

- API_SPECIFICATION.md — endpoints and request/response formats
- QR_FLOW_DETAILED.md — QR token flow and check-in logic
- DATABASE_SCHEMA.sql — schema definition
- backend/migrations/README.md — migration files
