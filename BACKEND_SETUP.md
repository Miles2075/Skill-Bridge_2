# SkillBridge backend setup

This branch keeps the existing LMS API contract and UI while adding hosted persistence and storage.

## Services

- **Supabase Auth** authenticates users when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.
- **Neon PostgreSQL** stores the existing LMS state durably in a single JSONB compatibility row named `skillbridge_lms_state`. The API creates the table automatically and serializes writes with a PostgreSQL advisory transaction lock. This is a compatibility bridge for the existing synchronous LMS domain layer, not a normalized relational schema; normalize high-volume tables in a later migration.
- **Vercel Blob** stores instructor video uploads when `BLOB_READ_WRITE_TOKEN` is configured. Local development continues to use the local uploads directory when the token is absent.
- **Vercel** runs the existing server entry and LMS API.

## Local environment

Copy `.env.example` to `.env` and set real values. Do not commit `.env`.

Required for hosted mode:
- `VITE_SUPABASE_URL`: Supabase project URL (client).
- `VITE_SUPABASE_ANON_KEY`: Supabase publishable/anon key (client; never a service-role key).
- `SUPABASE_URL`: same project URL for server-side token verification.
- `SUPABASE_ANON_KEY`: same publishable/anon key for server-side token verification.
- `DATABASE_URL`: Neon PostgreSQL connection string; use the pooled connection string from Neon for Vercel.
- `BLOB_READ_WRITE_TOKEN`: token generated for the Vercel Blob store.

Run `npm install` after pulling the changes, then `npm run dev`.

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
