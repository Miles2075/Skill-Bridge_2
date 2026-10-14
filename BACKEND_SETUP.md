# SkillBridge backend setup

This branch keeps the existing LMS API contract and UI while adding hosted persistence and storage.

## Services

- **Supabase Auth** authenticates users when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
- **Neon PostgreSQL** stores the existing LMS state durably in a single JSONB compatibility row named `skillbridge_lms_state`. The API creates the table automatically and serializes writes with a PostgreSQL advisory transaction lock. This is a compatibility bridge for the existing synchronous LMS domain layer, not a normalized relational schema; normalize high-volume tables in a later migration.
- **Vercel Blob** stores instructor video uploads when `BLOB_READ_WRITE_TOKEN` is configured. Local development continues to use the local uploads directory when the token is absent.
- **Vercel** runs the existing server entry and LMS API.

## Local environment

Copy `.env.example` to `.env.local` (or `.env`) and set real values. Do not commit either file. The Vite config loads local env files into the Node process so the server-only LMS API can read `DATABASE_URL`.

Required for hosted mode:
- `VITE_SUPABASE_URL`: Supabase project URL (client).
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon key (client; never a service-role key).
- `SUPABASE_URL`: same project URL for server-side token verification.
- `SUPABASE_ANON_KEY`: same publishable/anon key for server-side token verification.
- `DATABASE_URL`: Neon PostgreSQL connection string; use the pooled connection string from Neon for Vercel.
- `BLOB_READ_WRITE_TOKEN`: token generated for the Vercel Blob store.

Run `npm install` after pulling the changes, then `npm run dev`.

### Connection checks

- The LMS API uses Neon as its durable store when a database connection string is configured. In local development only, it can fall back to the local JSON store.
- The backend accepts `DATABASE_URL` as the preferred variable, and falls back to `DATABASE_POSTGRES_URL`, `DATABASE_POSTGRES_URL_NON_POOLING`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL`, or `POSTGRES_URL_NON_POOLING` if the preferred variable is absent.
- A connected Vercel Blob store may expose its token as `SKILLBRIDGE_READ_WRITE_TOKEN`; video uploads accept that name as well as `BLOB_READ_WRITE_TOKEN`.
- After deploying, open `https://YOUR_DEPLOYED_DOMAIN/api/lms/health`. A healthy connection returns JSON with `ok: true` and `connected: true`. A failure returns a safe diagnostic and code without exposing the database URL.

## Vercel configuration

1. Create/select the Vercel project connected to this repository.
2. In **Settings → Environment Variables**, add the five hosted variables listed above for Development, Preview, and Production as appropriate.
3. Create a Blob store in the Vercel project and add its `BLOB_READ_WRITE_TOKEN`.
4. Redeploy after setting variables. Vercel does not apply newly added environment variables to an already-running deployment.
5. In Supabase Auth settings, configure the deployed site's URL and allowed redirect URLs.
6. For instructor/admin accounts, set `app_metadata.role` to `teacher` or `admin` through a trusted administrative process. Do not use user-editable `user_metadata` to grant privileged roles.

## Important limits and operational notes

- The LMS snapshot is serialized to avoid lost updates across server instances, but a single JSONB row is a transitional storage model and will become a bottleneck as the platform grows. A normalized schema with foreign keys and per-table transactions is the recommended next step.
- Vercel Functions have request/body size limits. For large course videos, use Vercel Blob's client-upload flow rather than sending very large video bodies through a server function.
- Existing local-only accounts are not automatically migrated into Supabase Auth. Users must register/sign in with the configured Supabase project; existing LMS records remain in the Neon state once the database is initialized.
- Razorpay secrets must be configured as server-side environment variables. Never put `RAZORPAY_KEY_SECRET` in a `VITE_` variable.
- Verify signup, sign-in, role authorization, course CRUD, enrollments, progress, assignment grading, quizzes, purchases, profile edits, and video uploads in a staging deployment before using production data.
