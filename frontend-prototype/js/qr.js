/**
 * QR.js - QR code generation and countdown timer
 * TODO: Replace with API calls to:
 *   - POST /lecturer/lectures/:id/qr/generate
 *   - POST /lecturer/lectures/:id/qr/refresh
 *   - GET /lecturer/lectures/:id/qr/current
 */

import { MockAPI, Auth, getQueryParam } from './main.js';

let countdownInterval = null;
let currentQRData = null;
let lectureId = null;

/**
 * Initialize QR page
 */
export async function initQRPage() {
  // Get lecture ID from URL
  lectureId = parseInt(getQueryParam('lectureId'));
  
  if (!lectureId) {
    document.getElementById('qr-container').innerHTML = 
      '<div class="alert alert-error">Invalid lecture ID</div>';
    return;
  }

  // Load lecture details (would come from API in production)
  // TODO: Replace with GET /lecturer/lectures/:id
  await loadLectureDetails(lectureId);

  // Generate initial QR code
  await generateQRCode();

  // Set up refresh button
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', generateQRCode);
  }

  // Set up stop button
  const stopBtn = document.getElementById('stop-btn');
  if (stopBtn) {
    stopBtn.addEventListener('click', stopQRCode);
  }

  // Set up view attendance button
  const viewAttendanceBtn = document.getElementById('view-attendance-btn');
  if (viewAttendanceBtn) {
    viewAttendanceBtn.addEventListener('click', () => {
      window.location.href = `attendance-list.html?lectureId=${lectureId}`;
    });
  }
}

/**
 * Load lecture details
 */
async function loadLectureDetails(id) {
  // In production, fetch from API: GET /lecturer/lectures/:id
  // For now, we'll use mock data
  try {
    const response = await fetch('mocks/lectures.json');
    const lectures = await response.json();
    const lecture = lectures.find(l => l.id === id);

    if (lecture) {
      const titleElement = document.getElementById('lecture-title');
      const detailsElement = document.getElementById('lecture-details');
      
      if (titleElement) {
        titleElement.textContent = `${lecture.module.code} - ${lecture.title}`;
      }
      
      if (detailsElement) {
        const date = new Date(lecture.lecture_date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
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
  const [hours, minutes] = timeString.split(':');
  return `${hours}:${minutes}`;
}

/**
 * Generate QR code
 */
async function generateQRCode() {
  try {
    // Clear existing countdown
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    const qrContainer = document.getElementById('qr-display');
    if (qrContainer) {
      qrContainer.innerHTML = '<p>Generating QR code...</p>';
    }

    // Generate QR code
    // TODO: Replace with POST /lecturer/lectures/:id/qr/generate
    currentQRData = await MockAPI.generateQR(lectureId);

    // Display QR code (pass seconds so we don't rely on server/client clock sync)
    displayQRCode(currentQRData);

    // Count down from the server's expires_in_seconds so we avoid "expired instantly" from clock skew
    startCountdown(currentQRData.expires_in_seconds);

  } catch (error) {
    console.error('Error generating QR code:', error);
    const qrContainer = document.getElementById('qr-display');
    if (qrContainer) {
      qrContainer.innerHTML = '<div class="alert alert-error">Error generating QR code. Please try again.</div>';
    }
  }
}

/**
 * Display QR code
 */
function displayQRCode(qrData) {
  const qrContainer = document.getElementById('qr-display');
  if (!qrContainer) return;

  // Check if we're on localhost (phones can't access this)
  const isLocalhost = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' ||
                      window.location.hostname === '';

  let localhostWarning = '';
  let manualEntry = '';

  if (isLocalhost) {
    const port = window.location.port || '3000';
    localhostWarning = `
      <div class="alert alert-warning mb-2">
        <strong>⚠️ Note for Local Testing:</strong> Phones cannot scan localhost URLs.
        <br><br>
        <strong>Option 1 - Use your computer's IP address:</strong>
        <ol style="text-align: left; margin-top: 0.5rem;">
          <li>Find your computer's local IP address (e.g., 192.168.1.100)</li>
          <li>Use this URL instead: <code id="local-ip-url" style="word-break: break-all;"></code></li>
          <li>Manually enter this URL in your phone's browser</li>
        </ol>
      </div>
    `;

    manualEntry = `
      <div class="card mt-2" style="background-color: var(--bg-secondary);">
        <h3 style="font-size: 1rem; margin-bottom: 0.5rem;">Manual Check-In (Alternative)</h3>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
          If you can't scan the QR code, manually enter the token on the check-in page:
        </p>
        <div class="btn-group">
          <a href="student-checkin.html" class="btn btn-primary">Go to Check-In Page</a>
        </div>
        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.5rem;">
          Then enter token: <code style="font-size: 0.875rem;">${qrData.qr_token}</code>
        </p>
      </div>
    `;
  }

  qrContainer.innerHTML = `
    <div class="qr-container">
      ${localhostWarning}
      <img src="${qrData.qr_code}" alt="QR Code" class="qr-image" id="qr-image" />
      <div class="qr-token">Token: ${qrData.qr_token}</div>
      <div class="countdown" id="countdown">Expires in: <span id="countdown-value">--</span>s</div>
      ${manualEntry}
    </div>
  `;

  // Try to construct the local IP URL if on localhost
  if (isLocalhost) {
    const port = window.location.port || '3000';
    // We can't detect the actual local IP from JavaScript due to security,
    // but we can show instructions
    const localIpUrlElement = document.getElementById('local-ip-url');
    if (localIpUrlElement) {
      localIpUrlElement.textContent = `http://YOUR_IP:${port}/student-checkin.html?token=${qrData.qr_token}`;
    }
  }
}

/**
 * Start countdown timer using seconds-left from the API.
 * We count down locally so server/client clock differences don't make the QR look expired right away.
 */
function startCountdown(secondsLeft) {
  const countdownElement = document.getElementById('countdown-value');
  const countdownContainer = document.getElementById('countdown');
  
  if (!countdownElement || !countdownContainer) return;

  // Handle bad or missing value (e.g. old API response)
  let remaining = Math.max(0, Math.floor(Number(secondsLeft) || 0));

  const updateCountdown = () => {
    if (remaining <= 0) {
      countdownElement.textContent = '0';
      countdownContainer.textContent = 'Expired — Refresh to get a new code';
      countdownContainer.classList.add('expired');
      clearInterval(countdownInterval);
      
      const qrImage = document.getElementById('qr-image');
      if (qrImage) qrImage.style.opacity = '0.5';
    } else {
      countdownElement.textContent = remaining;
      remaining--;
    }
  };

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Stop QR code (clear countdown and disable)
 */
function stopQRCode() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  const countdownContainer = document.getElementById('countdown');
  if (countdownContainer) {
    countdownContainer.textContent = 'QR Code Stopped';
    countdownContainer.classList.add('expired');
  }

  const qrImage = document.getElementById('qr-image');
  if (qrImage) {
    qrImage.style.opacity = '0.5';
  }

  // TODO: In production, call POST /lecturer/lectures/:id/qr/stop to deactivate on backend
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (Auth.isLoggedIn() && Auth.getRole() === 'LECTURER') {
      initQRPage();
    } else {
      window.location.href = 'index.html';
    }
  });
} else {
  if (Auth.isLoggedIn() && Auth.getRole() === 'LECTURER') {
    initQRPage();
  } else {
    window.location.href = 'index.html';
  }
}

