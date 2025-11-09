# The Maynooth Attendance Tool

A web application for lecturers to easily record student attendance using QR codes. The system measures student engagement in lectures through scalable, digital attendance tracking.

##  Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Technology Stack](#technology-stack)
- [Security](#security)
- [GDPR Compliance](#gdpr-compliance)
- [Future Enhancements](#future-enhancements)

##  Features

### For Lecturers
- **Dashboard:** View timetable for current day/week
- **QR Code Generation:** Generate time-limited QR codes for lectures
- **Auto-Refresh:** QR codes refresh every 60 seconds to prevent screenshot reuse
- **Attendance Analytics:** View detailed attendance statistics
- **Export:** Download attendance reports as CSV
- **Real-time Updates:** See attendance count as students check in

### For Students
- **QR Scanning:** Scan QR codes with mobile camera
- **Manual Entry:** Alternative token entry if scanning fails
- **Attendance History:** View personal attendance records
- **Statistics:** Check attendance rate per module
- **Mobile-Friendly:** Optimized for smartphone use

##  Architecture

```
Frontend (Next.js) → Backend API (Express) → PostgreSQL Database
                                         → Redis Cache
```

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for detailed architecture diagrams.

 **Getting Started**

** Prerequisites**

- Node.js 18+
- PostgreSQL 14+
- Redis (for caching)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd maynooth-attendance-tool
   ```

2. **Set up the database**
   ```bash
   # Create database
   createdb attendance_db
   
   # Run migrations
   psql attendance_db < DATABASE_SCHEMA.sql
   ```

3. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database and Redis credentials
   npm run dev
   ```

4. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   cp .env.example .env.local
   # Edit .env.local with your API URL
   npm run dev
   ```

### Environment Variables

**Backend (.env):**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/attendance_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=your-refresh-secret
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

## Project Structure

```
maynooth-attendance-tool/
├── backend/
│   ├── src/
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Auth, validation, rate limiting
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database models
│   │   └── utils/           # Utilities
│   ├── tests/               # Test files
│   └── package.json
├── frontend/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   ├── lib/                 # API clients, hooks, utils
│   ├── types/               # TypeScript types
│   └── package.json
├── DATABASE_SCHEMA.sql      # Database schema
├── PROJECT_PLAN.md          # Complete project plan
├── API_SPECIFICATION.md     # API documentation
├── QR_FLOW_DETAILED.md      # QR code flow details
└── README.md                # This file
```

##  Documentation

- **[PROJECT_PLAN.md](./PROJECT_PLAN.md)** - Complete project plan including:
  - System architecture
  - Entity-relationship model
  - Frontend page flow
  - Implementation phases

- **[API_SPECIFICATION.md](./API_SPECIFICATION.md)** - Complete API documentation:
  - Endpoint descriptions
  - Request/response formats
  - Error codes
  - Rate limiting

- **[DATABASE_SCHEMA.sql](./DATABASE_SCHEMA.sql)** - Database schema:
  - Table definitions
  - Indexes
  - Views
  - Triggers

- **[QR_FLOW_DETAILED.md](./QR_FLOW_DETAILED.md)** - Detailed QR code implementation:
  - Token generation
  - Refresh mechanism
  - Validation flow
  - Security considerations

##  Technology Stack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **State Management:** Zustand / Redux
- **Data Fetching:** React Query
- **QR Scanning:** html5-qrcode

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma / TypeORM
- **Authentication:** JWT
- **QR Generation:** qrcode
- **Caching:** Redis
- **Validation:** express-validator

### Database
- **Primary DB:** PostgreSQL 14+
- **Cache:** Redis

##  Security

### Authentication
- JWT-based authentication
- Short-lived access tokens (15 minutes)
- Refresh token rotation
- Password hashing with bcrypt (10 rounds)

### QR Code Security
- Time-limited tokens (60-second expiration)
- Automatic refresh prevents screenshot reuse
- Server-side validation
- Rate limiting on check-in attempts

### API Security
- HTTPS enforced
- CORS configuration
- Rate limiting middleware
- Input validation & sanitization
- SQL injection prevention (parameterized queries)

## 📊 GDPR Compliance

### Data Minimization
- Only collects essential data (ID, name, email, check-in timestamp)
- No location tracking
- No biometric data
- Minimal device information

### User Rights
-  Right to access (view attendance history)
-  Right to rectification (update profile)
-  Right to erasure (account deletion)
-  Data export (CSV/JSON download)

### Security Measures
- Encrypted data transmission (HTTPS)
- Password hashing
- Access control (role-based)
- Audit logging

### Data Retention
- Attendance records: Academic year + 2 years
- User accounts: While active
- Audit logs: 90 days

##  Implementation Phases

### Phase 1: Core Functionality (Weeks 1-4)
- [x] Database schema design
- [ ] Database setup
- [x] User authentication (JWT)
- [x] Basic lecturer dashboard
- [x] QR code generation
- [x] Student check-in flow
- [x] Basic attendance recording

### Phase 2: Security & Validation (Weeks 5-6)
- [ ] QR token expiration & refresh
- [ ] Late check-in detection
- [ ] Rate limiting
- [ ] Input validation & sanitization
- [ ] Security headers & CORS

### Phase 3: Analytics & UI Polish (Weeks 7-8)
- [ ] Attendance analytics dashboard
- [ ] Data visualization (charts)
- [ ] Export functionality (CSV)
- [ ] Responsive mobile UI
- [ ] Error handling & user feedback

### Phase 4: Testing & Deployment (Weeks 9-10)
- [ ] Unit tests (backend)
- [ ] Integration tests (API)
- [ ] E2E tests (Playwright/Cypress)
- [ ] Deployment to production
- [ ] Performance optimization
- [ ] Documentation

### Phase 5: Future Enhancements (Post-MVP)
- [ ] Moodle integration
- [ ] Alternative check-in methods
- [ ] Mini quiz feature
- [ ] Push notifications
- [ ] Advanced analytics

## 🔮 Future Enhancements

### Moodle Integration
- Push attendance data to Moodle
- Sync with Moodle course enrollments
- Display attendance in Moodle gradebook

### Alternative Check-in Methods
- Lecturer manual input for students without smartphones
- Device proximity detection (Bluetooth)
- PIN-based check-in

### Engagement Features
- Mini quiz before/after lecture
- Real-time engagement polls
- Participation scoring

**Contributing**

This is a Final Year Project. For questions or suggestions, please contact the project owner.

**License**

This project is developed for academic purposes as part of the Final Year Project at Maynooth University.

**Author**

Cian Ryan
21367626

##  Acknowledgments

- Maynooth University for the project opportunity
- Modern web technologies and open-source libraries

---

**Status:**  In Development

For detailed implementation guides, see the documentation files listed above.

