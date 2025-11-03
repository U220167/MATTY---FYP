# The Maynooth Attendance Tool - Project Plan & Architecture

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Lecturer    │  │   Student    │  │   Authentication     │ │
│  │  Dashboard   │  │  Scan/Submit │  │      Pages           │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   HTTPS/REST API   │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   Auth API   │  │ Lecture API  │  │  Attendance API      │ │
│  │              │  │              │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   QR Service │  │  Validation  │  │   Analytics API      │ │
│  │              │  │   Service    │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
         ┌──────────┴─────────┐  ┌──────┴──────────┐
         │   PostgreSQL DB    │  │  Redis Cache    │
         │                    │  │  (QR Sessions)  │
         └────────────────────┘  └─────────────────┘
```

### 1.2 Technology Stack

**Frontend:**
- Next.js 14+ (App Router) or React 18+
- TypeScript
- TailwindCSS for styling
- React Query for data fetching
- Zustand/Redux for state management
- QR Scanner library (e.g., `react-qr-reader` or native camera API)

**Backend:**
- Node.js 18+
- Express.js
- TypeScript
- Prisma ORM or TypeORM
- JWT for authentication
- `qrcode` npm package
- Redis (for QR session management)
- Express Rate Limiting

**Database:**
- PostgreSQL (recommended) or MySQL
- Redis (for caching QR codes and rate limiting)

**Security & Validation:**
- bcrypt for password hashing
- express-validator for input validation
- Helmet.js for security headers
- CORS configuration
- Rate limiting middleware

**Deployment:**
- Frontend: Vercel (Next.js) or Netlify
- Backend: Render, Railway, or Heroku
- Database: PostgreSQL on Render/AWS RDS
- Redis: Upstash or Redis Cloud

---

## 2. Entity-Relationship Model

### 2.1 Database Schema

```mermaid
erDiagram
    USERS ||--o{ LECTURES : "teaches"
    USERS ||--o{ ATTENDANCE : "records"
    LECTURES ||--o{ ATTENDANCE : "has"
    LECTURES ||--o{ QR_SESSIONS : "generates"
    MODULES ||--o{ LECTURES : "belongs_to"
    DEPARTMENTS ||--o{ MODULES : "contains"
    
    USERS {
        int id PK
        string email UK
        string student_id UK "nullable"
        string password_hash
        string first_name
        string last_name
        enum role "LECTURER, STUDENT, ADMIN"
        int department_id FK "nullable"
        timestamp created_at
        timestamp updated_at
        boolean is_active
    }
    
    DEPARTMENTS {
        int id PK
        string name UK
        string code UK
        timestamp created_at
    }
    
    MODULES {
        int id PK
        string code UK
        string name
        string description
        int department_id FK
        timestamp created_at
    }
    
    LECTURES {
        int id PK
        int lecturer_id FK
        int module_id FK
        string title
        date lecture_date
        time start_time
        time end_time
        string location
        enum status "SCHEDULED, ACTIVE, COMPLETED, CANCELLED"
        timestamp created_at
        timestamp updated_at
    }
    
    QR_SESSIONS {
        int id PK
        int lecture_id FK
        string qr_token UK "unique, time-limited"
        timestamp expires_at
        timestamp created_at
        boolean is_active
        int refresh_interval_seconds "default: 60"
    }
    
    ATTENDANCE {
        int id PK
        int student_id FK
        int lecture_id FK
        string qr_token "token used for check-in"
        timestamp checked_in_at
        timestamp verified_at
        enum status "PRESENT, LATE, ABSENT, EXCUSED"
        json metadata "additional info if needed"
        timestamp created_at
    }
    
    ATTENDANCE_ANALYTICS {
        int id PK
        int lecture_id FK
        int total_students
        int present_count
        int late_count
        int absent_count
        float attendance_percentage
        timestamp calculated_at
    }
```

### 2.2 Table Definitions (SQL)

```sql
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    student_id VARCHAR(50) UNIQUE, -- Nullable, only for students
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('LECTURER', 'STUDENT', 'ADMIN')),
    department_id INTEGER REFERENCES departments(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Departments Table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Modules Table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id INTEGER REFERENCES departments(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lectures Table
CREATE TABLE lectures (
    id SERIAL PRIMARY KEY,
    lecturer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id),
    title VARCHAR(255) NOT NULL,
    lecture_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QR Sessions Table
CREATE TABLE qr_sessions (
    id SERIAL PRIMARY KEY,
    lecture_id INTEGER REFERENCES lectures(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    refresh_interval_seconds INTEGER DEFAULT 60
);

-- Attendance Table
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lecture_id INTEGER REFERENCES lectures(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) NOT NULL,
    checked_in_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED')),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, lecture_id) -- Prevent duplicate check-ins
);

-- Attendance Analytics Table (for caching analytics)
CREATE TABLE attendance_analytics (
    id SERIAL PRIMARY KEY,
    lecture_id INTEGER REFERENCES lectures(id) ON DELETE CASCADE,
    total_students INTEGER NOT NULL,
    present_count INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    attendance_percentage DECIMAL(5,2),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX idx_lectures_lecturer_date ON lectures(lecturer_id, lecture_date);
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_lecture ON attendance(lecture_id);
CREATE INDEX idx_qr_sessions_token ON qr_sessions(qr_token);
CREATE INDEX idx_qr_sessions_expires ON qr_sessions(expires_at);
CREATE INDEX idx_users_role ON users(role);
```

---

## 3. Backend API Structure

### 3.1 API Routes Overview

**Base URL:** `https://api.maynooth-attendance.com/api/v1`

### 3.2 Authentication Routes

```
POST   /auth/register          - Register new user (students/lecturers)
POST   /auth/login             - Login user (returns JWT token)
POST   /auth/logout             - Logout (blacklist token)
POST   /auth/refresh            - Refresh JWT token
GET    /auth/me                 - Get current user profile
PUT    /auth/me                 - Update user profile
```

**Request/Response Examples:**

```typescript
// POST /auth/login
{
  "email": "john.doe@mu.ie",
  "password": "securepassword"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "john.doe@mu.ie",
    "role": "LECTURER",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### 3.3 Lecturer Routes

```
GET    /lecturer/dashboard              - Get lecturer's timetable (current day/week)
GET    /lecturer/lectures               - Get all lecturer's lectures (with filters)
GET    /lecturer/lectures/:id           - Get specific lecture details
POST   /lecturer/lectures               - Create new lecture
PUT    /lecturer/lectures/:id           - Update lecture
DELETE /lecturer/lectures/:id           - Delete/cancel lecture

POST   /lecturer/lectures/:id/qr/generate    - Generate QR code for lecture
GET    /lecturer/lectures/:id/qr/current     - Get current active QR code
POST   /lecturer/lectures/:id/qr/refresh      - Manually refresh QR code

GET    /lecturer/lectures/:id/attendance      - Get attendance for lecture
GET    /lecturer/lectures/:id/analytics       - Get attendance analytics
GET    /lecturer/analytics/summary            - Get overall analytics summary
```

**Example: POST /lecturer/lectures/:id/qr/generate**

```typescript
// Request (no body needed, lecture_id in params)
// Response
{
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "qr_token": "a1b2c3d4e5f6g7h8i9j0",
  "expires_at": "2024-01-15T14:01:00Z",
  "expires_in_seconds": 60
}
```

### 3.4 Student Routes

```
GET    /student/lectures                - Get student's enrolled lectures
POST   /student/attendance/checkin      - Submit attendance via QR scan
GET    /student/attendance/history       - Get student's attendance history
GET    /student/attendance/stats         - Get student's attendance statistics
```

**Example: POST /student/attendance/checkin**

```typescript
// Request
{
  "qr_token": "a1b2c3d4e5f6g7h8i9j0",
  "student_id": "12345678" // Optional if in JWT
}

// Response (Success)
{
  "success": true,
  "message": "Attendance recorded successfully",
  "attendance": {
    "lecture_id": 42,
    "lecture_title": "Database Systems",
    "checked_in_at": "2024-01-15T14:00:30Z",
    "status": "PRESENT"
  }
}

// Response (Error - Late)
{
  "success": false,
  "error": "LATE_CHECKIN",
  "message": "You checked in after the lecture start time",
  "attendance": {
    "status": "LATE",
    "minutes_late": 15
  }
}
```

### 3.5 Admin Routes (Optional)

```
GET    /admin/users                     - Get all users
GET    /admin/lectures                  - Get all lectures
GET    /admin/attendance                - Get all attendance records
GET    /admin/analytics                 - System-wide analytics
```

### 3.6 Middleware & Security

**Authentication Middleware:**
```javascript
const authenticate = async (req, res, next) => {
  // Verify JWT token
  // Attach user to req.user
}

const authorize = (...roles) => {
  // Check if user role is allowed
}
```

**Validation Middleware:**
```javascript
const validateQRCheckin = [
  body('qr_token').notEmpty().isLength({ min: 20, max: 255 }),
  body('student_id').optional().isNumeric()
]
```

**Rate Limiting:**
- QR Check-in: 5 requests per minute per IP
- QR Generation: 10 requests per minute per lecturer
- Login: 5 attempts per 15 minutes per IP

---

## 4. Frontend Page Flow & UI Structure

### 4.1 Page Routes (Next.js App Router)

```
/                          → Landing/Auth Page
/auth/login                → Login Page
/auth/register             → Registration Page

/lecturer/dashboard        → Lecturer Dashboard (Timetable)
/lecturer/lectures         → Lecturer's Lecture List
/lecturer/lectures/[id]    → Lecture Detail & QR Generator
/lecturer/lectures/[id]/attendance → Attendance View & Analytics
/lecturer/analytics        → Overall Analytics Dashboard

/student/dashboard         → Student Dashboard
/student/lectures          → Student's Enrolled Lectures
/student/attendance        → Student Attendance History
/student/checkin           → QR Scan/Check-in Page (Public route)

/admin/*                   → Admin Panel (if applicable)
```

### 4.2 UI Wireframes (Text Descriptions)

#### **4.2.1 Landing/Login Page**

```
┌─────────────────────────────────────────────────────────────┐
│                    MAYNOOTH ATTENDANCE TOOL                  │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │            [  Email: _______________  ]            │    │
│  │            [  Password: ___________  ]            │    │
│  │                                                     │    │
│  │              [  Login as Lecturer  ]              │    │
│  │              [  Login as Student   ]              │    │
│  │                                                     │    │
│  │          Forgot Password? | Register              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### **4.2.2 Lecturer Dashboard**

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]  Welcome, Dr. John Doe  [Notifications] [Profile]   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  TODAY'S SCHEDULE - Monday, January 15, 2024                 │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🕐 09:00 - 10:30                                     │   │
│  │ 📚 Database Systems (CS301)                         │   │
│  │ 📍 Room A123                                         │   │
│  │ [Generate QR Code] [View Attendance] [Analytics]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🕐 14:00 - 15:30                                     │   │
│  │ 📚 Web Development (CS302)                          │   │
│  │ 📍 Room B456                                         │   │
│  │ [Generate QR Code] [View Attendance] [Analytics]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  QUICK STATS                                                 │
│  Total Students: 245  |  Avg Attendance: 87%               │
└─────────────────────────────────────────────────────────────┘
```

#### **4.2.3 QR Code Generation Page**

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard                                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  DATABASE SYSTEMS (CS301)                                    │
│  Monday, January 15, 2024 | 09:00 - 10:30                   │
│  Room A123                                                    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │         ┌─────────────────────────┐                 │   │
│  │         │                         │                 │   │
│  │         │      [QR CODE]         │                 │   │
│  │         │                         │                 │   │
│  │         └─────────────────────────┘                 │   │
│  │                                                     │   │
│  │              Expires in: 00:45                     │   │
│  │         Auto-refresh: ON (60 seconds)              │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  [Refresh QR Code] [Stop QR Code] [View Live Attendance]    │
│                                                               │
│  Current Attendance: 23 / 45 students                        │
└─────────────────────────────────────────────────────────────┘
```

#### **4.2.4 Student Check-in Page (QR Scan)**

```
┌─────────────────────────────────────────────────────────────┐
│                    ATTENDANCE CHECK-IN                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │        📷 [Camera View / QR Scanner]               │   │
│  │                                                     │   │
│  │              Point camera at QR code               │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  OR                                                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Enter QR Token: [_________________]                │   │
│  │  [Submit Attendance]                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  Already logged in as: 12345678 (John Smith)                │
│  [Logout]                                                    │
└─────────────────────────────────────────────────────────────┘
```

#### **4.2.5 Attendance Submission Confirmation**

```
┌─────────────────────────────────────────────────────────────┐
│                      ✓ ATTENDANCE RECORDED                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  You have successfully checked in for:                       │
│                                                               │
│  📚 Database Systems (CS301)                                │
│  📅 Monday, January 15, 2024                                 │
│  🕐 09:00 - 10:30                                            │
│  📍 Room A123                                                │
│                                                               │
│  Check-in Time: 09:02 AM                                     │
│  Status: ✓ PRESENT                                           │
│                                                               │
│  [View Attendance History] [Close]                          │
└─────────────────────────────────────────────────────────────┘
```

#### **4.2.6 Lecturer Attendance Analytics**

```
┌─────────────────────────────────────────────────────────────┐
│  DATABASE SYSTEMS - Attendance Analytics                    │
│  Monday, January 15, 2024 | 09:00 - 10:30                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  OVERVIEW                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  45 Total    │  │   38 Present │  │   84% Attend │      │
│  │  Students    │  │   (5 Late)   │  │   Rate       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  STUDENT LIST                                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Name              | Student ID | Check-in Time | ✓  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ John Smith        | 12345678   | 09:02 AM      | ✓ │   │
│  │ Jane Doe          | 12345679   | 09:05 AM      | ⚠ │   │
│  │ Bob Johnson       | 12345680   | Not checked in| ✗ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  [Export to CSV] [Download Report] [Email Summary]          │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Component Structure

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── lecturer/
│   │   ├── dashboard/
│   │   ├── lectures/
│   │   └── analytics/
│   └── student/
│       ├── dashboard/
│       ├── attendance/
│       └── checkin/
├── components/
│   ├── common/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── QRCode.tsx
│   │   ├── QRScanner.tsx
│   │   └── LoadingSpinner.tsx
│   ├── lecturer/
│   │   ├── Timetable.tsx
│   │   ├── QRGenerator.tsx
│   │   ├── AttendanceList.tsx
│   │   └── AnalyticsChart.tsx
│   └── student/
│       ├── CheckInForm.tsx
│       └── AttendanceHistory.tsx
├── lib/
│   ├── api/
│   │   ├── auth.ts
│   │   ├── lectures.ts
│   │   ├── attendance.ts
│   │   └── analytics.ts
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useQRCode.ts
│   │   └── useAttendance.ts
│   └── utils/
│       ├── validation.ts
│       └── date.ts
└── types/
    ├── user.ts
    ├── lecture.ts
    ├── attendance.ts
```

---

## 5. QR Code Generation, Scanning & Validation Flow

### 5.1 QR Code Generation Flow

```mermaid
sequenceDiagram
    participant L as Lecturer
    participant F as Frontend
    participant B as Backend
    participant R as Redis
    participant D as Database

    L->>F: Select lecture & click "Generate QR"
    F->>B: POST /lecturer/lectures/:id/qr/generate
    B->>B: Validate lecturer owns lecture
    B->>B: Generate unique token (UUID + timestamp)
    B->>D: Check if active QR exists for lecture
    B->>D: Deactivate old QR session (if exists)
    B->>D: Create new QR session (expires in 60s)
    B->>R: Cache QR token & lecture_id (TTL: 60s)
    B->>B: Generate QR image from token URL
    B->>F: Return QR image + token + expiry
    F->>F: Display QR code
    F->>F: Start auto-refresh timer (60s countdown)
    
    Note over F: Every 60 seconds...
    F->>B: POST /lecturer/lectures/:id/qr/refresh
    B->>B: Generate new token
    B->>D: Update QR session
    B->>R: Update cache
    B->>F: Return new QR code
    F->>F: Update displayed QR code
```

### 5.2 QR Code Structure

**Token Format:**
```
{base_url}/student/checkin?token={qr_token}
```

Where `qr_token` is:
- A UUID v4: `550e8400-e29b-41d4-a716-446655440000`
- Combined with timestamp hash for uniqueness
- Example: `att_550e8400e29b41d4a716446655440000_1705315200`

**QR Code Content (Full URL):**
```
https://attendance.maynooth.edu/student/checkin?token=att_550e8400e29b41d4a716446655440000_1705315200
```

### 5.3 Student Scanning & Validation Flow

```mermaid
sequenceDiagram
    participant S as Student
    participant M as Mobile Browser
    participant F as Frontend
    participant B as Backend
    participant R as Redis
    participant D as Database

    S->>M: Scan QR code with camera
    M->>F: Navigate to /student/checkin?token=xyz
    F->>F: Extract token from URL
    F->>F: Check if student is logged in
    
    alt Student not logged in
        F->>S: Show login form (student ID + password)
        S->>F: Enter credentials
        F->>B: POST /auth/login
        B->>D: Validate credentials
        B->>F: Return JWT token
        F->>F: Store token & user data
    end
    
    F->>B: POST /student/attendance/checkin
    Note over F,B: { qr_token: "xyz", student_id: "12345678" }
    
    B->>B: Validate JWT token
    B->>R: Check if QR token exists & valid (Redis lookup)
    
    alt QR token invalid/expired
        R-->>B: Token not found
        B->>F: Error: "QR code expired or invalid"
        F->>S: Show error message
    else QR token valid
        R-->>B: Return lecture_id, expires_at
        B->>B: Check if token expired
        B->>D: Verify student not already checked in
        B->>D: Check lecture start/end time
        B->>D: Insert attendance record
        B->>D: Mark QR session as used (optional)
        B->>F: Success response
        F->>S: Show confirmation screen
    end
```

### 5.4 Security & Anti-Fraud Measures

#### **5.4.1 QR Code Security**

1. **Time-Limited Tokens:**
   - QR tokens expire after 60 seconds
   - New token generated on refresh
   - Old tokens are invalidated immediately

2. **Token Validation:**
   ```javascript
   // Backend validation logic
   const validateQRToken = async (token) => {
     // 1. Check Redis cache first (fast)
     const cached = await redis.get(`qr:${token}`);
     if (cached) return JSON.parse(cached);
     
     // 2. Check database (fallback)
     const session = await db.qrSessions.findOne({
       where: { qr_token: token, is_active: true }
     });
     
     // 3. Check expiry
     if (session && new Date() > session.expires_at) {
       return null; // Expired
     }
     
     return session;
   };
   ```

3. **One-Time Use (Optional):**
   - Track used tokens in Redis with TTL
   - Prevent same token being used multiple times
   - Trade-off: Requires manual refresh if multiple students scan simultaneously

4. **Server-Side Validation:**
   - All validation happens on backend
   - Frontend cannot manipulate QR tokens
   - Timestamp verification on check-in

#### **5.4.2 Late Check-in Detection**

```javascript
const determineAttendanceStatus = (lecture, checkInTime) => {
  const lectureStart = new Date(`${lecture.lecture_date} ${lecture.start_time}`);
  const lateThreshold = 15; // 15 minutes
  
  const minutesLate = (checkInTime - lectureStart) / (1000 * 60);
  
  if (minutesLate <= 0) return 'PRESENT';
  if (minutesLate <= lateThreshold) return 'LATE';
  if (minutesLate > lateThreshold) return 'ABSENT'; // Too late
};
```

#### **5.4.3 Rate Limiting**

- **Per IP:** Max 5 check-ins per minute
- **Per Student:** Max 1 check-in per lecture (enforced by DB unique constraint)
- **Per QR Token:** Max 100 check-ins (prevent mass distribution)

### 5.5 QR Refresh Implementation

**Frontend Auto-Refresh:**

```typescript
// useQRCode.ts hook
export const useQRCode = (lectureId: number) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  
  const generateQR = async () => {
    const response = await api.post(`/lecturer/lectures/${lectureId}/qr/generate`);
    setQrCode(response.data.qr_code);
    setExpiresAt(new Date(response.data.expires_at));
  };
  
  useEffect(() => {
    generateQR();
    const interval = setInterval(() => {
      generateQR(); // Refresh every 60 seconds
    }, 60000);
    
    return () => clearInterval(interval);
  }, [lectureId]);
  
  return { qrCode, expiresAt };
};
```

**Backend Refresh Endpoint:**

```javascript
POST /lecturer/lectures/:id/qr/refresh
// Generates new QR token, invalidates old one
// Returns new QR code image
```

---

## 6. GDPR & Data Protection Considerations

### 6.1 Data Minimization

- **Collected Data:**
  - Student ID (for identification)
  - Email (for authentication)
  - Name (for attendance records)
  - Check-in timestamp (for attendance tracking)

- **NOT Collected:**
  - Location/GPS coordinates
  - Device information beyond IP (minimal logging)
  - Biometric data
  - Unnecessary personal details

### 6.2 User Rights

- **Right to Access:** Students can view their attendance history
- **Right to Rectification:** Users can update their profile
- **Right to Erasure:** Admin can delete user accounts (with proper authorization)
- **Data Export:** Students can export their attendance data (CSV/JSON)

### 6.3 Security Measures

- Passwords: Hashed with bcrypt (salt rounds: 10)
- HTTPS: All communications encrypted
- JWT Tokens: Short-lived (15 min) with refresh tokens
- Database: Encrypted at rest
- Access Control: Role-based permissions

### 6.4 Data Retention

- Attendance records: Retained for academic year + 2 years
- User accounts: Retained while user is active
- Audit logs: 90 days retention

---

## 7. Implementation Phases

### Phase 1: Core Functionality (Weeks 1-4)
- [ ] Database schema setup
- [ ] User authentication (JWT)
- [ ] Basic lecturer dashboard
- [ ] QR code generation
- [ ] Student check-in flow
- [ ] Basic attendance recording

### Phase 2: Security & Validation (Weeks 5-6)
- [ ] QR token expiration & refresh
- [ ] Late check-in detection
- [ ] Rate limiting
- [ ] Input validation & sanitization
- [ ] Security headers & CORS

### Phase 3: Analytics & UI Polish (Weeks 7-8)
- [ ] Attendance analytics dashboard
- [ ] Data visualization (charts)
- [ ] Export functionality (CSV)
- [ ] Responsive mobile UI
- [ ] Error handling & user feedback

### Phase 4: Testing & Deployment (Weeks 9-10)
- [ ] Unit tests (backend)
- [ ] Integration tests (API)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Deployment to production
- [ ] Performance optimization
- [ ] Documentation

### Phase 5: Future Enhancements (Post-MVP)
- [ ] Moodle integration
- [ ] Alternative check-in methods
- [ ] Mini quiz feature
- [ ] Push notifications
- [ ] Advanced analytics

---

## 8. Development Setup

### 8.1 Prerequisites

```bash
# Node.js 18+
node --version

# PostgreSQL 14+
psql --version

# Redis (for caching)
redis-cli --version

# npm or yarn
npm --version
```

### 8.2 Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure database, JWT secret, etc.
npm run migrate
npm run dev
```

### 8.3 Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Configure API URL
npm run dev
```

### 8.4 Environment Variables

**Backend (.env):**
```
DATABASE_URL=postgresql://user:password@localhost:5432/attendance_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret
PORT=5000
NODE_ENV=development
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

---

## 9. Testing Strategy

### 9.1 Unit Tests
- Authentication logic
- QR token generation & validation
- Attendance status calculation
- Date/time utilities

### 9.2 Integration Tests
- API endpoint testing
- Database operations
- Authentication flow
- QR check-in flow

### 9.3 E2E Tests
- Complete lecturer workflow (generate QR → view attendance)
- Complete student workflow (scan QR → check in)
- Error scenarios (expired QR, duplicate check-in)

---

## 10. Conclusion

This architecture provides a scalable, secure foundation for the Maynooth Attendance Tool. Key features:

✅ **Secure QR-based attendance tracking**
✅ **Time-limited QR codes to prevent reuse**
✅ **Role-based access control**
✅ **Analytics & reporting capabilities**
✅ **GDPR-compliant data handling**
✅ **Mobile-friendly student interface**

The system is designed to be extensible for future enhancements like Moodle integration and alternative verification methods.

