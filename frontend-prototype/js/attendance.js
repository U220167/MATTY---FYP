/**
 * Attendance.js - Attendance list rendering
 * TODO: Replace with API call to GET /lecturer/lectures/:id/attendance
 */

import { MockAPI, Auth, getQueryParam, formatDate } from './main.js';

/**
 * Load and display attendance list
 */
export async function loadAttendanceList() {
  const lectureId = parseInt(getQueryParam('lectureId'));

  if (!lectureId) {
    document.getElementById('attendance-container').innerHTML = 
      '<div class="alert alert-error">Invalid lecture ID</div>';
    return;
  }

  // Load lecture details
  await loadLectureDetails(lectureId);

  // Get attendance records
  // TODO: Replace with GET /lecturer/lectures/:id/attendance API call
  const attendanceRecords = MockAPI.getAttendanceForLecture(lectureId);

  // Display attendance list
  displayAttendanceList(attendanceRecords, lectureId);

  // Calculate and display summary
  const summary = calculateSummary(attendanceRecords);
  displaySummary(summary);
}

/**
 * Load lecture details
 */
async function loadLectureDetails(id) {
  try {
    const response = await fetch('mocks/lectures.json');
    const lectures = await response.json();
    const lecture = lectures.find(l => l.id === id);

    if (lecture) {
      const titleElement = document.getElementById('lecture-title');
      if (titleElement) {
        titleElement.textContent = `${lecture.module.code} - ${lecture.title}`;
      }

      const detailsElement = document.getElementById('lecture-details');
      if (detailsElement) {
        const date = formatDate(lecture.lecture_date);
        detailsElement.textContent = `${date} | ${formatTime(lecture.start_time)} - ${formatTime(lecture.end_time)} | ${lecture.location}`;
      }
    }
  } catch (error) {
    console.error('Error loading lecture details:', error);
  }
}

/**
 * Format time helper
 */
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  return `${hours}:${minutes}`;
}

/**
 * Display attendance list
 */
function displayAttendanceList(records, lectureId) {
  const container = document.getElementById('attendance-table-container');
  if (!container) return;

  if (records.length === 0) {
    container.innerHTML = '<p>No attendance records yet.</p>';
    return;
  }

  // Get all enrolled students (for demo, we'll show only those who checked in)
  // In production, this would come from the API with enrolled students + attendance
  const tableHTML = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Student ID</th>
            <th>Checked In At</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${records.map(record => `
            <tr>
              <td>${record.student?.first_name || 'Student'} ${record.student?.last_name || ''}</td>
              <td>${record.student_id}</td>
              <td>${new Date(record.checked_in_at).toLocaleString()}</td>
              <td>
                <span class="status-badge status-${record.status.toLowerCase()}">
                  ${record.status}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = tableHTML;
}

/**
 * Calculate attendance summary
 */
function calculateSummary(records) {
  const total = records.length;
  let present = 0;
  let late = 0;
  let absent = 0;

  records.forEach(record => {
    if (record.status === 'PRESENT') {
      present++;
    } else if (record.status === 'LATE') {
      late++;
    } else {
      absent++;
    }
  });

  return {
    total,
    present,
    late,
    absent
  };
}

/**
 * Display summary statistics
 */
function displaySummary(summary) {
  const container = document.getElementById('attendance-summary');
  if (!container) return;

  container.innerHTML = `
    <div class="summary-stats">
      <div class="stat-card">
        <div class="stat-value">${summary.total}</div>
        <div class="stat-label">Total Check-ins</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.present}</div>
        <div class="stat-label">Present</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.late}</div>
        <div class="stat-label">Late</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${summary.absent}</div>
        <div class="stat-label">Absent</div>
      </div>
    </div>
  `;
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isLoggedIn() && Auth.getRole() === 'LECTURER') {
      loadAttendanceList();
    } else {
      window.location.href = 'index.html';
    }
  });
} else {
  if (Auth.isLoggedIn() && Auth.getRole() === 'LECTURER') {
    loadAttendanceList();
  } else {
    window.location.href = 'index.html';
  }
}

