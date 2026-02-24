-- ============================================
-- Maynooth Attendance Tool - Database Schema
-- PostgreSQL Database Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DEPARTMENTS TABLE
-- ============================================
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MODULES TABLE
-- ============================================
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    student_id VARCHAR(50) UNIQUE, -- Nullable, only for students
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('LECTURER', 'STUDENT', 'ADMIN')),
    department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LECTURES TABLE
-- ============================================
CREATE TABLE lectures (
    id SERIAL PRIMARY KEY,
    lecturer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    lecture_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location VARCHAR(255),
    description TEXT,
    verification_question TEXT,
    verification_answer TEXT,
    status VARCHAR(20) DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- QR SESSIONS TABLE
-- Stores active QR codes for lectures
-- ============================================
CREATE TABLE qr_sessions (
    id SERIAL PRIMARY KEY,
    lecture_id INTEGER NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    refresh_interval_seconds INTEGER DEFAULT 60,
    check_in_count INTEGER DEFAULT 0 -- Track number of check-ins with this token
);

-- ============================================
-- ATTENDANCE TABLE
-- Records student attendance for lectures
-- ============================================
CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lecture_id INTEGER NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    qr_token VARCHAR(255) NOT NULL, -- Token used for check-in
    checked_in_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP, -- When attendance was verified by lecturer
    status VARCHAR(20) DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED')),
    minutes_late INTEGER DEFAULT 0,
    metadata JSONB, -- Additional info (IP address, device info if needed)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, lecture_id) -- Prevent duplicate check-ins
);

-- ============================================
-- ATTENDANCE ANALYTICS TABLE
-- Cached analytics data for lectures
-- ============================================
CREATE TABLE attendance_analytics (
    id SERIAL PRIMARY KEY,
    lecture_id INTEGER NOT NULL REFERENCES lectures(id) ON DELETE CASCADE,
    total_students INTEGER NOT NULL,
    present_count INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    excused_count INTEGER DEFAULT 0,
    attendance_percentage DECIMAL(5,2),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(lecture_id) -- One analytics record per lecture
);

-- ============================================
-- STUDENT ENROLLMENTS TABLE (Optional)
-- Track which students are enrolled in which modules
-- ============================================
CREATE TABLE student_enrollments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    enrollment_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DROPPED', 'COMPLETED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, module_id)
);

-- ============================================
-- REFRESH TOKENS TABLE
-- For JWT refresh token management
-- ============================================
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- AUDIT LOG TABLE (Optional, for GDPR compliance)
-- Track important actions for audit purposes
-- ============================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g., 'LOGIN', 'CHECK_IN', 'QR_GENERATED'
    resource_type VARCHAR(50), -- e.g., 'ATTENDANCE', 'LECTURE'
    resource_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_department ON users(department_id);

-- Lectures indexes
CREATE INDEX idx_lectures_lecturer ON lectures(lecturer_id);
CREATE INDEX idx_lectures_module ON lectures(module_id);
CREATE INDEX idx_lectures_date ON lectures(lecture_date);
CREATE INDEX idx_lectures_lecturer_date ON lectures(lecturer_id, lecture_date);
CREATE INDEX idx_lectures_status ON lectures(status);

-- QR Sessions indexes
CREATE INDEX idx_qr_sessions_lecture ON qr_sessions(lecture_id);
CREATE INDEX idx_qr_sessions_token ON qr_sessions(qr_token);
CREATE INDEX idx_qr_sessions_expires ON qr_sessions(expires_at);
CREATE INDEX idx_qr_sessions_active ON qr_sessions(is_active);

-- Attendance indexes
CREATE INDEX idx_attendance_student ON attendance(student_id);
CREATE INDEX idx_attendance_lecture ON attendance(lecture_id);
CREATE INDEX idx_attendance_student_lecture ON attendance(student_id, lecture_id);
CREATE INDEX idx_attendance_checked_in ON attendance(checked_in_at);
CREATE INDEX idx_attendance_status ON attendance(status);
CREATE INDEX idx_attendance_qr_token ON attendance(qr_token);

-- Analytics indexes
CREATE INDEX idx_analytics_lecture ON attendance_analytics(lecture_id);
CREATE INDEX idx_analytics_calculated ON attendance_analytics(calculated_at);

-- Enrollments indexes
CREATE INDEX idx_enrollments_student ON student_enrollments(student_id);
CREATE INDEX idx_enrollments_module ON student_enrollments(module_id);
CREATE INDEX idx_enrollments_student_module ON student_enrollments(student_id, module_id);

-- Refresh tokens indexes
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ============================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMP
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lectures_updated_at BEFORE UPDATE ON lectures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at BEFORE UPDATE ON modules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Lecture Attendance Summary
CREATE OR REPLACE VIEW lecture_attendance_summary AS
SELECT 
    l.id AS lecture_id,
    l.title,
    l.lecture_date,
    l.start_time,
    l.end_time,
    COUNT(DISTINCT se.student_id) AS total_enrolled,
    COUNT(DISTINCT a.student_id) AS checked_in,
    COUNT(DISTINCT CASE WHEN a.status = 'PRESENT' THEN a.student_id END) AS present_count,
    COUNT(DISTINCT CASE WHEN a.status = 'LATE' THEN a.student_id END) AS late_count,
    COUNT(DISTINCT CASE WHEN a.status = 'ABSENT' OR a.id IS NULL THEN se.student_id END) AS absent_count,
    ROUND(
        (COUNT(DISTINCT a.student_id)::DECIMAL / NULLIF(COUNT(DISTINCT se.student_id), 0)) * 100, 
        2
    ) AS attendance_percentage
FROM lectures l
LEFT JOIN student_enrollments se ON se.module_id = l.module_id
LEFT JOIN attendance a ON a.lecture_id = l.id AND a.student_id = se.student_id
GROUP BY l.id, l.title, l.lecture_date, l.start_time, l.end_time;

-- View: Student Attendance Summary
CREATE OR REPLACE VIEW student_attendance_summary AS
SELECT 
    u.id AS student_id,
    u.student_id AS student_number,
    u.first_name,
    u.last_name,
    COUNT(DISTINCT l.id) AS total_lectures,
    COUNT(DISTINCT a.id) AS attended_lectures,
    COUNT(DISTINCT CASE WHEN a.status = 'PRESENT' THEN a.id END) AS present_count,
    COUNT(DISTINCT CASE WHEN a.status = 'LATE' THEN a.id END) AS late_count,
    COUNT(DISTINCT CASE WHEN a.status = 'ABSENT' OR a.id IS NULL THEN l.id END) AS absent_count,
    ROUND(
        (COUNT(DISTINCT a.id)::DECIMAL / NULLIF(COUNT(DISTINCT l.id), 0)) * 100, 
        2
    ) AS overall_attendance_rate
FROM users u
JOIN student_enrollments se ON se.student_id = u.id
JOIN lectures l ON l.module_id = se.module_id
LEFT JOIN attendance a ON a.lecture_id = l.id AND a.student_id = u.id
WHERE u.role = 'STUDENT'
GROUP BY u.id, u.student_id, u.first_name, u.last_name;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample department
INSERT INTO departments (name, code, description) VALUES
('Computer Science', 'CS', 'Department of Computer Science'),
('Mathematics', 'MATH', 'Department of Mathematics');

-- Insert sample modules
INSERT INTO modules (code, name, description, department_id) VALUES
('CS301', 'Database Systems', 'Introduction to database systems and SQL', 1),
('CS302', 'Web Development', 'Modern web development technologies', 1),
('MATH201', 'Linear Algebra', 'Fundamentals of linear algebra', 2);

-- Note: Sample users should be created through the registration API with proper password hashing
-- Sample lectures should be created through the API by authenticated lecturers

-- ============================================
-- STORED PROCEDURES (Optional)
-- ============================================

-- Procedure: Calculate attendance analytics for a lecture
CREATE OR REPLACE FUNCTION calculate_lecture_analytics(p_lecture_id INTEGER)
RETURNS void AS $$
DECLARE
    v_total_students INTEGER;
    v_present_count INTEGER;
    v_late_count INTEGER;
    v_absent_count INTEGER;
    v_attendance_percentage DECIMAL(5,2);
BEGIN
    -- Get total enrolled students
    SELECT COUNT(DISTINCT se.student_id) INTO v_total_students
    FROM student_enrollments se
    JOIN lectures l ON l.module_id = se.module_id
    WHERE l.id = p_lecture_id;
    
    -- Get attendance counts
    SELECT 
        COUNT(DISTINCT CASE WHEN status = 'PRESENT' THEN student_id END),
        COUNT(DISTINCT CASE WHEN status = 'LATE' THEN student_id END),
        COUNT(DISTINCT CASE WHEN status = 'ABSENT' THEN student_id END)
    INTO v_present_count, v_late_count, v_absent_count
    FROM attendance
    WHERE lecture_id = p_lecture_id;
    
    -- Calculate percentage
    v_attendance_percentage := ROUND(
        ((v_present_count + v_late_count)::DECIMAL / NULLIF(v_total_students, 0)) * 100,
        2
    );
    
    -- Upsert analytics record
    INSERT INTO attendance_analytics (
        lecture_id,
        total_students,
        present_count,
        late_count,
        absent_count,
        attendance_percentage,
        calculated_at
    ) VALUES (
        p_lecture_id,
        v_total_students,
        v_present_count,
        v_late_count,
        v_total_students - v_present_count - v_late_count,
        v_attendance_percentage,
        CURRENT_TIMESTAMP
    )
    ON CONFLICT (lecture_id) DO UPDATE SET
        total_students = EXCLUDED.total_students,
        present_count = EXCLUDED.present_count,
        late_count = EXCLUDED.late_count,
        absent_count = EXCLUDED.absent_count,
        attendance_percentage = EXCLUDED.attendance_percentage,
        calculated_at = EXCLUDED.calculated_at;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- END OF SCHEMA
-- ============================================

