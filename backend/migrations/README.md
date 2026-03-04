# Database migrations

Run these scripts in order when upgrading an existing database.

- `001_add_lecture_verification_qa.sql`  
  Adds `verification_question` and `verification_answer` to `lectures`.
- `002_add_lecture_qr_expiry_seconds.sql`  
  Adds `qr_expiry_seconds` (15–120 seconds, default 30) to `lectures`.

Example (run from project root):

```bash
psql $DATABASE_URL -f backend/migrations/001_add_lecture_verification_qa.sql
```

With another SQL client, run the same SQL file manually.
