# Vercel storage setup

SkillBridge production persistence uses:
- Neon Postgres for LMS state (`DATABASE_URL`)
- Vercel Blob for course videos, thumbnails, and profile pictures

## Setup

1. In Vercel, open the project and add a Neon database from Storage/Marketplace.
2. Connect it to the project and make sure `DATABASE_URL` is available in Production.
3. Add a Vercel Blob store and connect it to the project.
4. Use a public Blob store for the current LMS media URLs.
5. Redeploy.

The app automatically creates the `skillbridge_lms_state` table on its first LMS API request.

## Migrate your local LMS data

If `data/lms-db.json` contains the data you want in production, set `DATABASE_URL` in your local environment and run:

```bash
npm install
npm run db:migrate
```

This copies the local LMS snapshot into Neon.