# API Specification

## Base URL

Production: `https://matty-fyp-api.onrender.com/api/v1`

Local: `http://localhost:5000/api/v1` (or whatever `PORT` is set to)

## Authentication

Protected routes need a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

The `/auth/*` routes are public. Everything under `/lecturer` and `/student` requires auth. Lecturer routes only accept `LECTURER` role; student routes only accept `STUDENT`.

---

## Auth Endpoints

### POST /auth/register

Creates a new user. Students must supply `student_id` (8-digit string). Passwords are trimmed and hashed with bcrypt.

Request:
```json
{
  "email": "john.doe@mu.ie",
  "password": "securepassword123",
  "first_name": "John",
  "last_name": "Doe",
  "role": "STUDENT",
  "student_id": "12345678",
  "department_id": 1
}
```

`department_id` is optional. `role` must be `LECTURER`, `STUDENT`, or `ADMIN`.

Response 201:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "email": "john.doe@mu.ie",
    "role": "STUDENT",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

Errors: `EMAIL_EXISTS`, `STUDENT_ID_EXISTS`, `VALIDATION_ERROR`

---

### POST /auth/login

Returns JWT and user info. No role check; frontend validates role.

Request:
```json
{
  "email": "john.doe@mu.ie",
  "password": "securepassword123"
}
```

Response 200:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john.doe@mu.ie",
    "role": "STUDENT",
    "first_name": "John",
    "last_name": "Doe",
    "student_id": "12345678"
  }
}
```

Errors: `INVALID_CREDENTIALS` (401)

---

### POST /auth/refresh

Exchanges a valid refresh token for a new access token.

Request:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Response 200:
```json
{
  "token": "new_jwt_token_here"
}
```

---

### GET /auth/me

Returns the authenticated user. Requires `Authorization: Bearer <token>`.

Response 200:
```json
{
  "id": 1,
  "email": "john.doe@mu.ie",
  "role": "STUDENT",
  "first_name": "John",
  "last_name": "Doe",
  "student_id": "12345678",
  "department": {
    "id": 1,
    "name": "Computer Science",
    "code": "CS"
  }
}
```

`department` is null if the user has no department.

---

## Lecturer Endpoints

All lecturer routes require `LECTURER` role.

### GET /lecturer/lectures

Returns all lectures for the logged-in lecturer, ordered by date and time. No pagination or filters.

Response 200:
```json
{
  "lectures": [
    {
      "id": 42,
      "title": "Database Systems",
      "lecture_date": "2024-01-15",
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "location": "Room A123",
      "status": "SCHEDULED",
      "module_id": 1,
      "module_code": "CS301",
      "module_name": "Database Systems"
    }
  ]
}
```

---

### GET /lecturer/lectures/:id

Returns one lecture. 404 if not found or not owned.

Response 200:
```json
{
  "id": 42,
  "title": "Database Systems",
  "lecture_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "location": "Room A123",
  "status": "SCHEDULED",
  "module_id": 1,
  "module_code": "CS301",
  "module_name": "Database Systems",
  "verification_question": "What is the lecturer's name?",
  "verification_answer": "Smith",
  "qr_expiry_seconds": 30
}
```

---

### POST /lecturer/lectures

Creates one or more lectures. With `repeat_weeks` > 1, creates one lecture per week from `lecture_date`.

Request:
```json
{
  "title": "Database Systems - Lecture 5",
  "lecture_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "location": "Room A123",
  "module_id": 1,
  "module_code": "CS301",
  "module_name": "Database Systems",
  "repeat_weeks": 1,
  "verification_question": "Optional question",
  "verification_answer": "Optional answer",
  "qr_expiry_seconds": 30
}
```

`module_id` or `module_code` can be used. If only `module_code` is given, the module is created if it doesn't exist. `location`, `verification_question`, `verification_answer` are optional. `qr_expiry_seconds` is clamped to 15–120; default 30. `repeat_weeks` defaults to 1.

Response 201 (single lecture):
```json
{
  "id": 42,
  "title": "Database Systems - Lecture 5",
  "lecture_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "location": "Room A123",
  "status": "SCHEDULED",
  "verification_question": "Optional question",
  "verification_answer": "Optional answer",
  "qr_expiry_seconds": 30
}
```

Response 201 (multiple):
```json
{
  "created": 4,
  "lectures": [ ... ]
}
```

---

### PUT /lecturer/lectures/:id

Updates a lecture. Only sends fields that change. At least one field required.

Request (example):
```json
{
  "title": "New title",
  "location": "Room B456",
  "qr_expiry_seconds": 45
}
```

Response 200: returns the updated lecture. 404 if not found or not owned.

---

### DELETE /lecturer/lectures/:id

Deletes the lecture. Cascade removes QR sessions and attendance. 404 if not found or not owned.

Response 200:
```json
{
  "success": true,
  "message": "Lecture deleted"
}
```

---

### POST /lecturer/lectures/:id/qr/generate

Generates a new QR session. Any existing active session for that lecture is deactivated first. Uses the lecture’s `qr_expiry_seconds` (or default 30).

Response 200:
```json
{
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_token": "att_a1b2c3d4e5f6..._1705315200",
  "qr_url": "https://matty-fyp.onrender.com/student-checkin.html?token=att_a1b2c3d4...",
  "expires_at": "2024-01-15T14:01:00.000Z",
  "expires_in_seconds": 30
}
```

---

### POST /lecturer/lectures/:id/qr/stop

Deactivates all active QR sessions for the lecture.

Response 200:
```json
{
  "success": true,
  "message": "Active QR session stopped",
  "stopped_count": 1
}
```

---

### GET /lecturer/lectures/:id/qr/current

Returns the current active QR code if one exists and has not expired. 404 if none.

Response 200:
```json
{
  "qr_code": "data:image/png;base64,...",
  "qr_token": "att_...",
  "expires_at": "2024-01-15T14:01:00.000Z",
  "expires_in_seconds": 12,
  "is_active": true
}
```

---

### GET /lecturer/lectures/:id/attendance

Returns attendance for the lecture.

Response 200:
```json
{
  "lecture": {
    "id": 42,
    "title": "Database Systems",
    "lecture_date": "2024-01-15",
    "start_time": "09:00:00",
    "end_time": "10:30:00"
  },
  "attendance": [
    {
      "id": 1,
      "student_id": "12345678",
      "first_name": "John",
      "last_name": "Smith",
      "checked_in_at": "2024-01-15T09:02:00.000Z",
      "status": "PRESENT",
      "minutes_late": 0
    }
  ]
}
```

`status` is `PRESENT`, `LATE`, or `ABSENT`.

---

### GET /lecturer/lectures/:id/attendance/csv

Same data as attendance, returned as CSV with BOM for Excel. Headers: Student ID, First Name, Last Name, Checked In At, Status, Minutes Late. Response uses `Content-Disposition: attachment` and `Content-Type: text/csv`.

---

## Student Endpoints

All student routes require `STUDENT` role.

### GET /student/attendance/checkin-info

Query: `?token=<qr_token>`. Resolves token to lecture and returns title and verification question (never the answer). Used to show the verification question before submit.

Response 200:
```json
{
  "lecture_title": "Database Systems",
  "verification_question": "What is the lecturer's name?"
}
```

`verification_question` is null if the lecture has none. 400 with `QR_TOKEN_EXPIRED` or `LECTURE_NOT_FOUND` if token is invalid or expired.

---

### POST /student/attendance/checkin

Submits attendance. Requires `qr_token`. If the lecture has a verification question, include `answer` (case-insensitive comparison).

Request:
```json
{
  "qr_token": "att_a1b2c3d4e5f6..._1705315200",
  "answer": "Smith"
}
```

Response 200 (success):
```json
{
  "success": true,
  "message": "Attendance recorded successfully",
  "attendance": {
    "lecture": {
      "id": 42,
      "title": "Database Systems",
      "lecture_date": "2024-01-15",
      "start_time": "09:00:00"
    },
    "checked_in_at": "2024-01-15T09:02:00.000Z",
    "status": "PRESENT",
    "minutes_late": 0,
    "student_id": "12345678"
  }
}
```

Status rules:
- **PRESENT**: check-in within 5 minutes of lecture start
- **LATE**: check-in 5+ minutes after start but before lecture end
- **ABSENT**: check-in after lecture end

Errors: `QR_TOKEN_EXPIRED`, `LECTURE_NOT_FOUND`, `ALREADY_CHECKED_IN`, `VERIFICATION_FAILED`, `VALIDATION_ERROR`

---

## Error Format

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

Codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `EMAIL_EXISTS`, `STUDENT_ID_EXISTS`, `INVALID_CREDENTIALS`, `QR_TOKEN_EXPIRED`, `LECTURE_NOT_FOUND`, `ALREADY_CHECKED_IN`, `VERIFICATION_FAILED`, `INTERNAL_SERVER_ERROR`
