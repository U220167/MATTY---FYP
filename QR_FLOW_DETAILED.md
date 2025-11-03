# QR Code Flow - Detailed Implementation Guide

## Overview

The QR code system is the core of the attendance tracking mechanism. This document details how QR codes are generated, validated, and used for student check-ins.

---

## 1. QR Token Generation

### 1.1 Token Structure

**Format:** `att_{uuid}_{timestamp}`

**Example:** `att_550e8400e29b41d4a716446655440000_1705315200`

**Components:**
- Prefix: `att_` (identifies as attendance token)
- UUID: `550e8400e29b41d4a716446655440000` (UUID v4 for uniqueness)
- Timestamp: `1705315200` (Unix timestamp for expiration validation)

### 1.2 Generation Process

```javascript
// Backend: Generate QR Token
const generateQRToken = () => {
  const uuid = crypto.randomUUID(); // UUID v4
  const timestamp = Math.floor(Date.now() / 1000);
  return `att_${uuid.replace(/-/g, '')}_${timestamp}`;
};

// Backend: Create QR Session
const createQRSession = async (lectureId) => {
  const token = generateQRToken();
  const expiresAt = new Date(Date.now() + 60000); // 60 seconds from now
  
  // Store in database
  const session = await db.qrSessions.create({
    data: {
      lecture_id: lectureId,
      qr_token: token,
      expires_at: expiresAt,
      is_active: true,
      refresh_interval_seconds: 60
    }
  });
  
  // Cache in Redis for fast lookup
  await redis.setex(
    `qr:${token}`,
    60, // TTL: 60 seconds
    JSON.stringify({
      lecture_id: lectureId,
      expires_at: expiresAt.toISOString()
    })
  );
  
  return session;
};
```

### 1.3 QR Code Image Generation

```javascript
const qrcode = require('qrcode');

const generateQRCodeImage = async (token) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://attendance.maynooth.edu';
  const qrUrl = `${baseUrl}/student/checkin?token=${token}`;
  
  // Generate QR code as base64 PNG
  const qrImage = await qrcode.toDataURL(qrUrl, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 400,
    margin: 2
  });
  
  return qrImage; // Returns: "data:image/png;base64,..."
};
```

---

## 2. QR Code Refresh Mechanism

### 2.1 Auto-Refresh (Frontend)

The frontend automatically refreshes the QR code every 60 seconds to prevent screenshot reuse.

```typescript
// Frontend: useQRCode Hook
import { useState, useEffect } from 'react';

export const useQRCode = (lectureId: number) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(false);

  const generateQR = async () => {
    try {
      const response = await fetch(
        `/api/v1/lecturer/lectures/${lectureId}/qr/generate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      setQrCode(data.qr_code);
      setQrToken(data.qr_token);
      setExpiresAt(new Date(data.expires_at));
      setIsActive(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const stopQR = () => {
    setIsActive(false);
    setQrCode(null);
    setQrToken(null);
    setExpiresAt(null);
  };

  useEffect(() => {
    if (!isActive || !lectureId) return;

    // Initial generation
    generateQR();

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      generateQR();
    }, 60000);

    // Cleanup
    return () => clearInterval(interval);
  }, [lectureId, isActive]);

  // Countdown timer
  useEffect(() => {
    if (!expiresAt || !isActive) return;

    const updateTimer = () => {
      const remaining = Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);
    };

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [expiresAt, isActive]);

  return {
    qrCode,
    qrToken,
    expiresAt,
    timeRemaining,
    isActive,
    generateQR,
    stopQR
  };
};
```

### 2.2 Manual Refresh (Backend)

Lecturers can manually refresh the QR code if needed.

```javascript
// Backend: Manual Refresh Endpoint
app.post('/lecturer/lectures/:id/qr/refresh', authenticate, async (req, res) => {
  const { id } = req.params;
  const lecturerId = req.user.id;

  // Verify lecturer owns this lecture
  const lecture = await db.lectures.findUnique({
    where: { id: parseInt(id), lecturer_id: lecturerId }
  });

  if (!lecture) {
    return res.status(404).json({ error: 'Lecture not found' });
  }

  // Deactivate current QR session
  await db.qrSessions.updateMany({
    where: { lecture_id: parseInt(id), is_active: true },
    data: { is_active: false }
  });

  // Create new QR session
  const newSession = await createQRSession(parseInt(id));
  const qrImage = await generateQRCodeImage(newSession.qr_token);

  res.json({
    qr_code: qrImage,
    qr_token: newSession.qr_token,
    expires_at: newSession.expires_at,
    expires_in_seconds: 60
  });
});
```

---

## 3. Student Check-in Flow

### 3.1 QR Code Scanning

```typescript
// Frontend: QR Scanner Component
import { Html5Qrcode } from 'html5-qrcode';

export const QRScanner = ({ onScanSuccess }) => {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode("qr-reader");
    setScanner(html5QrCode);
  }, []);

  const startScanning = async () => {
    if (!scanner) return;

    try {
      await scanner.start(
        { facingMode: "environment" }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          // Extract token from URL
          const url = new URL(decodedText);
          const token = url.searchParams.get('token');
          
          if (token) {
            onScanSuccess(token);
            stopScanning();
          }
        },
        (errorMessage) => {
          // Ignore scan errors
        }
      );
      setIsScanning(true);
    } catch (error) {
      console.error('Failed to start scanner:', error);
    }
  };

  const stopScanning = async () => {
    if (!scanner || !isScanning) return;
    
    await scanner.stop();
    scanner.clear();
    setIsScanning(false);
  };

  return (
    <div>
      <div id="qr-reader" style={{ width: '100%' }}></div>
      {!isScanning ? (
        <button onClick={startScanning}>Start Scanner</button>
      ) : (
        <button onClick={stopScanning}>Stop Scanner</button>
      )}
    </div>
  );
};
```

### 3.2 Manual Token Entry (Fallback)

If QR scanning fails, students can manually enter the token.

```typescript
// Frontend: Manual Token Entry
export const ManualCheckIn = ({ onSubmit }) => {
  const [token, setToken] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (token.trim()) {
      onSubmit(token.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="Enter QR token"
      />
      <button type="submit">Submit Attendance</button>
    </form>
  );
};
```

### 3.3 Check-in Validation (Backend)

```javascript
// Backend: Check-in Endpoint
app.post('/student/attendance/checkin', authenticate, async (req, res) => {
  const { qr_token } = req.body;
  const studentId = req.user.id;

  // 1. Validate QR token exists and is active
  const qrSession = await validateQRToken(qr_token);
  
  if (!qrSession) {
    return res.status(400).json({
      success: false,
      error: 'QR_TOKEN_EXPIRED',
      message: 'The QR code has expired. Please ask your lecturer for a new one.'
    });
  }

  // 2. Get lecture details
  const lecture = await db.lectures.findUnique({
    where: { id: qrSession.lecture_id }
  });

  if (!lecture) {
    return res.status(404).json({
      success: false,
      error: 'LECTURE_NOT_FOUND',
      message: 'Invalid QR code or lecture not found.'
    });
  }

  // 3. Check if student already checked in
  const existingAttendance = await db.attendance.findUnique({
    where: {
      student_id_lecture_id: {
        student_id: studentId,
        lecture_id: lecture.id
      }
    }
  });

  if (existingAttendance) {
    return res.status(400).json({
      success: false,
      error: 'ALREADY_CHECKED_IN',
      message: 'You have already checked in for this lecture.',
      attendance: existingAttendance
    });
  }

  // 4. Calculate attendance status (PRESENT, LATE, ABSENT)
  const checkInTime = new Date();
  const lectureStart = new Date(
    `${lecture.lecture_date}T${lecture.start_time}Z`
  );
  const minutesLate = Math.floor(
    (checkInTime - lectureStart) / (1000 * 60)
  );

  let status = 'PRESENT';
  if (minutesLate > 15) {
    status = 'ABSENT'; // Too late
  } else if (minutesLate > 0) {
    status = 'LATE';
  }

  // 5. Record attendance
  const attendance = await db.attendance.create({
    data: {
      student_id: studentId,
      lecture_id: lecture.id,
      qr_token: qr_token,
      checked_in_at: checkInTime,
      status: status,
      minutes_late: Math.max(0, minutesLate),
      metadata: {
        ip_address: req.ip,
        user_agent: req.get('user-agent')
      }
    }
  });

  // 6. Update QR session check-in count
  await db.qrSessions.update({
    where: { id: qrSession.id },
    data: {
      check_in_count: {
        increment: 1
      }
    }
  });

  // 7. Recalculate analytics (async, non-blocking)
  calculateLectureAnalytics(lecture.id).catch(console.error);

  res.json({
    success: true,
    message: status === 'PRESENT' 
      ? 'Attendance recorded successfully'
      : 'Attendance recorded, but you checked in late',
    attendance: {
      id: attendance.id,
      lecture: {
        id: lecture.id,
        title: lecture.title,
        lecture_date: lecture.lecture_date,
        start_time: lecture.start_time
      },
      checked_in_at: attendance.checked_in_at,
      status: attendance.status,
      minutes_late: attendance.minutes_late
    }
  });
});

// Helper: Validate QR Token
const validateQRToken = async (token) => {
  // 1. Check Redis cache first (fast path)
  const cached = await redis.get(`qr:${token}`);
  if (cached) {
    const data = JSON.parse(cached);
    if (new Date(data.expires_at) > new Date()) {
      return data;
    }
  }

  // 2. Check database (fallback)
  const session = await db.qrSessions.findUnique({
    where: { qr_token: token, is_active: true }
  });

  if (!session) {
    return null;
  }

  // 3. Check if expired
  if (new Date(session.expires_at) < new Date()) {
    // Mark as inactive
    await db.qrSessions.update({
      where: { id: session.id },
      data: { is_active: false }
    });
    return null;
  }

  return session;
};
```

---

## 4. Security Considerations

### 4.1 Token Expiration

- **Lifetime:** 60 seconds
- **Validation:** Server-side timestamp check
- **Refresh:** Automatic every 60 seconds

### 4.2 Rate Limiting

```javascript
// Backend: Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

const qrCheckinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute per IP
  message: 'Too many check-in attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.post('/student/attendance/checkin', qrCheckinLimiter, authenticate, ...);
```

### 4.3 Token Uniqueness

- Each token is unique (UUID + timestamp)
- Old tokens are deactivated immediately upon refresh
- Database unique constraint on `qr_token`

### 4.4 One-Time Use Prevention

While tokens can be used multiple times (for multiple students), the same student cannot check in twice:

```sql
-- Database constraint
UNIQUE(student_id, lecture_id)
```

### 4.5 Time-Based Validation

```javascript
// Backend: Lecture Time Validation
const isLectureActive = (lecture) => {
  const now = new Date();
  const lectureDate = new Date(lecture.lecture_date);
  const startTime = new Date(`${lecture.lecture_date}T${lecture.start_time}Z`);
  const endTime = new Date(`${lecture.lecture_date}T${lecture.end_time}Z`);

  return now >= startTime && now <= endTime;
};
```

---

## 5. Error Handling

### 5.1 Common Error Scenarios

```javascript
// Error Response Format
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}

// Error Codes:
// - QR_TOKEN_EXPIRED: Token has expired
// - QR_TOKEN_INVALID: Token format is invalid
// - LECTURE_NOT_FOUND: Lecture associated with token not found
// - ALREADY_CHECKED_IN: Student already checked in
// - LECTURE_NOT_ACTIVE: Lecture is not currently active
// - UNAUTHORIZED: Student not authenticated
```

### 5.2 Frontend Error Handling

```typescript
// Frontend: Check-in Error Handler
const handleCheckIn = async (token: string) => {
  try {
    const response = await fetch('/api/v1/student/attendance/checkin', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ qr_token: token })
    });

    const data = await response.json();

    if (!data.success) {
      switch (data.error) {
        case 'QR_TOKEN_EXPIRED':
          showError('QR code has expired. Please ask your lecturer for a new one.');
          break;
        case 'ALREADY_CHECKED_IN':
          showInfo('You have already checked in for this lecture.');
          break;
        default:
          showError(data.message || 'Failed to check in. Please try again.');
      }
      return;
    }

    // Success
    showSuccess('Attendance recorded successfully!');
    navigate('/student/attendance');
  } catch (error) {
    showError('Network error. Please check your connection and try again.');
  }
};
```

---

## 6. Performance Optimizations

### 6.1 Redis Caching

```javascript
// Cache QR sessions in Redis for fast lookup
await redis.setex(
  `qr:${token}`,
  60, // TTL matches expiration
  JSON.stringify({
    lecture_id: session.lecture_id,
    expires_at: session.expires_at.toISOString()
  })
);
```

### 6.2 Database Indexing

```sql
-- Index on qr_token for fast lookups
CREATE INDEX idx_qr_sessions_token ON qr_sessions(qr_token);

-- Index on expires_at for cleanup queries
CREATE INDEX idx_qr_sessions_expires ON qr_sessions(expires_at);
```

### 6.3 Background Cleanup

```javascript
// Scheduled job to clean up expired QR sessions
setInterval(async () => {
  await db.qrSessions.updateMany({
    where: {
      expires_at: { lt: new Date() },
      is_active: true
    },
    data: { is_active: false }
  });
}, 60000); // Run every minute
```

---

## 7. Testing the QR Flow

### 7.1 Test Scenarios

1. **Valid Check-in:**
   - Generate QR code
   - Scan within 60 seconds
   - Verify attendance recorded

2. **Expired Token:**
   - Generate QR code
   - Wait 60+ seconds
   - Attempt check-in
   - Verify error message

3. **Duplicate Check-in:**
   - Check in successfully
   - Attempt to check in again
   - Verify error message

4. **Late Check-in:**
   - Check in after lecture start time
   - Verify status is "LATE"

5. **QR Refresh:**
   - Generate QR code
   - Refresh after 30 seconds
   - Verify old token is invalid
   - Verify new token works

---

## 8. Monitoring & Logging

### 8.1 Logging Check-ins

```javascript
// Backend: Log check-in events
await db.audit_logs.create({
  data: {
    user_id: studentId,
    action: 'CHECK_IN',
    resource_type: 'ATTENDANCE',
    resource_id: attendance.id,
    ip_address: req.ip,
    user_agent: req.get('user-agent'),
    details: {
      lecture_id: lecture.id,
      qr_token: qr_token,
      status: status
    }
  }
});
```

### 8.2 Metrics

- QR codes generated per hour
- Check-ins per QR code
- Average check-in time
- Token expiration rate
- Failed check-in attempts
