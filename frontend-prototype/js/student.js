/**
 * Student.js - Student check-in logic
 * TODO: Replace with API calls to POST /student/attendance/checkin
 */

import { MockAPI, Auth, getQueryParam } from './main.js';

let qrToken = null;

/**
 * Initialize student check-in page
 */
export function initCheckInPage() {
  // Get token from URL
  qrToken = getQueryParam('token');

  // Display token or show manual entry
  const tokenDisplay = document.getElementById('token-display');
  const manualTokenSection = document.getElementById('manual-token-section');
  
  if (!qrToken) {
    // No token in URL - show manual entry option
    if (tokenDisplay) {
      tokenDisplay.textContent = 'No token found in URL';
      tokenDisplay.classList.remove('alert-info');
      tokenDisplay.classList.add('alert-warning');
    }
    if (manualTokenSection) {
      manualTokenSection.classList.remove('hidden');
    }
    
    // Set up manual token entry
    const useManualTokenBtn = document.getElementById('use-manual-token-btn');
    if (useManualTokenBtn) {
      useManualTokenBtn.addEventListener('click', () => {
        const manualTokenInput = document.getElementById('manual-token-input');
        if (manualTokenInput && manualTokenInput.value.trim()) {
          qrToken = manualTokenInput.value.trim();
          
          // Update the URL to include the token so it persists
          const url = new URL(window.location);
          url.searchParams.set('token', qrToken);
          window.history.pushState({}, '', url);
          
          // Update display
          if (tokenDisplay) {
            tokenDisplay.textContent = `Token: ${qrToken}`;
            tokenDisplay.classList.remove('alert-warning');
            tokenDisplay.classList.add('alert-info');
          }
          if (manualTokenSection) {
            manualTokenSection.classList.add('hidden');
          }
          
          // Now that we have a token, set up the check-in flow
          setupCheckInFlow();
          
          // If user is already logged in, show check-in form immediately
          if (Auth.isStudentLoggedIn()) {
            showCheckInForm();
          }
        }
      });
    }
    
    // Also allow Enter key to submit token
    const manualTokenInput = document.getElementById('manual-token-input');
    if (manualTokenInput) {
      manualTokenInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (useManualTokenBtn) {
            useManualTokenBtn.click();
          }
        }
      });
    }
  } else {
    // Token found in URL
    if (tokenDisplay) {
      tokenDisplay.textContent = `Token: ${qrToken}`;
      tokenDisplay.classList.remove('alert-warning');
      tokenDisplay.classList.add('alert-info');
    }
    if (manualTokenSection) {
      manualTokenSection.classList.add('hidden');
    }
  }

  // Set up the check-in flow
  setupCheckInFlow();
}

/**
 * Set up the check-in flow (login and check-in forms)
 */
function setupCheckInFlow() {
  // Set up login form submission (only if not already set up)
  const loginForm = document.getElementById('student-login-form');
  if (loginForm && !loginForm.dataset.listenerAttached) {
    loginForm.addEventListener('submit', handleStudentLogin);
    loginForm.dataset.listenerAttached = 'true';
  }

  // Set up check-in form submission (only if not already set up)
  const checkInForm = document.getElementById('checkin-form');
  if (checkInForm && !checkInForm.dataset.listenerAttached) {
    checkInForm.addEventListener('submit', handleCheckIn);
    checkInForm.dataset.listenerAttached = 'true';
  }

  // Set up logout button (only if not already set up)
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn && !logoutBtn.dataset.listenerAttached) {
    logoutBtn.addEventListener('click', () => {
      Auth.logout();
      localStorage.removeItem('isStudentLoggedIn');
      window.location.reload();
    });
    logoutBtn.dataset.listenerAttached = 'true';
  }

  // If no token yet, wait for manual entry
  if (!qrToken) {
    // Still show login form so user can enter token first
    if (!Auth.isStudentLoggedIn()) {
      showLoginForm();
    }
    return;
  }

  // Check if student is logged in
  if (!Auth.isStudentLoggedIn()) {
    showLoginForm();
  } else {
    showCheckInForm();
  }
}

/**
 * Show login form
 */
function showLoginForm() {
  const loginSection = document.getElementById('login-section');
  const checkinSection = document.getElementById('checkin-section');
  
  if (loginSection) loginSection.classList.remove('hidden');
  if (checkinSection) checkinSection.classList.add('hidden');
}

/**
 * Show check-in form
 */
function showCheckInForm() {
  const loginSection = document.getElementById('login-section');
  const checkinSection = document.getElementById('checkin-section');
  const studentInfo = document.getElementById('student-info');
  
  if (loginSection) loginSection.classList.add('hidden');
  if (checkinSection) checkinSection.classList.remove('hidden');
  
  if (studentInfo) {
    const studentId = Auth.getStudentId();
    const email = Auth.getEmail();
    studentInfo.textContent = studentId ? `Logged in as: ${studentId}` : `Logged in as: ${email}`;
  }
}

/**
 * Handle student login (email + password for live API)
 */
async function handleStudentLogin(e) {
  e.preventDefault();

  const emailInput = document.getElementById('student-email');
  const passwordInput = document.getElementById('password');
  const errorDiv = document.getElementById('login-error');

  const email = emailInput?.value.trim();
  const password = passwordInput?.value;

  if (!email) {
    showLoginError('Email is required');
    return;
  }
  if (!password) {
    showLoginError('Password is required');
    return;
  }

  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
  }

  try {
    const result = await MockAPI.login(email, password, 'STUDENT');
    if (result.success) {
      Auth.setToken(result.token);
      Auth.login(email, 'STUDENT', result.user);
      if (result.user.student_id) Auth.loginStudent(result.user.student_id);
      if (qrToken) showCheckInForm();
      else showLoginForm();
    }
  } catch (error) {
    showLoginError(error.message || 'Login failed. Please try again.');
  }
}

/**
 * Show login error
 */
function showLoginError(message) {
  const errorDiv = document.getElementById('login-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

/**
 * Handle check-in submission
 */
async function handleCheckIn(e) {
  e.preventDefault();

  const errorDiv = document.getElementById('checkin-error');
  const successDiv = document.getElementById('checkin-success');

  if (!Auth.getToken()) {
    showCheckInError('Please log in first');
    return;
  }

  if (!qrToken) qrToken = getQueryParam('token');
  if (!qrToken) {
    showCheckInError('Please enter a valid QR token first');
    return;
  }

  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
  }
  if (successDiv) {
    successDiv.classList.add('hidden');
  }

  // Show loading state
  const submitBtn = document.getElementById('checkin-submit-btn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking in...';
  }

  try {
    // Submit check-in
    // TODO: Replace with POST /student/attendance/checkin
    const result = await MockAPI.checkIn(qrToken);

    if (result.success) {
      // Show success message
      showCheckInSuccess(result);
    } else {
      // Show error based on error code
      let errorMessage = result.message || 'Check-in failed';
      
      if (result.error === 'QR_TOKEN_EXPIRED') {
        errorMessage = 'The QR code has expired. Please ask your lecturer for a new one.';
      } else if (result.error === 'ALREADY_CHECKED_IN') {
        errorMessage = 'You have already checked in for this lecture.';
      } else if (result.error === 'LECTURE_NOT_FOUND') {
        errorMessage = 'Invalid QR code or lecture not found.';
      }

      showCheckInError(errorMessage);
    }
  } catch (error) {
    console.error('Check-in error:', error);
    showCheckInError('An error occurred. Please try again.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Attendance';
    }
  }
}

/**
 * Show check-in error
 */
function showCheckInError(message) {
  const errorDiv = document.getElementById('checkin-error');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
  }
}

/**
 * Show check-in success
 */
function showCheckInSuccess(result) {
  const successDiv = document.getElementById('checkin-success');
  const checkinForm = document.getElementById('checkin-form');
  
  if (checkinForm) {
    checkinForm.classList.add('hidden');
  }

  if (successDiv) {
    const attendance = result.attendance;
    const checkInTime = new Date(attendance.checked_in_at).toLocaleString();
    
    successDiv.innerHTML = `
      <h2>✓ Attendance Recorded Successfully</h2>
      <p>Check-in Time: ${checkInTime}</p>
      <p>Status: ${attendance.status}</p>
      <div class="btn-group mt-2">
        <a href="index.html" class="btn btn-primary">Done</a>
      </div>
    `;
    successDiv.classList.remove('hidden');
  }
}

/**
 * Show general error
 */
function showError(message) {
  const container = document.getElementById('checkin-container');
  if (container) {
    container.innerHTML = `<div class="alert alert-error">${message}</div>`;
  }
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckInPage);
} else {
  initCheckInPage();
}

