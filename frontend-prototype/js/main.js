/**
 * Main.js - Shared helpers and mock API functions
 * TODO: Replace mock API calls with real API endpoints from API_SPECIFICATION.md
 */

// Mock API base URL - replace with actual API endpoint when backend is ready
const API_BASE_URL = 'https://api.maynooth-attendance.com/api/v1';

/**
 * Authentication helpers
 */
export const Auth = {
  /**
   * Store user login info in localStorage
   * TODO: Replace with JWT token storage and proper auth flow
   */
  login(email, role) {
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userRole', role);
    localStorage.setItem('isLoggedIn', 'true');
  },

  /**
   * Check if user is logged in
   */
  isLoggedIn() {
    return localStorage.getItem('isLoggedIn') === 'true';
  },

  /**
   * Get current user role
   */
  getRole() {
    return localStorage.getItem('userRole');
  },

  /**
   * Get current user email
   */
  getEmail() {
    return localStorage.getItem('userEmail');
  },

  /**
   * Logout user
   */
  logout() {
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('studentId');
    localStorage.removeItem('isStudentLoggedIn');
  },

  /**
   * Store student login (for student check-in)
   */
  loginStudent(studentId) {
    localStorage.setItem('studentId', studentId);
    localStorage.setItem('isStudentLoggedIn', 'true');
  },

  /**
   * Check if student is logged in
   */
  isStudentLoggedIn() {
    return localStorage.getItem('isStudentLoggedIn') === 'true';
  },

  /**
   * Get student ID
   */
  getStudentId() {
    return localStorage.getItem('studentId');
  }
};

/**
 * Mock API functions
 * TODO: Replace all mock functions with actual fetch calls to API endpoints
 */
export const MockAPI = {
  /**
   * Mock login - validates credentials and returns user info
   * TODO: Replace with POST /auth/login
   */
  async login(email, password, role) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple validation (in real app, this goes to backend)
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Mock successful login
    return {
      success: true,
      token: 'mock_jwt_token_here',
      user: {
        email,
        role,
        first_name: role === 'LECTURER' ? 'John' : 'Jane',
        last_name: role === 'LECTURER' ? 'Doe' : 'Smith'
      }
    };
  },

  /**
   * Get lecturer dashboard timetable
   * TODO: Replace with GET /lecturer/dashboard
   */
  async getLecturerDashboard() {
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Load from mock data
    const response = await fetch('mocks/lectures.json');
    const lectures = await response.json();
    
    return {
      date: new Date().toISOString().split('T')[0],
      lectures,
      statistics: {
        total_lectures_today: lectures.length,
        total_students: 245,
        average_attendance_rate: 87.5
      }
    };
  },

  /**
   * Generate QR code for lecture
   * TODO: Replace with POST /lecturer/lectures/:id/qr/generate
   */
  async generateQR(lectureId) {
    await new Promise(resolve => setTimeout(resolve, 300));

    // Generate token in format: att_demo_<lectureId>_<timestamp>
    const timestamp = Math.floor(Date.now() / 1000);
    const qrToken = `att_demo_${lectureId}_${timestamp}`;
    
    // Create the full check-in URL that will be encoded in the QR code
    // Construct absolute URL so QR scanners can navigate to it
    const currentPath = window.location.pathname;
    const basePath = currentPath.substring(0, currentPath.lastIndexOf('/') + 1);
    const checkInUrl = `${window.location.origin}${basePath}student-checkin.html?token=${qrToken}`;
    
    // Generate QR code with the full URL (not just the token)
    // In production, this would come from the backend
    const qrCode = generateQRCodeDataURI(checkInUrl);
    
    const expiresAt = new Date(Date.now() + 60 * 1000); // 60 seconds from now
    
    return {
      qr_code: qrCode,
      qr_token: qrToken,
      qr_url: checkInUrl,
      expires_at: expiresAt.toISOString(),
      expires_in_seconds: 60,
      refresh_interval: 60
    };
  },

  /**
   * Refresh QR code
   * TODO: Replace with POST /lecturer/lectures/:id/qr/refresh
   */
  async refreshQR(lectureId) {
    return this.generateQR(lectureId);
  },

  /**
   * Student check-in
   * TODO: Replace with POST /student/attendance/checkin
   */
  async checkIn(qrToken, studentId) {
    await new Promise(resolve => setTimeout(resolve, 500));

    // Parse token to extract lecture ID and timestamp
    // Format: att_demo_<lectureId>_<timestamp>
    const tokenParts = qrToken.split('_');
    if (tokenParts.length < 4 || tokenParts[0] !== 'att' || tokenParts[1] !== 'demo') {
      return {
        success: false,
        error: 'LECTURE_NOT_FOUND',
        message: 'Invalid QR code or lecture not found.'
      };
    }

    const lectureId = parseInt(tokenParts[2]);
    const tokenTimestamp = parseInt(tokenParts[3]);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiryTime = 60; // 60 seconds

    // Check if token is expired
    if (currentTimestamp - tokenTimestamp > expiryTime) {
      return {
        success: false,
        error: 'QR_TOKEN_EXPIRED',
        message: 'The QR code has expired. Please ask your lecturer for a new one.'
      };
    }

    // Check if already checked in (using localStorage)
    const attendanceRecords = this.getAttendanceRecords();
    const existingRecord = attendanceRecords.find(
      r => r.student_id === studentId && r.lecture_id === lectureId
    );

    if (existingRecord) {
      return {
        success: false,
        error: 'ALREADY_CHECKED_IN',
        message: 'You have already checked in for this lecture.'
      };
    }

    // Create attendance record
    const attendanceRecord = {
      id: Date.now(),
      student_id: studentId,
      lecture_id: lectureId,
      qr_token: qrToken,
      checked_in_at: new Date().toISOString(),
      status: 'PRESENT',
      minutes_late: 0,
      student: {
        student_id: studentId,
        first_name: 'Student',
        last_name: 'Name'
      }
    };

    // Store in localStorage
    attendanceRecords.push(attendanceRecord);
    localStorage.setItem('attendanceRecords', JSON.stringify(attendanceRecords));

    return {
      success: true,
      message: 'Attendance recorded successfully',
      attendance: attendanceRecord
    };
  },

  /**
   * Get attendance records for a lecture
   * TODO: Replace with GET /lecturer/lectures/:id/attendance
   */
  getAttendanceRecords() {
    const stored = localStorage.getItem('attendanceRecords');
    return stored ? JSON.parse(stored) : [];
  },

  /**
   * Get attendance for specific lecture
   */
  getAttendanceForLecture(lectureId) {
    const allRecords = this.getAttendanceRecords();
    return allRecords.filter(r => r.lecture_id === lectureId);
  }
};

/**
 * Generate a simple QR code data URI using a library or placeholder
 * In production, QR codes would be generated server-side
 */
function generateQRCodeDataURI(text) {
  // For prototype, we'll use a QR code API or generate a simple placeholder
  // Using a free QR code API service for demonstration
  // In production, backend should generate QR codes using 'qrcode' npm package
  
  // Create a simple data URI placeholder with a pattern
  // Real implementation would use: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=...
  const qrAPIUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
  
  // Return the API URL (in production, backend should return base64 data URI)
  // For now, return a placeholder that works with the QR API
  return qrAPIUrl;
}

/**
 * Utility: Parse URL query parameters
 */
export function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

/**
 * Utility: Format time
 */
export function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  return `${hours}:${minutes}`;
}

/**
 * Utility: Format date
 */
export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

