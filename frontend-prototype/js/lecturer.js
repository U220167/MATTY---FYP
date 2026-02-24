/**
 * Lecturer.js - Lecturer dashboard logic with timetable view
 * TODO: Replace mock data with API calls to:
 *   - GET /lecturer/dashboard?date=YYYY-MM-DD
 *   - POST /lecturer/lectures
 *   - DELETE /lecturer/lectures/:id
 */

import { MockAPI, Auth, formatTime, formatDate } from './main.js';

let dashboardData = null;
let currentDate = new Date();
let calendarMonth = new Date(); // First of displayed month
let allLectures = [];

/**
 * Initialize dashboard
 */
export async function initDashboard() {
  if (Auth.getToken()) {
    try {
      const data = await MockAPI.getLecturerDashboard();
      allLectures = data.lectures || [];
    } catch (err) {
      console.error('Failed to load lectures from API', err);
      loadLectures();
    }
  } else {
    loadLectures();
  }

  setupEventListeners();
  await loadDashboard();
}

/**
 * Load lectures from localStorage or initialize with mock data
 */
function loadLectures() {
  const stored = localStorage.getItem('lecturer_lectures');
  if (stored) {
    allLectures = JSON.parse(stored);
  } else {
    // Initialize with mock data
    allLectures = [
      {
        id: 42,
        title: "Database Systems",
        module: { code: "CS301", name: "Database Systems" },
        lecture_date: getDateString(0), // Today
        start_time: "09:00:00",
        end_time: "10:30:00",
        location: "Room A123",
        status: "SCHEDULED"
      },
      {
        id: 43,
        title: "Web Development",
        module: { code: "CS302", name: "Web Development" },
        lecture_date: getDateString(0), // Today
        start_time: "14:00:00",
        end_time: "15:30:00",
        location: "Room B456",
        status: "SCHEDULED"
      },
      {
        id: 44,
        title: "Data Structures",
        module: { code: "CS201", name: "Data Structures" },
        lecture_date: getDateString(1), // Tomorrow
        start_time: "10:00:00",
        end_time: "11:30:00",
        location: "Room C789",
        status: "SCHEDULED"
      }
    ];
    saveLectures();
  }
}

/**
 * Save lectures to localStorage
 */
function saveLectures() {
  localStorage.setItem('lecturer_lectures', JSON.stringify(allLectures));
}

/**
 * Get date string for N days from today
 */
function getDateString(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Create lecture button
  const createBtn = document.getElementById('create-lecture-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      openCreateModal();
    });
  }

  // Logout - clear token and go to login
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
      window.location.href = 'index.html';
    });
  }

  // Close modal buttons
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelBtn = document.getElementById('cancel-create-btn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeCreateModal();
    });
  }
  if (cancelBtn) {
    cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeCreateModal();
    });
  }

  // Create lecture form
  const createForm = document.getElementById('create-lecture-form');
  if (createForm) {
    createForm.addEventListener('submit', handleCreateLecture);
  }

  // Repeat weekly checkbox toggle
  const repeatCheckbox = document.getElementById('lecture-repeat-weekly');
  const repeatWeeksGroup = document.getElementById('repeat-weeks-group');
  if (repeatCheckbox && repeatWeeksGroup) {
    repeatCheckbox.addEventListener('change', () => {
      repeatWeeksGroup.classList.toggle('hidden', !repeatCheckbox.checked);
    });
  }

  // Click outside modal to close
  const modal = document.getElementById('create-lecture-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeCreateModal();
    });
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) modalContent.addEventListener('click', (e) => e.stopPropagation());
  }

  // Edit lecture modal
  const closeEditBtn = document.getElementById('close-edit-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  if (closeEditBtn) closeEditBtn.addEventListener('click', closeEditModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);
  const editForm = document.getElementById('edit-lecture-form');
  if (editForm) editForm.addEventListener('submit', handleEditLecture);
  const editModal = document.getElementById('edit-lecture-modal');
  if (editModal) {
    editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });
    const editContent = editModal.querySelector('.modal-content');
    if (editContent) editContent.addEventListener('click', (e) => e.stopPropagation());
  }
}

/**
 * Open create lecture modal
 */
function openCreateModal() {
  const modal = document.getElementById('create-lecture-modal');
  if (modal) {
    modal.classList.remove('hidden');
    // Set default date to current selected date
    const dateInput = document.getElementById('lecture-date');
    if (dateInput) {
      dateInput.value = currentDate.toISOString().split('T')[0];
    }
  }
}

/**
 * Close create lecture modal
 */
function closeCreateModal() {
  const modal = document.getElementById('create-lecture-modal');
  if (modal) {
    modal.classList.add('hidden');
    const form = document.getElementById('create-lecture-form');
    if (form) {
      form.reset();
    }
    const repeatCheckbox = document.getElementById('lecture-repeat-weekly');
    const repeatWeeksGroup = document.getElementById('repeat-weeks-group');
    if (repeatCheckbox && repeatWeeksGroup) {
      repeatWeeksGroup.classList.add('hidden');
    }
    const errorDiv = document.getElementById('create-lecture-error');
    if (errorDiv) {
      errorDiv.classList.add('hidden');
      errorDiv.textContent = '';
    }
  }
}

/**
 * Open edit lecture modal and load lecture data
 */
window.openEditModal = async function (lectureId) {
  const modal = document.getElementById('edit-lecture-modal');
  const errorDiv = document.getElementById('edit-lecture-error');
  if (errorDiv) { errorDiv.classList.add('hidden'); errorDiv.textContent = ''; }
  let lecture = null;
  if (Auth.getToken()) {
    try {
      lecture = await MockAPI.getLecture(lectureId);
    } catch (e) {
      if (errorDiv) { errorDiv.textContent = 'Failed to load lecture.'; errorDiv.classList.remove('hidden'); }
      return;
    }
  } else {
    lecture = allLectures.find(l => l.id === lectureId);
  }
  if (!lecture) {
    if (errorDiv) { errorDiv.textContent = 'Lecture not found.'; errorDiv.classList.remove('hidden'); }
    return;
  }
  const dateStr = typeof lecture.lecture_date === 'string' ? lecture.lecture_date.slice(0, 10) : (lecture.lecture_date?.toISOString?.()?.slice(0, 10) || '');
  const startTime = lecture.start_time ? String(lecture.start_time).slice(0, 5) : '';
  const endTime = lecture.end_time ? String(lecture.end_time).slice(0, 5) : '';
  document.getElementById('edit-lecture-id').value = lecture.id;
  document.getElementById('edit-lecture-title').value = lecture.title || '';
  document.getElementById('edit-lecture-date').value = dateStr;
  document.getElementById('edit-lecture-start-time').value = startTime;
  document.getElementById('edit-lecture-end-time').value = endTime;
  document.getElementById('edit-lecture-location').value = lecture.location || '';
  document.getElementById('edit-lecture-verification-question').value = lecture.verification_question || '';
  document.getElementById('edit-lecture-verification-answer').value = lecture.verification_answer || '';
  if (modal) modal.classList.remove('hidden');
};

/**
 * Close edit lecture modal
 */
function closeEditModal() {
  const modal = document.getElementById('edit-lecture-modal');
  if (modal) modal.classList.add('hidden');
  const form = document.getElementById('edit-lecture-form');
  if (form) form.reset();
  const errorDiv = document.getElementById('edit-lecture-error');
  if (errorDiv) { errorDiv.classList.add('hidden'); errorDiv.textContent = ''; }
}

/**
 * Handle edit lecture form submission
 */
async function handleEditLecture(e) {
  e.preventDefault();
  const errorDiv = document.getElementById('edit-lecture-error');
  const id = parseInt(document.getElementById('edit-lecture-id').value, 10);
  const title = document.getElementById('edit-lecture-title').value.trim();
  const date = document.getElementById('edit-lecture-date').value;
  const startTime = document.getElementById('edit-lecture-start-time').value;
  const endTime = document.getElementById('edit-lecture-end-time').value;
  const location = document.getElementById('edit-lecture-location').value.trim();
  const verificationQuestion = document.getElementById('edit-lecture-verification-question').value.trim();
  const verificationAnswer = document.getElementById('edit-lecture-verification-answer').value.trim();
  if (!title || !date || !startTime || !endTime || !location) {
    if (errorDiv) { errorDiv.textContent = 'Please fill in all required fields.'; errorDiv.classList.remove('hidden'); }
    return;
  }
  if (verificationQuestion && !verificationAnswer) {
    if (errorDiv) { errorDiv.textContent = 'Please provide an answer when you set a verification question.'; errorDiv.classList.remove('hidden'); }
    return;
  }
  if (startTime >= endTime) {
    if (errorDiv) { errorDiv.textContent = 'End time must be after start time.'; errorDiv.classList.remove('hidden'); }
    return;
  }
  const startTimeStr = startTime.length === 5 ? startTime + ':00' : startTime;
  const endTimeStr = endTime.length === 5 ? endTime + ':00' : endTime;
  try {
    if (Auth.getToken()) {
      await MockAPI.updateLecture(id, {
        title,
        lecture_date: date,
        start_time: startTimeStr,
        end_time: endTimeStr,
        location,
        verification_question: verificationQuestion || null,
        verification_answer: verificationAnswer || null
      });
      const idx = allLectures.findIndex(l => l.id === id);
      if (idx !== -1) {
        allLectures[idx] = { ...allLectures[idx], title, lecture_date: date, start_time: startTimeStr, end_time: endTimeStr, location, verification_question: verificationQuestion || null, verification_answer: verificationAnswer || null };
      }
    } else {
      const idx = allLectures.findIndex(l => l.id === id);
      if (idx !== -1) {
        allLectures[idx] = { ...allLectures[idx], title, lecture_date: date, start_time: startTimeStr, end_time: endTimeStr, location, verification_question: verificationQuestion || null, verification_answer: verificationAnswer || null };
      }
      saveLectures();
    }
    closeEditModal();
    await loadDashboard();
  } catch (err) {
    console.error('Error updating lecture:', err);
    if (errorDiv) { errorDiv.textContent = err.message || 'Failed to update lecture.'; errorDiv.classList.remove('hidden'); }
  }
}

/**
 * Handle create lecture form submission
 */
async function handleCreateLecture(e) {
  e.preventDefault();

  const errorDiv = document.getElementById('create-lecture-error');
  
  // Get form values
  const title = document.getElementById('lecture-title').value.trim();
  const moduleCode = document.getElementById('lecture-module-code').value.trim();
  const moduleName = document.getElementById('lecture-module-name').value.trim();
  const date = document.getElementById('lecture-date').value;
  const startTime = document.getElementById('lecture-start-time').value;
  const endTime = document.getElementById('lecture-end-time').value;
  const location = document.getElementById('lecture-location').value.trim();
  const repeatWeekly = document.getElementById('lecture-repeat-weekly')?.checked ?? false;
  const repeatWeeks = repeatWeekly
    ? Math.min(52, Math.max(1, parseInt(document.getElementById('lecture-repeat-weeks')?.value || '1', 10)))
    : 1;
  const verificationQuestion = document.getElementById('lecture-verification-question')?.value.trim() || '';
  const verificationAnswer = document.getElementById('lecture-verification-answer')?.value.trim() || '';

  // Validation: if question is set, answer is required
  if (verificationQuestion && !verificationAnswer) {
    if (errorDiv) {
      errorDiv.textContent = 'Please provide an answer when you set a verification question.';
      errorDiv.classList.remove('hidden');
    }
    return;
  }
  if (!title || !moduleCode || !moduleName || !date || !startTime || !endTime || !location) {
    if (errorDiv) {
      errorDiv.textContent = 'Please fill in all fields';
      errorDiv.classList.remove('hidden');
    }
    return;
  }

  // Validate time
  if (startTime >= endTime) {
    if (errorDiv) {
      errorDiv.textContent = 'End time must be after start time';
      errorDiv.classList.remove('hidden');
    }
    return;
  }

  try {
    const startTimeStr = startTime.length === 5 ? startTime + ':00' : startTime;
    const endTimeStr = endTime.length === 5 ? endTime + ':00' : endTime;
    if (Auth.getToken()) {
      const body = {
        title,
        lecture_date: date,
        start_time: startTimeStr,
        end_time: endTimeStr,
        location,
        repeat_weeks: repeatWeeks,
        verification_question: verificationQuestion || undefined,
        verification_answer: verificationAnswer || undefined
      };
      const created = await MockAPI.createLecture(body);
      const list = Array.isArray(created) ? created : (created.lectures || [created]);
      list.forEach(l => allLectures.push({
        id: l.id,
        title: l.title,
        lecture_date: l.lecture_date,
        start_time: l.start_time,
        end_time: l.end_time,
        location: l.location,
        status: l.status || 'SCHEDULED',
        verification_question: l.verification_question,
        verification_answer: l.verification_answer,
        module: { code: moduleCode, name: moduleName }
      }));
    } else {
      for (let w = 0; w < repeatWeeks; w++) {
        const d = new Date(date);
        d.setDate(d.getDate() + w * 7);
        const dateStr = d.toISOString().slice(0, 10);
        allLectures.push({
          id: Date.now() + w,
          title,
          module: { code: moduleCode, name: moduleName },
          lecture_date: dateStr,
          start_time: startTimeStr,
          end_time: endTimeStr,
          location,
          status: 'SCHEDULED',
          verification_question: verificationQuestion || null,
          verification_answer: verificationAnswer || null
        });
      }
      saveLectures();
    }

    closeCreateModal();
    await loadDashboard();

  } catch (error) {
    console.error('Error creating lecture:', error);
    if (errorDiv) {
      errorDiv.textContent = 'Error creating lecture. Please try again.';
      errorDiv.classList.remove('hidden');
    }
  }
}

/**
 * Load and display lecturer dashboard
 */
export async function loadDashboard() {
  try {
    // Show loading state
    const timetableContainer = document.getElementById('timetable-container');
    if (timetableContainer) {
      timetableContainer.innerHTML = '<p>Loading...</p>';
    }

    // Get lectures for current date
    const dateString = currentDate.toISOString().split('T')[0];
    const dayLectures = allLectures.filter(l => l.lecture_date === dateString);

    // Display calendar
    displayCalendar();

    // Display timetable
    displayTimetable(dayLectures);

    // Display statistics
    displayStatistics(dayLectures);

  } catch (error) {
    console.error('Error loading dashboard:', error);
    const timetableContainer = document.getElementById('timetable-container');
    if (timetableContainer) {
      timetableContainer.innerHTML = '<div class="alert alert-error">Error loading dashboard. Please try again.</div>';
    }
  }
}

/**
 * Display month calendar with navigation
 */
function displayCalendar() {
  const container = document.getElementById('day-navigation');
  if (!container) return;

  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayStr = new Date().toISOString().split('T')[0];
  const selectedStr = currentDate.toISOString().split('T')[0];

  // Build calendar grid (6 weeks)
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const startDate = new Date(firstOfMonth);
  startDate.setDate(startDate.getDate() - startOffset);

  const weeks = [];
  let cellDate = new Date(startDate);
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cellDate.toISOString().split('T')[0];
      const isCurrentMonth = cellDate.getMonth() === month;
      const lectureCount = allLectures.filter(l => l.lecture_date === dateStr).length;
      week.push({
        dateStr,
        dayNum: cellDate.getDate(),
        isCurrentMonth,
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedStr,
        hasLectures: lectureCount > 0,
        lectureCount
      });
      cellDate.setDate(cellDate.getDate() + 1);
    }
    weeks.push(week);
  }

  container.innerHTML = `
    <div class="calendar-container">
      <div class="calendar-header">
        <button type="button" class="btn btn-outline calendar-nav-btn" id="calendar-prev" title="Previous month">←</button>
        <div class="calendar-month-title">
          <button type="button" class="btn btn-outline calendar-today-btn" id="calendar-today">Today</button>
          <h3 class="calendar-month-label">${monthNames[month]} ${year}</h3>
        </div>
        <button type="button" class="btn btn-outline calendar-nav-btn" id="calendar-next" title="Next month">→</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekday-header">
          ${dayNames.map(d => `<span class="calendar-weekday">${d}</span>`).join('')}
        </div>
        ${weeks.map(week => `
          <div class="calendar-week">
            ${week.map(day => `
              <button type="button" class="calendar-day ${!day.isCurrentMonth ? 'other-month' : ''} ${day.isToday ? 'today' : ''} ${day.isSelected ? 'selected' : ''}"
                      data-date="${day.dateStr}">
                <span class="calendar-day-num">${day.dayNum}</span>
                ${day.hasLectures ? `<span class="calendar-day-lectures" title="${day.lectureCount} lecture(s)">${day.lectureCount}</span>` : ''}
              </button>
            `).join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Event listeners
  document.getElementById('calendar-prev')?.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() - 1);
    displayCalendar();
  });
  document.getElementById('calendar-next')?.addEventListener('click', () => {
    calendarMonth.setMonth(calendarMonth.getMonth() + 1);
    displayCalendar();
  });
  document.getElementById('calendar-today')?.addEventListener('click', () => {
    calendarMonth = new Date();
    currentDate = new Date();
    displayCalendar();
    loadDashboard();
  });
  container.querySelectorAll('.calendar-day').forEach(btn => {
    btn.addEventListener('click', () => {
      const dateStr = btn.getAttribute('data-date');
      currentDate = new Date(dateStr);
      loadDashboard();
    });
  });
}

/**
 * Display timetable in a structured format
 */
function displayTimetable(lectures) {
  const container = document.getElementById('timetable-container');
  if (!container) return;

  const dateString = currentDate.toISOString().split('T')[0];
  const formattedDate = formatDate(dateString);

  if (!lectures || lectures.length === 0) {
    container.innerHTML = `
      <h2 class="mb-2">Schedule - ${formattedDate}</h2>
      <p>No lectures scheduled for this day.</p>
    `;
    return;
  }

  // Sort lectures by start time
  const sortedLectures = [...lectures].sort((a, b) => {
    return a.start_time.localeCompare(b.start_time);
  });

  container.innerHTML = `
    <h2 class="mb-2">Schedule - ${formattedDate}</h2>
    <div class="timetable-view">
      <div class="timetable-time-slot" style="border-right: none; font-weight: 600;">Time</div>
      <div style="font-weight: 600; padding: 0.75rem;">Lectures</div>
      ${sortedLectures.map(lecture => `
        <div class="timetable-time-slot">
          ${formatTime(lecture.start_time)}<br>
          ${formatTime(lecture.end_time)}
        </div>
        <div class="timetable-lectures">
          <div class="timetable-lecture-item">
            <div class="timetable-lecture-header">
              <div>
                <div class="timetable-lecture-time">${formatTime(lecture.start_time)} - ${formatTime(lecture.end_time)}</div>
                <div class="timetable-lecture-title">${lecture.title}</div>
                <div class="timetable-lecture-module">📚 ${lecture.module.code} - ${lecture.module.name}</div>
                <div class="timetable-lecture-location">📍 ${lecture.location}</div>
              </div>
            </div>
            <div class="timetable-lecture-actions">
              <button class="btn btn-primary" onclick="generateQR(${lecture.id})">Generate QR</button>
              <a href="attendance-list.html?lectureId=${lecture.id}" class="btn btn-outline">View Attendance</a>
              <button class="btn btn-outline" onclick="openEditModal(${lecture.id})">Edit</button>
              <button class="delete-lecture-btn" onclick="deleteLecture(${lecture.id})">Delete</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

/**
 * Display statistics
 */
function displayStatistics(lectures) {
  const statsContainer = document.getElementById('statistics-container');
  if (!statsContainer) return;

  const dateString = currentDate.toISOString().split('T')[0];
  const dayLectures = allLectures.filter(l => l.lecture_date === dateString);
  const totalLectures = allLectures.length;

  statsContainer.innerHTML = `
    <div class="summary-stats">
      <div class="stat-card">
        <div class="stat-value">${dayLectures.length}</div>
        <div class="stat-label">Lectures Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${totalLectures}</div>
        <div class="stat-label">Total Lectures</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${lectures.filter(l => l.status === 'ACTIVE').length}</div>
        <div class="stat-label">Active Sessions</div>
      </div>
    </div>
  `;
}

/**
 * Delete a lecture
 * This function is exposed globally for onclick handlers
 */
window.deleteLecture = async function(lectureId) {
  if (!confirm('Are you sure you want to delete this lecture? This action cannot be undone.')) {
    return;
  }

  try {
    // TODO: Replace with DELETE /lecturer/lectures/:id API call
    allLectures = allLectures.filter(l => l.id !== lectureId);
    saveLectures();

    // Reload dashboard
    await loadDashboard();

  } catch (error) {
    console.error('Error deleting lecture:', error);
    alert('Error deleting lecture. Please try again.');
  }
};

/**
 * Navigate to QR generation page
 * This function is exposed globally for onclick handlers
 */
window.generateQR = function(lectureId) {
  window.location.href = `lecture-qr.html?lectureId=${lectureId}`;
};

// Initialize dashboard on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isLoggedIn() && Auth.getRole() === 'LECTURER') {
      initDashboard();
    } else {
      window.location.href = 'index.html';
    }
  });
} else {
  if (Auth.isLoggedIn() && Auth.getRole() === 'LECTURER') {
    initDashboard();
  } else {
    window.location.href = 'index.html';
  }
}
