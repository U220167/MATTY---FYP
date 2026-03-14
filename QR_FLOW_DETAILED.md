# QR Code Flow

How QR codes are generated, shown to students, and used for check-in.

---

## Token format

Tokens look like: `att_<32 hex chars>_<unix timestamp>`

Example: `att_a1b2c3d4e5f6789012345678901234ab_1705315200`

Generated on the backend with `crypto.randomBytes(16).toString('hex')` plus a Unix timestamp. The timestamp is not used for expiry; the server stores `expires_at` in the database.

---

## Backend: QR session lifecycle

### Generate

`POST /lecturer/lectures/:id/qr/generate`

1. Load the lecture and its `qr_expiry_seconds` (default 30, clamped 15–120).
2. Set `is_active = false` for any existing QR sessions for that lecture.
3. Insert a new row in `qr_sessions` with `qr_token`, `expires_at = now + ttl`.
4. Build the check-in URL: `{FRONTEND_URL}/student-checkin.html?token={qr_token}`.
5. Encode that URL as a QR image (base64 PNG) with the `qrcode` library.
6. Return `qr_code`, `qr_token`, `qr_url`, `expires_at`, `expires_in_seconds`.

`FRONTEND_URL` comes from `process.env.FRONTEND_URL` or `https://matty-fyp.onrender.com`.

### Stop

`POST /lecturer/lectures/:id/qr/stop`

Sets `is_active = false` for all active QR sessions for that lecture. No new token is created.

### Current

`GET /lecturer/lectures/:id/qr/current`

If there is an active, non-expired session, returns the QR image and token. Otherwise 404.

---

## Frontend: lecturer QR page

`lecture-qr.html` is opened with `?lectureId=42`. The page:

1. Calls `GET /lecturer/lectures/:id` for title, date, time, location.
2. Calls `POST /lecturer/lectures/:id/qr/generate` to get the initial QR.
3. Renders the image and token.
4. Starts a countdown from `expires_in_seconds` (from the API) so client/server clock skew doesn’t cause false expiry.
5. “Refresh” runs generate again, which deactivates the old session and creates a new one.
6. “Stop” calls `POST .../qr/stop`, clears the countdown, and dims the QR.

The QR image points at the check-in URL. Students who scan it land on `student-checkin.html?token=...`.

---

## Frontend: student check-in page

`student-checkin.html` can receive the token from the URL or from manual entry.

### Without token in URL

The page shows a manual token field. When the user enters a token and submits, the page treats it as the active token (and can update the URL with `history.pushState`).

### Flow when token is set

1. If not logged in: show email/password form. On success, store JWT and `student_id` in localStorage.
2. If logged in: call `GET /student/attendance/checkin-info?token={token}` to get `lecture_title` and `verification_question`.
3. Show check-in form. If the lecture has a verification question, show the question and a required text field.
4. On submit: `POST /student/attendance/checkin` with `{ qr_token, answer? }`. If there’s a verification question, `answer` is required.

---

## Backend: check-in validation

`POST /student/attendance/checkin`

1. **Token lookup**: Select from `qr_sessions` where `qr_token = ?` and `is_active = true`. If no row or `expires_at < now`, return `QR_TOKEN_EXPIRED`.
2. **Lecture**: Load lecture by `lecture_id`. If missing, return `LECTURE_NOT_FOUND`.
3. **Verification**: If the lecture has `verification_answer`, compare it case-insensitively to `answer`. Mismatch or missing answer when required → `VERIFICATION_FAILED`.
4. **Duplicate**: Check `attendance` for `(student_id, lecture_id)`. If exists → `ALREADY_CHECKED_IN`.
5. **Status**:
   - `lecture_end` = `lecture_date` + `end_time`
   - `lecture_start` = `lecture_date` + `start_time`
   - If `now > lecture_end` → `ABSENT`
   - Else if `minutes_late >= 5` → `LATE`
   - Else → `PRESENT`
   - `minutes_late` = floor((now - lecture_start) / 60000), clamped to 0
6. Insert into `attendance` with `student_id`, `lecture_id`, `qr_token`, `checked_in_at`, `status`, `minutes_late`.

---

## Status rules

| Condition | Status |
|-----------|--------|
| Check-in within 5 minutes of start | PRESENT |
| Check-in 5+ minutes after start, before end | LATE |
| Check-in after lecture end | ABSENT |

The 5-minute threshold is hardcoded as `LATE_THRESHOLD_MINUTES` in the student route.

---

## Error handling

Check-in can return:

- `QR_TOKEN_EXPIRED` – token invalid, expired, or session stopped
- `LECTURE_NOT_FOUND` – token OK but lecture missing (edge case)
- `ALREADY_CHECKED_IN` – student already has an attendance row for this lecture
- `VERIFICATION_FAILED` – verification question present and answer wrong or missing
- `VALIDATION_ERROR` – e.g. missing `qr_token`

The frontend maps these to user-facing messages.

---

## Database

`qr_sessions` stores: `lecture_id`, `qr_token`, `expires_at`, `is_active`. No Redis; all lookups hit PostgreSQL.

`attendance` has a unique constraint on `(student_id, lecture_id)` so each student can check in at most once per lecture.

---

## Local testing

When the frontend runs on `localhost`, phones cannot open `localhost` URLs from a scanned QR. The QR page shows instructions: use the machine’s IP (e.g. `http://192.168.1.100:3000/student-checkin.html?token=...`) or manually enter the token on the check-in page.
