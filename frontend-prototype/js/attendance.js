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
  const container = document.getElementById('attendance-container');

  if (!lectureId) {
    if (container) container.innerHTML = '<div class="alert alert-error">Invalid lecture ID</div>';
    return;
  }

  try {
    let attendanceRecords = [];
    let lectureInfo = null;
    if (Auth.getToken()) {
      const data = await MockAPI.getAttendanceForLecture(lectureId);
      lectureInfo = data.lecture;
      attendanceRecords = (data.attendance || []).map(a => ({
        id: a.id,
        student_id: a.student_id,
        checked_in_at: a.checked_in_at,
        status: a.status,
        minutes_late: a.minutes_late,
        student: { first_name: a.first_name, last_name: a.last_name }
      }));
    } else {
      attendanceRecords = [];
    }

    if (lectureInfo) {
      const titleEl = document.getElementById('lecture-title');
      const detailsEl = document.getElementById('lecture-details');
      if (titleEl) titleEl.textContent = lectureInfo.title || 'Lecture';
      if (detailsEl) {
        const d = lectureInfo.lecture_date ? formatDate(lectureInfo.lecture_date) : '';
        const t = lectureInfo.start_time && lectureInfo.end_time
          ? formatTime(lectureInfo.start_time) + ' - ' + formatTime(lectureInfo.end_time)
          : '';
        detailsEl.textContent = [d, t].filter(Boolean).join(' | ');
      }
    } else {
      await loadLectureDetails(lectureId);
    }

    displayAttendanceList(attendanceRecords, lectureId);
    const summary = calculateSummary(attendanceRecords);
    displaySummary(summary);
  } catch (err) {
    console.error(err);
    if (container) container.innerHTML = '<div class="alert alert-error">Failed to load attendance.</div>';
  }
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
          ${records.map(record => {
            const status = (record.status || 'PRESENT').toUpperCase();
            const statusClass = status.toLowerCase();
            const statusLabel = status === 'LATE' && record.minutes_late != null && record.minutes_late > 0
              ? `LATE (${record.minutes_late} min)`
              : status;
            return `
            <tr>
              <td>${record.student?.first_name || 'Student'} ${record.student?.last_name || ''}</td>
              <td>${record.student_id ?? ''}</td>
              <td>${new Date(record.checked_in_at).toLocaleString()}</td>
              <td>
                <span class="status-badge status-${statusClass}">${statusLabel}</span>
              </td>
            </tr>
          `;
          }).join('')}
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

