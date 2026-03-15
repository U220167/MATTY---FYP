# (Matty) The Maynooth Attendance Tool

Web app for lecturers to record student attendance using time-limited QR codes. Students check in by scanning the QR or entering the token manually.

Live site: https://matty-fyp.onrender.com

---

## Tech stack

- **Frontend**: Static HTML, CSS, vanilla JavaScript (ES modules). No framework.
- **Backend**: Node.js, Express, JWT (access + refresh), bcrypt, PostgreSQL.
- **QR**: `qrcode` library. Tokens expire after 30 seconds by default (configurable 15–120 per lecture).

---

## Project structure

```
maynooth-attendance-tool/
├── backend/                 # Express API
│   ├── src/
│   │   ├── server.js
│   │   ├── routes/          # auth, lecturer, student
│   │   ├── middleware/
│   │   └── config/
│   └── migrations/
├── frontend-prototype/      # Static frontend
│   ├── index.html
│   ├── lecturer-dashboard.html
│   ├── lecture-qr.html
│   ├── student-checkin.html
│   ├── attendance-list.html
│   ├── register.html
│   ├── css/
│   └── js/
├── DATABASE_SCHEMA.sql
├── API_SPECIFICATION.md
└── QR_FLOW_DETAILED.md
```

---

## Setup

### Backend

1. Install dependencies:
   ```
   cd backend
   npm install
   ```

2. Create `.env` from `.env.example`:
   ```
   DATABASE_URL=postgresql://user:pass@host:port/dbname
   JWT_SECRET=your_secret
   REFRESH_TOKEN_SECRET=your_refresh_secret
   FRONTEND_URL=https://matty-fyp.onrender.com
   NODE_ENV=development
   ```

3. Create the database and run `DATABASE_SCHEMA.sql` to create tables. The backend runs migrations on startup to add any missing columns (e.g. `qr_expiry_seconds`). For upgrading an existing database, see `backend/migrations/README.md`.

4. Start the server:
   ```
   npm start
   ```
   Default port: 5000.

### Frontend

The frontend calls the live API at `https://matty-fyp-api.onrender.com/api/v1`. To run locally with a local backend, change `API_BASE_URL` in `frontend-prototype/js/main.js`.

Serve the frontend from `frontend-prototype/`:

```
cd frontend-prototype
python -m http.server 3000
```

Or:

```
npx http-server . -c-1 -p 3000
```

Open `http://localhost:3000`.

---

## Usage

1. Register as lecturer or student (students need an 8-digit student ID).
2. Lecturer: create lectures, optionally with module, verification Q&A, and custom QR expiry.
3. Lecturer: open a lecture, click Generate QR. The QR page shows the code and countdown.
4. Student: scan the QR or open the check-in URL, log in, enter verification answer if required, submit.
5. Lecturer: view attendance on the attendance list page, or export CSV.

---

## Local QR testing

Phones cannot open `localhost` URLs from a scanned QR. Either use the same machine for check-in, or use your computer's local IP in the URL (e.g. `http://192.168.1.100:3000/student-checkin.html?token=...`). The QR page shows instructions when running on localhost.

---

## Docs

- `API_SPECIFICATION.md` – API endpoints and request/response formats
- `QR_FLOW_DETAILED.md` – QR token flow and check-in logic
- `FEATURES_AND_SCOPE.md` – Feature list and scope
- `backend/migrations/README.md` – Database migrations
- `frontend-prototype/README.md` – Frontend details
