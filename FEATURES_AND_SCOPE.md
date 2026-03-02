# Maynooth Attendance Tool — Features, Scope & Project Status

**Document for:** Examiner / Supervisor (Final Year Project)  
**Project finish date:** 15 March 2025  
**Status:** In development

**Development timeline:** I built the initial frontend prototype and project docs in November 2025, paused work over the winter period, and resumed backend and integration work in February 2026. The implementation dates below come from git history. Because I worked on related features in parallel, the "Est. dev time" column in Section 3 shows the broader effort window for each item, not just the final commit day.

---

## 1. Overview

The Maynooth Attendance Tool is a web application for lecturers to record student attendance using time-limited QR codes. Students check in by scanning the QR (or entering the token manually), and the system records attendance with status: **PRESENT**, **LATE**, or **ABSENT** based on lecture start/end times.

### 1.1 Live application

**Frontend (user-facing):**  
[https://matty-fyp.onrender.com](https://matty-fyp.onrender.com)

Use this URL to access the application. The frontend is a static site (HTML, CSS, JavaScript) served from Render. Note: on the free tier, the service may take 30–60 seconds to respond after a period of inactivity (cold start).

### 1.2 Architecture (as implemented)

```
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND (Static HTML / CSS / JavaScript)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Lecturer    │  │   Student    │  │   Auth (Login /      │   │
│  │  Dashboard   │  │  Check-in   │  │   Register)          │   │
│  │  + QR page   │  │  + Token    │  │                      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   HTTPS / REST    │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js + Express)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Auth       │  │  Lecturer    │  │  Student             │  │
│  │   (JWT)      │  │  Lectures    │  │  Check-in / Info     │  │
│  │              │  │  QR / Attend │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   PostgreSQL      │
                    │   (users,         │
                    │   lectures,       │
                    │   attendance,     │
                    │   qr_sessions)    │
                    └───────────────────┘
```

### 1.3 Technology stack (current)

| Layer      | Technology |
|-----------|------------|
| Frontend  | Static HTML5, CSS3, vanilla JavaScript (ES modules). No React/Next.js. |
| Backend   | Node.js, Express.js, JWT (access + refresh), bcrypt, `qrcode` for QR generation. |
| Database  | PostgreSQL. No Redis. |
| Deployment | Frontend and backend hosted on Render. |

---

## 2. Initial proposal (summary)

The original project plan envisaged:

- **Frontend:** Next.js/React, TypeScript, TailwindCSS, QR scanner library.
- **Backend:** Express, TypeScript, Redis for QR session caching, rate limiting.
- **Features:** Lecturer dashboard (day/week view), QR generation with 60s expiry, student QR scan and manual token entry, attendance recording, late detection (15-minute threshold), analytics dashboard, CSV export, student attendance history and statistics.
- **Phases:** Core (auth, dashboard, QR, check-in) → Security & validation → Analytics & UI → Testing & deployment → Future (e.g. Moodle, SSO).

I changed the implementation plan to prioritize a working MVP with a static frontend and no Redis, then added verification Q&A, recurring lectures, a month calendar, edit/delete lecture, and ABSENT-after-lecture-end logic. The sections below reflect **what exists now** and **what is planned by 15 March 2025**.

---

## 3. Implemented features (in-depth)

Implementation dates are taken from repository commit history (see commits.txt). There is a break in development between late November 2025 and early February 2026.

The **Implemented** column shows the commit date where the feature landed. In most cases I worked on each feature over multiple days (design, backend logic, frontend wiring, testing, and fixes). The **Est. dev time** column gives that wider window. These are practical estimates based on grouped commits and work sequence, not exact time tracking.

---

### 3.1 Authentication

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **User registration** | Users can register with email, password, first name, last name, and role (LECTURER or STUDENT). Students must provide an 8-digit student ID. Passwords are trimmed and hashed with bcrypt. | 2026-02-17 | Roughly 3–4 days: backend validation and bcrypt, then register page and wiring to the live API. |
| **Login** | Email and password login; returns JWT access token and refresh token. Role is validated against the account. | 2026-02-17 | About 2–3 days: JWT setup, login endpoint, and frontend login flow and token storage. |
| **Token refresh** | POST `/auth/refresh` with refresh token returns a new access token. Refresh tokens stored in DB with expiry. | 2026-02-17 | Around 1–2 days, implemented alongside login and refresh-token storage/rotation. |
| **Current user** | GET `/auth/me` returns the authenticated user’s profile (id, email, role, name, student_id for students). | 2026-02-17 | About a day: endpoint and frontend use for role-based routing and display. |

No password recovery, email verification, or Microsoft SSO (see Out of scope).

---

### 3.2 Lecturer: lectures

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **List lectures** | GET `/lecturer/lectures` returns all lectures for the logged-in lecturer, ordered by date and time. Includes module code/name when `module_id` is set. | 2026-02-17 | Around 2 days: endpoint, ownership filtering, and dashboard integration to load and display lectures. |
| **Create lecture** | POST `/lecturer/lectures`: title, lecture_date, start_time, end_time, location; optional module_id, repeat_weeks (1–52), verification_question, verification_answer. When repeat_weeks > 1, one lecture per week is created from the start date. | 2026-02-17 | About 4–5 days: API design, validation, DB insert, and create-lecture form with date/time and optional module. |
| **Get one lecture** | GET `/lecturer/lectures/:id` returns a single lecture (including verification_question, verification_answer) for the owner. | 2026-02-17 | Roughly 1 day, done with list/create for reuse in edit and QR flows. |
| **Update lecture** | PUT `/lecturer/lectures/:id`: optional title, lecture_date, start_time, end_time, location, verification_question, verification_answer. Only provided fields are updated. | 2026-02-24 | About 2–3 days: partial-update logic, validation, and testing before wiring to the edit UI. |
| **Delete lecture** | DELETE `/lecturer/lectures/:id` removes the lecture (and, via DB cascade, its QR sessions and attendance). Only the owning lecturer can delete. | 2026-02-24 | Around 1–2 days: cascade behaviour, permissions, and dashboard delete action and confirmation. |
| **Recurring lectures (UI)** | Create-lecture form includes “Repeat weekly” checkbox and “Number of weeks” (1–52). Submitting creates that many lectures, one per week. | 2026-02-23 | Roughly 2–3 days: UI controls, backend loop over weeks, and testing with different repeat ranges. |
| **Verification Q&A (create/edit)** | Optional verification question and answer per lecture. Answer is stored in plain text and compared case-insensitively at check-in. If set, students must answer correctly to submit attendance. | 2026-02-24 | About 3 days: schema/migration, create/edit forms, check-in flow and server-side check. |
| **Edit lecture (UI)** | “Edit” button on each lecture in the dashboard opens a modal; form is pre-filled from the API. Submitting sends PUT and refreshes the list. | 2026-02-24 | Around 2 days: modal, pre-fill from GET lecture, and submit/refresh, built alongside the update endpoint. |

---

### 3.3 Lecturer: dashboard and calendar

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **Month calendar** | Dashboard shows a full month calendar (Sun–Sat) with previous/next month navigation and a “Today” button. Lecturers can view any month in the past or future. | 2026-02-23 | About 4–5 days: replacing the 7-day nav with a full month grid, correct day offsets, and prev/next/today behaviour. |
| **Day selection** | Clicking a day shows that day’s timetable. Days with lectures display a badge with the lecture count. | 2026-02-23 | Roughly 1–2 days: click handling, filtering lectures by selected date, and badge counts. |
| **Timetable view** | For the selected day, lectures are listed with time, title, module, location. Each row has “Generate QR”, “View Attendance”, “Edit”, “Delete”. | 2026-02-23 | Around 2–3 days: layout, action buttons, and linking to QR and attendance pages (evolved over the week). |
| **Statistics** | Summary cards show lectures on the selected day, total lectures, and active sessions count. | 2026-02-23 | About 1 day: aggregating from the loaded lectures and any active QR session data for the UI. |

The original plan had a day/week view only; the implemented solution is a month calendar for better navigation and historical attendance review.

---

### 3.4 Lecturer: QR codes

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **Generate QR** | POST `/lecturer/lectures/:id/qr/generate` creates a new QR session. Any existing active session for that lecture is deactivated. Returns QR image (base64), qr_token, expires_at, expires_in_seconds. | 2026-02-17 | Roughly 3–4 days: qr_sessions table, token generation, deactivation of previous session, and QR image generation (e.g. `qrcode` library) and base64 response. |
| **QR expiry** | QR codes expire after **30 seconds**. The frontend countdown uses the API’s expires_in_seconds to avoid client/server clock skew. | 2026-02-24 | About 1–2 days: changing expiry from initial value to 30s after feedback, plus a follow-up fix for the countdown/expiry behaviour. |
| **QR page** | Dedicated page (lecture-qr.html) shows the QR image, token, and countdown. “Refresh” generates a new code; “Stop” deactivates active QR sessions on the backend and stops the countdown in the UI. “View Attendance” links to the attendance list. | 2026-02-17 | Around 2–3 days: page layout, generate flow, image/token display, and countdown timer tied to expires_in_seconds; later updated so Stop also deactivates the session server-side. |
| **Check-in URL** | QR content is the frontend check-in URL with token: `{FRONTEND_URL}/student-checkin.html?token={qr_token}`. | 2026-02-17 | About a day: deciding URL format and encoding it into the QR payload so scanning opens the check-in page with token. |

---

### 3.5 Lecturer: attendance

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **Attendance list** | GET `/lecturer/lectures/:id/attendance` returns the lecture details and all attendance rows (student_id, first_name, last_name, checked_in_at, status, minutes_late). | 2026-02-17 | About 2 days: join with users for names, ordering, and optional minutes_late for display. |
| **Attendance page (UI)** | attendance-list.html shows lecture title, date/time, and a table of students with check-in time and status. Status is shown as a badge (PRESENT / LATE / ABSENT) with minutes late when applicable. | 2026-02-17 | Roughly 2–3 days: page structure, table markup, and badge styling for status and late minutes. |
| **Summary** | Frontend computes and displays counts for present, late, and absent from the attendance list. | 2026-02-17 | Around 1 day: simple aggregation from the attendance array and display in the UI. |

---

### 3.6 Student: check-in

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **Check-in by token** | Student opens the check-in URL (from QR or manual entry). Token can be in the query string or entered in a manual field. | 2026-02-17 | About 1–2 days: parsing token from URL, manual token input field, and single flow for both entry methods. |
| **Student login** | Students must log in (email + password) before submitting attendance. JWT is stored and sent with check-in and check-in-info requests. | 2026-02-17 | Roughly 2 days: reusing auth flow on check-in page, role check, and ensuring JWT is sent with student endpoints. |
| **Check-in info** | GET `/student/attendance/checkin-info?token=...` (authenticated) returns lecture_title and verification_question (not the answer). Used to show the verification question when the lecture has one. | 2026-02-24 | Around 1–2 days: endpoint to resolve token to lecture and return safe fields, plus frontend call and display of question. |
| **Verification question** | If the lecture has a verification question, the check-in form shows the question and a required text field. Answer is compared case-insensitively on the server. | 2026-02-24 | About 2 days: form field, sending answer with check-in, server-side comparison, and error handling for wrong/missing answer. |
| **Submit attendance** | POST `/student/attendance/checkin` with qr_token and optional answer. Validates token, expiry, verification answer (if required), and duplicate check-in. Inserts one attendance row per student per lecture. | 2026-02-17 | Roughly 4–5 days: validation logic, status (PRESENT/LATE/ABSENT) and minutes_late, insert, and frontend submit and success/error handling. |
| **Status rules** | **PRESENT:** check-in within 5 minutes of lecture start. **LATE:** check-in after 5 minutes but before lecture end. **ABSENT:** check-in after the lecture end time. Grace period for “on time” is 5 minutes. | 2026-02-17 | Implemented over the same period as submit attendance: deciding thresholds and computing status and minutes_late on the server. |
| **Success / error messages** | Success screen shows check-in time and status (with minutes late for LATE). Errors: QR expired, already checked in, lecture not found, verification failed. | 2026-02-17 | Around 1–2 days: mapping API responses to user-facing messages and success view with time and status. |

---

### 3.7 Database and migrations

| Feature | Description | Implemented | Est. dev time |
|--------|-------------|-------------|----------------|
| **Schema** | PostgreSQL: users, departments, modules, lectures (with verification_question, verification_answer), qr_sessions, attendance (with status, minutes_late), attendance_analytics. See DATABASE_SCHEMA.sql. | 2026-02-09 | About 4–5 days: designing tables, relations, and indexes; writing schema SQL; and aligning with auth, lectures, QR, and attendance logic as the backend was built. |
| **Startup migration** | On startup, the backend runs a migration that adds verification_question and verification_answer to lectures if not present (ADD COLUMN IF NOT EXISTS). No separate migration runner. | 2026-02-24 | Roughly 1 day: adding the migration step to startup so new columns are applied without manual DB commands. |

---

## 4. Planned features (by 15 March 2025)

The following are specified for implementation before the project finish date.

---

### 4.1 Student dashboard — attendance and module-level scores

**Purpose:** Give students a single place to see their own attendance and performance per module.

**Detailed specification:**

1. **Dashboard entry**
   - A dedicated student dashboard page (e.g. student-dashboard.html or equivalent), reachable after login when role is STUDENT (e.g. from the main menu or landing page).

2. **Attended lectures**
   - List of all lectures the student has attended (from the attendance table).
   - For each lecture: lecture title, module code (and name if available), date, time, check-in time, and status (PRESENT / LATE / ABSENT).
   - Sorted by date (newest or oldest, clearly stated in UI).

3. **Scores by module**
   - Group attendance records by **module code** (e.g. CS301, CS302). Module code is derived from the lecture (e.g. from a module table or from lecture metadata; if lectures only have a free-text “module code” stored at create time, use that for grouping).
   - For each module, compute and display:
     - **Attendance rate:** (number of PRESENT + LATE + ABSENT for that module) / (number of lectures for that module the student was expected to attend). “Expected” may be “all lectures for that module” or “lectures for that module where the student is enrolled”; the exact rule will be defined when enrolment/assignment is implemented (see 4.2).
     - **On-time rate:** (number of PRESENT for that module) / (number of attendances for that module), as a percentage.
     - **Late rate:** (number of LATE for that module) / (number of attendances for that module), as a percentage.
     - **Absent rate:** (number of ABSENT for that module) / (number of attendances for that module), as a percentage.
   - Display these as percentages (e.g. “Attendance: 85%”, “On time: 70%”, “Late: 15%”, “Absent: 15%”) with a clear label per module.

4. **Data source**
   - Backend: at least one endpoint that returns the current student’s attendance records (and optionally lecture/module info) so the frontend can compute the above, or a dedicated endpoint that returns per-module aggregates for the student.
   - If “expected” lectures per module depends on enrolment, that will use the lecturer-assigned modules feature (4.2).

5. **UI**
   - Read-only dashboard: no creation or deletion of lectures or attendance. Optional: filter by module or date range.

---

### 4.2 Lecturer: assign students to modules

**Purpose:** Let lecturers define which students are “in” a module so that creating a lecture can be scoped to that module’s students, and so that student dashboard stats (e.g. expected lectures per module) can be consistent.

**Detailed specification:**

1. **Module–student assignment**
   - Lecturers can **assign students to modules**. An assignment links a student (by user id or student number) to a module (by module id or module code).
   - Storage: either a new table (e.g. module_enrolments or student_modules) with (module_id, student_id) or equivalent, or a clear specification of how “enrolled” is derived from existing data.
   - Students are identified by **student number** (and optionally name) as stored in the database (users.student_id, and names for display). The UI must allow searching or selecting from existing users with role STUDENT (e.g. by student number and/or name).

2. **UI for assignment**
   - A dedicated interface (e.g. “Manage module” or “Assign students to module”) where the lecturer:
     - Selects a module (by code or from a list).
     - Sees currently assigned students (student number, name).
     - Can add students (e.g. search by student number or name from users in the DB).
     - Can remove students from the module.
   - No creation of new user accounts from this screen; only assignment of existing students to modules.

3. **Use when creating lectures**
   - When creating a new lecture, the lecturer selects or specifies the **module** (as today). The system will use this module to:
     - Associate the lecture with a module so that attendance for that lecture counts toward that module in the student dashboard (4.1).
     - Optionally, in future, restrict “expected” lectures for a student to those belonging to modules they are assigned to.
   - “Assign students to modules” does not replace the current create-lecture flow; it adds enrolment so that “which students belong to this module” is defined for reporting and, if needed, for expected-lecture counts.

4. **Permissions**
   - Only lecturers (and optionally admins) can assign or remove students from modules. The exact rule (e.g. “any lecturer” vs “lecturer who teaches a lecture for that module”) can be decided at implementation time.

5. **Backend**
   - Endpoints needed: e.g. list students assigned to a module; add student to module; remove student from module; possibly list modules for a lecturer. Student list for assignment must be based on existing users (student numbers and names in the DB).

---

## 5. Out of scope (not planned by 15 March 2025)

The following are explicitly **not** in scope for this project:

- **Microsoft SSO / single sign-on:** No integration with Microsoft or other external identity providers.
- **Authentication emails:** No email verification on sign-up, no “forgot password” or password-reset emails.
- **Password recovery:** No “forgot password” or “reset password” flow; users must use their existing password or rely on manual admin intervention (e.g. DB or support process) outside the application.

---

## 6. Known issues and possible errors

- **Cold start:** On Render free tier, the frontend (and backend, if used) may sleep after inactivity. The first request can take 30–60 seconds. Subsequent requests are fast until the next idle period.
- **Deleted lectures reappearing:** If delete was only done locally (e.g. before the delete API was implemented), a refresh could show the lecture again. The current implementation deletes via the API first, then updates the local list.
- **Date display after create:** Newly created lectures are added to the client’s list; if the API returns lecture_date in a different format (e.g. full ISO) than the calendar filter (YYYY-MM-DD), the new lecture might not appear for the selected day until the page is refreshed. Normalising lecture_date on the client when appending created lectures avoids this.
- **Verification question:** If the lecture has a verification question but the student’s device fails to load check-in info (e.g. network error), the question may not appear; submitting without an answer will then fail with “Incorrect answer” or validation error. Retrying or refreshing can help.
- **Browser support:** The application is developed and tested in modern browsers (Chrome, Firefox, Edge, Safari). Legacy browsers may have issues with ES modules or CSS.

---

## 7. Document and repository

- This document is the main reference for **current features**, **scope**, and **planned work** for the Maynooth Attendance Tool FYP.
- Implementation dates are derived from the git commit history (see commits.txt in the repository).
- For database schema and API details, see DATABASE_SCHEMA.sql and API_SPECIFICATION.md in the repository.
