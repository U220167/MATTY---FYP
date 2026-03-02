# Database migrations

I run these scripts in order when I upgrade an existing database.

- `001_add_lecture_verification_qa.sql`  
  Adds `verification_question` and `verification_answer` to `lectures`.

Example (run from project root):

```bash
psql $DATABASE_URL -f backend/migrations/001_add_lecture_verification_qa.sql
```

If I am using another SQL client, I run the same SQL file manually.
