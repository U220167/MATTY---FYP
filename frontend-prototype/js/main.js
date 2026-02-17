/**
 * Main.js - Shared helpers and mock API functions
 * TODO: Replace mock API calls with real API endpoints from API_SPECIFICATION.md
 */

// Live backend (Render)
const API_BASE_URL = 'https://matty-fyp-api.onrender.com/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

/**
 * Authentication helpers
 */
export const Auth = {
  login(email, role, userData = {}) {
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userRole', role);
    localStorage.setItem('isLoggedIn', 'true');
    if (userData.first_name) localStorage.setItem('userFirstName', userData.first_name);
    if (userData.last_name) localStorage.setItem('userLastName', userData.last_name);
    if (userData.student_id) localStorage.setItem('studentId', userData.student_id);
  },
  setToken(token) {
    if (token) localStorage.setItem('token', token);
  },
  getToken() {
    return localStorage.getItem('token');
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
    localStorage.removeItem('token');
    localStorage.removeItem('userFirstName');
    localStorage.removeItem('userLastName');
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
  async register(body) {
    const res = await fetch(API_BASE_URL + '/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },
  async login(email, password, role) {
    if (!email || !password) throw new Error('Email and password are required');
    const res = await fetch(API_BASE_URL + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    if (data.user.role !== role) throw new Error('Role does not match account');
    return { success: true, token: data.token, user: data.user };
  },

  async getLecturerDashboard() {
    const res = await fetch(API_BASE_URL + '/lecturer/lectures', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load lectures');
    const data = await res.json();
    const lectures = (data.lectures || []).map(l => ({
      id: l.id,
      title: l.title,
      lecture_date: typeof l.lecture_date === 'string' ? l.lecture_date.slice(0, 10) : l.lecture_date,
      start_time: l.start_time,
      end_time: l.end_time,
      location: l.location,
      status: l.status,
      module: { code: l.module_code || '', name: l.module_name || '' }
    }));
    return {
      date: new Date().toISOString().split('T')[0],
      lectures,
      statistics: { total_lectures_today: lectures.length, total_students: 0, average_attendance_rate: 0 }
    };
  },
  async createLecture(body) {
    const res = await fetch(API_BASE_URL + '/lecturer/lectures', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create lecture');
    }
    return await res.json();
  },

  async generateQR(lectureId) {
    const res = await fetch(API_BASE_URL + '/lecturer/lectures/' + lectureId + '/qr/generate', {
      method: 'POST',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to generate QR');
    return await res.json();
  },
  async refreshQR(lectureId) {
    return this.generateQR(lectureId);
  },

  async checkIn(qrToken) {
    const res = await fetch(API_BASE_URL + '/student/attendance/checkin', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ qr_token: qrToken })
    });
    const data = await res.json();
    if (!res.ok) return { success: false, error: data.error || 'CHECKIN_FAILED', message: data.message || 'Check-in failed' };
    return data;
  },

  getAttendanceRecords() {
    return [];
  },

  async getAttendanceForLecture(lectureId) {
    const res = await fetch(API_BASE_URL + '/lecturer/lectures/' + lectureId + '/attendance', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to load attendance');
    const data = await res.json();
    return { lecture: data.lecture, attendance: data.attendance || [] };
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
