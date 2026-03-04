# Maynooth Attendance Tool - Frontend

This folder contains the static frontend (`HTML`, `CSS`, `vanilla JS`) for the attendance app.

It connects to the live backend API.  
It is no longer a frontend-only mock.

## Folder structure

```text
frontend-prototype/
├── index.html
├── register.html
├── lecturer-dashboard.html
├── lecture-qr.html
├── student-checkin.html
├── attendance-list.html
├── css/
│   └── styles.css
├── js/
│   ├── main.js
│   ├── lecturer.js
│   ├── qr.js
│   ├── student.js
│   └── attendance.js
└── mocks/
    ├── lectures.json
    └── users.json
```

Note on naming: `MockAPI` in `js/main.js` is a legacy name from early work.  
Most methods in it now call real backend endpoints.

## Run locally

From `frontend-prototype`:

```bash
python -m http.server 3000
```

Then open `http://localhost:3000`.

You can also use:

```bash
npx http-server . -c-1 -p 3000
```

## Current behavior (important)

- Login/register calls live backend auth endpoints.
- Lecturer dashboard loads lectures from backend when logged in.
- QR generation is backend-driven.
- QR expiry is **30 seconds**.
- Stop QR button now calls backend to deactivate active QR sessions.
- Student check-in posts to backend and receives server status.
- Attendance list is loaded from backend for the selected lecture.

## Quick test flow

1. Open `index.html` and log in as lecturer.
2. Open a lecture and click **Generate QR**.
3. Confirm token + countdown appear on `lecture-qr.html`.
4. Click **Stop QR Code**.
5. Try check-in with that token from `student-checkin.html`:
   - expected: token is rejected as expired/invalid.
6. Generate a new QR and check in as student.
7. Open attendance list and confirm the new row appears.

## Localhost QR note

When running on `localhost`, phones cannot scan and open `localhost` directly.

Use one of these:

- open check-in page manually on the same machine, or
- replace `YOUR_IP` in the local URL shown on the QR page and open it on the phone.

## Auth/session keys in localStorage

The frontend stores:

- `token`
- `userEmail`
- `userRole`
- `isLoggedIn`
- `studentId`
- `isStudentLoggedIn`

These are used for page guards and API headers.

## Known legacy bits still in this folder

- `mocks/` files are still present for fallback/dev paths.
- `qr.js` still reads mock lecture metadata for display text on the QR page.
- Some helper names still reflect older prototype structure.

These do not block normal API-backed usage.

