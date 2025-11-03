# Maynooth Attendance Tool - Frontend Prototype

A static HTML/CSS/JavaScript prototype for the Maynooth Attendance Tool. This prototype demonstrates the core user flows without requiring a backend server.

## Folder Structure

```
frontend-prototype/
├── index.html              # Landing/Login page
├── lecturer-dashboard.html # Lecturer timetable view
├── lecture-qr.html         # QR code generation page
├── student-checkin.html    # Student check-in page
├── attendance-list.html    # Attendance records view
├── css/
│   └── styles.css         # Main stylesheet
├── js/
│   ├── main.js            # Shared helpers (auth, mock API)
│   ├── lecturer.js        # Dashboard logic
│   ├── qr.js             # QR generation + countdown
│   ├── student.js         # Check-in logic
│   └── attendance.js      # Attendance list rendering
└── mocks/
    ├── lectures.json      # Sample lecture data
    └── users.json         # Sample user data
```

## Local Run Instructions

### Option 1: Using Python (Recommended)

If you have Python 3 installed:

```bash
cd frontend-prototype
python -m http.server 3000
```

Then open your browser to: `http://localhost:3000`

### Option 2: Using Node.js (http-server)

If you have Node.js installed:

```bash
cd frontend-prototype
npx http-server . -c-1 -p 3000
```

Then open your browser to: `http://localhost:3000`

### Option 3: Using PHP

If you have PHP installed:

```bash
cd frontend-prototype
php -S localhost:3000
```

Then open your browser to: `http://localhost:3000`

## Test Checklist

Follow these steps to test the complete flow:

### 1. Login Flow

- [ ] Open `http://localhost:3000`
- [ ] Enter email: `lecturer@mu.ie`
- [ ] Enter password: `password` (any password works in prototype)
- [ ] Select role: **Lecturer**
- [ ] Click "Login"
- [ ] Should redirect to `lecturer-dashboard.html`

### 2. Lecturer Dashboard

- [ ] Dashboard should display "Today's Schedule"
- [ ] Should show 2 sample lectures:
  - Database Systems (CS301) - 09:00-10:30 - Room A123
  - Web Development (CS302) - 14:00-15:30 - Room B456
- [ ] Each lecture should have "Generate QR Code" and "View Attendance" buttons

### 3. QR Code Generation

- [ ] Click "Generate QR Code" on the first lecture (Database Systems)
- [ ] Should navigate to `lecture-qr.html?lectureId=42`
- [ ] QR code image should appear (placeholder from QR API)
- [ ] Token string should be visible (format: `att_demo_42_<timestamp>`)
- [ ] Countdown timer should start at 60 seconds and count down
- [ ] After 60 seconds, countdown should show "Expired — Refresh required"
- [ ] QR image should become semi-transparent after expiry

### 4. QR Code Actions

- [ ] Click "Refresh QR Code" button
  - [ ] New QR code should generate
  - [ ] New token should be displayed
  - [ ] Countdown should reset to 60 seconds
- [ ] Click "Stop QR Code" button
  - [ ] Countdown should stop
  - [ ] Message should show "QR Code Stopped"
  - [ ] QR image should become semi-transparent

### 5. Student Check-In Flow

- [ ] Copy the QR token from the QR page (e.g., `att_demo_42_1705315200`)
- [ ] Open a new tab/incognito window
- [ ] Navigate to: `http://localhost:3000/student-checkin.html?token=<paste-token>`
  - Example: `http://localhost:3000/student-checkin.html?token=att_demo_42_1705315200`
- [ ] Token should be displayed on the page

### 6. Student Login

- [ ] Enter Student ID: `12345678` (must be 8 digits)
- [ ] Enter password: `password` (any password works in prototype)
- [ ] Click "Login"
- [ ] Should show "Logged in as: 12345678"
- [ ] Check-in form should appear

### 7. Successful Check-In

- [ ] Click "Submit Attendance"
- [ ] Should show success message: "✓ Attendance Recorded Successfully"
- [ ] Should display check-in time and status (PRESENT)

### 8. Error Scenarios

**Test Expired Token:**
- [ ] Wait for QR code to expire (60+ seconds after generation)
- [ ] Try to check in with the expired token
- [ ] Should show error: "The QR code has expired. Please ask your lecturer for a new one."

**Test Duplicate Check-In:**
- [ ] Generate a new QR code (valid, not expired)
- [ ] Check in as student ID `12345678`
- [ ] Try to check in again with the same token
- [ ] Should show error: "You have already checked in for this lecture."

**Test Invalid Token:**
- [ ] Navigate to: `http://localhost:3000/student-checkin.html?token=invalid_token`
- [ ] Should show error: "Invalid QR code or lecture not found."

### 9. Attendance List

- [ ] Go back to lecturer dashboard
- [ ] Click "View Attendance" on the first lecture
- [ ] Should navigate to `attendance-list.html?lectureId=42`
- [ ] Should display:
  - Lecture title and details
  - Attendance summary cards (Total Check-ins, Present, Late, Absent)
  - Table with attendance records showing:
    - Name (or Student)
    - Student ID
    - Checked In At (timestamp)
    - Status (PRESENT/LATE/ABSENT)

### 10. Navigation Flow

- [ ] From attendance list, click "← Back to Dashboard"
- [ ] Should return to lecturer dashboard
- [ ] From QR page, click "← Back to Dashboard"
- [ ] Should return to lecturer dashboard

### 11. Logout

- [ ] Click "Logout" button in header
- [ ] Should redirect to `index.html`
- [ ] Should clear login state (refresh should not auto-login)

### 12. Responsive Design

- [ ] Resize browser window to mobile size (< 768px)
- [ ] Verify all pages are readable and buttons are accessible
- [ ] Check that tables scroll horizontally on mobile
- [ ] Verify forms are usable on mobile

## Features Implemented

✅ **Landing/Login Page** - Email, password, and role selector  
✅ **Lecturer Dashboard** - Timetable view with 2 sample lectures  
✅ **QR Code Generation** - Token generation with 60s countdown timer  
✅ **QR Code Display** - Visible token string and QR image  
✅ **QR Expiration** - Countdown timer and expiry UI  
✅ **Student Check-In** - Token parsing from URL, login form, check-in submission  
✅ **Token Validation** - Expiry checking, duplicate prevention  
✅ **Attendance List** - Table view with summary statistics  
✅ **Client-Side Storage** - localStorage for auth and attendance records  
✅ **Responsive Design** - Mobile-first CSS  
✅ **Error Handling** - Proper error messages for all scenarios  

## Backend Integration Notes

All mock API functions in `js/main.js` are marked with `TODO` comments indicating which real API endpoints to call:

- `POST /auth/login` - User authentication
- `GET /lecturer/dashboard` - Lecturer timetable
- `POST /lecturer/lectures/:id/qr/generate` - QR code generation
- `POST /lecturer/lectures/:id/qr/refresh` - QR code refresh
- `POST /student/attendance/checkin` - Student check-in
- `GET /lecturer/lectures/:id/attendance` - Attendance records

See `API_SPECIFICATION.md` for detailed API documentation.

## Data Storage

**Prototype Storage:**
- `localStorage.userEmail` - Current user email
- `localStorage.userRole` - Current user role (LECTURER/STUDENT)
- `localStorage.isLoggedIn` - Login status flag
- `localStorage.studentId` - Logged-in student ID
- `localStorage.attendanceRecords` - Array of attendance records (JSON)

**Note:** In production, attendance records will be stored in the database. localStorage is only for prototype demonstration.

## QR Code Implementation

The prototype uses an external QR code API service (`api.qrserver.com`) to generate QR code images. In production:

- QR codes should be generated server-side using the `qrcode` npm package
- The backend should return a base64 data URI in the response
- QR tokens should be stored in the database (qr_sessions table)

See `API_SPECIFICATION.md` section "POST /lecturer/lectures/:id/qr/generate" for the expected response format.

## Browser Compatibility

This prototype uses modern JavaScript (ES6 modules) and should work in:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

For older browsers, consider using a module bundler or transpiler.

## Next Steps

After prototype testing and UX validation:

1. Convert to React/Next.js application
2. Integrate real API endpoints
3. Replace localStorage with proper state management
4. Add proper authentication with JWT tokens
5. Implement proper error handling and loading states
6. Add accessibility improvements (ARIA labels, keyboard navigation)
7. Add unit and integration tests

