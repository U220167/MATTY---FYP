# Database migrations

Run these in order on your PostgreSQL database when upgrading.

- **001_add_lecture_verification_qa.sql** – Adds `verification_question` and `verification_answer` to `lectures`. Required for the lecturer Q&A verification feature and edit-lecture support.

Example (from project root):

```bash
psql $DATABASE_URL -f backend/migrations/001_add_lecture_verification_qa.sql
```

Or from any client: execute the contents of the `.sql` file.
