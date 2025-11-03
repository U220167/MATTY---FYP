# API Specification

## Base URL
`https://api.maynooth-attendance.com/api/v1`

## Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## 1. Authentication Endpoints

### POST /auth/register
Register a new user (student or lecturer).

**Request Body:**
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

**Response (201):**
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

---

### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "john.doe@mu.ie",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "refresh_token_here",
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

---

### POST /auth/refresh
Refresh JWT token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token_here"
}
```

**Response (200):**
```json
{
  "token": "new_jwt_token_here"
}
```

---

### GET /auth/me
Get current authenticated user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
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

---

## 2. Lecturer Endpoints

### GET /lecturer/dashboard
Get lecturer's timetable for current day/week.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `date` (optional): Date in YYYY-MM-DD format (default: today)
- `range` (optional): "day" | "week" (default: "day")

**Response (200):**
```json
{
  "date": "2024-01-15",
  "lectures": [
    {
      "id": 42,
      "title": "Database Systems",
      "module": {
        "code": "CS301",
        "name": "Database Systems"
      },
      "lecture_date": "2024-01-15",
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "location": "Room A123",
      "status": "SCHEDULED",
      "has_qr_active": false,
      "attendance_count": null
    }
  ],
  "statistics": {
    "total_lectures_today": 2,
    "total_students": 245,
    "average_attendance_rate": 87.5
  }
}
```

---

### GET /lecturer/lectures
Get all lectures for the authenticated lecturer.

**Query Parameters:**
- `status` (optional): Filter by status (SCHEDULED, ACTIVE, COMPLETED, CANCELLED)
- `date_from` (optional): Start date filter
- `date_to` (optional): End date filter
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Response (200):**
```json
{
  "lectures": [
    {
      "id": 42,
      "title": "Database Systems",
      "module": {
        "id": 1,
        "code": "CS301",
        "name": "Database Systems"
      },
      "lecture_date": "2024-01-15",
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "location": "Room A123",
      "status": "SCHEDULED",
      "attendance_count": 38,
      "total_enrolled": 45
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

---

### GET /lecturer/lectures/:id
Get specific lecture details.

**Response (200):**
```json
{
  "id": 42,
  "title": "Database Systems",
  "module": {
    "id": 1,
    "code": "CS301",
    "name": "Database Systems",
    "description": "Introduction to database systems"
  },
  "lecture_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "location": "Room A123",
  "status": "SCHEDULED",
  "created_at": "2024-01-10T10:00:00Z",
  "qr_session": {
    "is_active": false,
    "expires_at": null
  },
  "attendance_summary": {
    "total_enrolled": 45,
    "present": 0,
    "late": 0,
    "absent": 45,
    "percentage": 0
  }
}
```

---

### POST /lecturer/lectures
Create a new lecture.

**Request Body:**
```json
{
  "module_id": 1,
  "title": "Database Systems - Lecture 5",
  "lecture_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "location": "Room A123"
}
```

**Response (201):**
```json
{
  "id": 42,
  "title": "Database Systems - Lecture 5",
  "lecture_date": "2024-01-15",
  "start_time": "09:00:00",
  "end_time": "10:30:00",
  "location": "Room A123",
  "status": "SCHEDULED",
  "created_at": "2024-01-15T08:00:00Z"
}
```

---

### POST /lecturer/lectures/:id/qr/generate
Generate a QR code for a lecture.

**Response (200):**
```json
{
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_token": "att_550e8400e29b41d4a716446655440000_1705315200",
  "qr_url": "https://attendance.maynooth.edu/student/checkin?token=att_550e8400e29b41d4a716446655440000_1705315200",
  "expires_at": "2024-01-15T14:01:00Z",
  "expires_in_seconds": 60,
  "refresh_interval": 60
}
```

---

### POST /lecturer/lectures/:id/qr/refresh
Manually refresh the QR code.

**Response (200):**
```json
{
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_token": "att_new_token_here",
  "expires_at": "2024-01-15T14:02:00Z",
  "expires_in_seconds": 60
}
```

---

### GET /lecturer/lectures/:id/qr/current
Get the current active QR code (if exists).

**Response (200):**
```json
{
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_token": "att_token_here",
  "expires_at": "2024-01-15T14:01:00Z",
  "expires_in_seconds": 45,
  "is_active": true
}
```

**Response (404):**
```json
{
  "error": "No active QR code found for this lecture"
}
```

---

### GET /lecturer/lectures/:id/attendance
Get attendance records for a lecture.

**Query Parameters:**
- `status` (optional): Filter by status (PRESENT, LATE, ABSENT)
- `export` (optional): "csv" to download as CSV

**Response (200):**
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
      "student": {
        "id": 10,
        "student_id": "12345678",
        "first_name": "John",
        "last_name": "Smith"
      },
      "checked_in_at": "2024-01-15T09:02:00Z",
      "status": "PRESENT",
      "minutes_late": 0
    },
    {
      "id": 2,
      "student": {
        "id": 11,
        "student_id": "12345679",
        "first_name": "Jane",
        "last_name": "Doe"
      },
      "checked_in_at": "2024-01-15T09:15:00Z",
      "status": "LATE",
      "minutes_late": 15
    }
  ],
  "summary": {
    "total_enrolled": 45,
    "present": 38,
    "late": 5,
    "absent": 2,
    "attendance_percentage": 95.6
  }
}
```

---

### GET /lecturer/lectures/:id/analytics
Get detailed analytics for a lecture.

**Response (200):**
```json
{
  "lecture_id": 42,
  "overview": {
    "total_enrolled": 45,
    "present": 38,
    "late": 5,
    "absent": 2,
    "attendance_percentage": 95.6,
    "average_checkin_time": "2024-01-15T09:05:00Z"
  },
  "timeline": [
    {
      "time": "09:00",
      "checkins": 5
    },
    {
      "time": "09:05",
      "checkins": 15
    }
  ],
  "status_breakdown": {
    "PRESENT": 38,
    "LATE": 5,
    "ABSENT": 2
  }
}
```

---

### GET /lecturer/analytics/summary
Get overall analytics summary for the lecturer.

**Query Parameters:**
- `date_from` (optional): Start date
- `date_to` (optional): End date
- `module_id` (optional): Filter by module

**Response (200):**
```json
{
  "total_lectures": 50,
  "total_students": 245,
  "average_attendance_rate": 87.5,
  "total_attendance_records": 10937,
  "by_module": [
    {
      "module": {
        "id": 1,
        "code": "CS301",
        "name": "Database Systems"
      },
      "lectures_count": 20,
      "average_attendance": 89.2
    }
  ],
  "trend": [
    {
      "date": "2024-01-15",
      "attendance_rate": 87.5
    }
  ]
}
```

---

## 3. Student Endpoints

### GET /student/lectures
Get student's enrolled lectures.

**Query Parameters:**
- `date_from` (optional): Start date filter
- `date_to` (optional): End date filter
- `status` (optional): Filter by status

**Response (200):**
```json
{
  "lectures": [
    {
      "id": 42,
      "title": "Database Systems",
      "module": {
        "code": "CS301",
        "name": "Database Systems"
      },
      "lecture_date": "2024-01-15",
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "location": "Room A123",
      "attendance_status": "PRESENT",
      "checked_in_at": "2024-01-15T09:02:00Z"
    }
  ]
}
```

---

### POST /student/attendance/checkin
Submit attendance via QR scan.

**Request Body:**
```json
{
  "qr_token": "att_550e8400e29b41d4a716446655440000_1705315200"
}
```

**Response (200) - Success:**
```json
{
  "success": true,
  "message": "Attendance recorded successfully",
  "attendance": {
    "id": 123,
    "lecture": {
      "id": 42,
      "title": "Database Systems",
      "module": {
        "code": "CS301",
        "name": "Database Systems"
      },
      "lecture_date": "2024-01-15",
      "start_time": "09:00:00",
      "end_time": "10:30:00",
      "location": "Room A123"
    },
    "checked_in_at": "2024-01-15T09:02:00Z",
    "status": "PRESENT",
    "minutes_late": 0
  }
}
```

**Response (200) - Late Check-in:**
```json
{
  "success": true,
  "message": "Attendance recorded, but you checked in late",
  "attendance": {
    "id": 123,
    "lecture": {
      "id": 42,
      "title": "Database Systems"
    },
    "checked_in_at": "2024-01-15T09:15:00Z",
    "status": "LATE",
    "minutes_late": 15
  }
}
```

**Response (400) - Errors:**
```json
{
  "success": false,
  "error": "QR_TOKEN_EXPIRED",
  "message": "The QR code has expired. Please ask your lecturer for a new one."
}
```

```json
{
  "success": false,
  "error": "ALREADY_CHECKED_IN",
  "message": "You have already checked in for this lecture."
}
```

```json
{
  "success": false,
  "error": "LECTURE_NOT_FOUND",
  "message": "Invalid QR code or lecture not found."
}
```

---

### GET /student/attendance/history
Get student's attendance history.

**Query Parameters:**
- `module_id` (optional): Filter by module
- `date_from` (optional): Start date
- `date_to` (optional): End date
- `status` (optional): Filter by status

**Response (200):**
```json
{
  "attendance": [
    {
      "id": 123,
      "lecture": {
        "id": 42,
        "title": "Database Systems - Lecture 5",
        "module": {
          "code": "CS301",
          "name": "Database Systems"
        },
        "lecture_date": "2024-01-15",
        "start_time": "09:00:00"
      },
      "checked_in_at": "2024-01-15T09:02:00Z",
      "status": "PRESENT",
      "minutes_late": 0
    }
  ],
  "statistics": {
    "total_lectures": 50,
    "present": 45,
    "late": 3,
    "absent": 2,
    "attendance_rate": 96.0
  }
}
```

---

### GET /student/attendance/stats
Get student's attendance statistics.

**Response (200):**
```json
{
  "overall": {
    "total_lectures": 50,
    "present": 45,
    "late": 3,
    "absent": 2,
    "attendance_rate": 96.0
  },
  "by_module": [
    {
      "module": {
        "id": 1,
        "code": "CS301",
        "name": "Database Systems"
      },
      "total_lectures": 20,
      "present": 19,
      "attendance_rate": 95.0
    }
  ],
  "trend": [
    {
      "week": "2024-01-15",
      "attendance_rate": 100.0
    }
  ]
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {} // Optional additional details
}
```

### Common Error Codes:
- `UNAUTHORIZED` (401): Invalid or missing authentication token
- `FORBIDDEN` (403): User doesn't have permission
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (400): Invalid request data
- `QR_TOKEN_EXPIRED` (400): QR token has expired
- `ALREADY_CHECKED_IN` (400): Student already checked in
- `LECTURE_NOT_FOUND` (400): Lecture associated with QR not found
- `RATE_LIMIT_EXCEEDED` (429): Too many requests
- `INTERNAL_SERVER_ERROR` (500): Server error

---

## Rate Limiting

Rate limits are applied per endpoint:

- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **QR Check-in:** 5 requests per minute per IP
- **QR Generation:** 10 requests per minute per lecturer
- **General API:** 100 requests per minute per user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1642089600
```

