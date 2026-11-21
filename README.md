# Neel Verma — Portfolio

A minimalist, editorial portfolio with a private admin dashboard. Everything on the homepage — profile photo, introduction, projects, cover images, screenshots, order and publish state — is edited at `/admin`. No code changes are needed.

- **Next.js 16 + TypeScript + Tailwind CSS 4**, deployed on **Vercel**
- **Supabase**: Postgres for content, Storage for images, Auth for the admin login
- No service-role key anywhere. The app only uses the public anon key; Row Level Security does the protecting.

```
app/                     public homepage, /admin, /media image route, /api/revalidate
components/site/         homepage pieces (header, picture, project sections, reveal)
components/admin/        dashboard, project editor, image slots, UI
lib/                     Supabase clients, data loading, admin helpers, image optimisation
supabase/schema.sql      tables, RLS policies, storage bucket + policies, initial projects
supabase/make-admin.sql  marks your login as the admin
scripts/verify-supabase.mjs  end-to-end check of a live Supabase project
proxy.ts                 keeps the session fresh and sends signed-out visitors to the login page
```

## How it works

- **Content tables:** `profile` holds a single row, `projects` holds one row per project, and `project_images` holds the extra screenshots. `admins` lists the account(s) allowed to edit.
- **Who can do what:** RLS lets visitors read the profile and *published* projects only. Only users in `admins` can insert, update or delete anything. Signing in alone isn't enough.
- **Images:** they live in a **private** bucket called `portfolio`. Storage policies let visitors read the profile photo and images of published projects, and nothing else. Draft images stay private.
  - Paths are `profile/<file>` and `projects/<project-id>/<file>`.
  - The public site serves images through `/media/...`, which reads them as an anonymous visitor so the same rules apply. `next/image` then resizes and caches them.
  - The admin previews drafts with short-lived signed URLs.
- **Optimised uploads:** images are processed in the browser before upload. Orientation is fixed, the longest side is capped at 2,000–2,400 px, the file is re-encoded as WebP (JPEG fallback), and a tiny blurred placeholder is stored for smooth loading. Nothing is written to local disk, so it works on Vercel.
- **Publishing:** after every change the dashboard asks `/api/revalidate` (admin-only) to rebuild the homepage. Changes are live within a second or two.

## 1. Create the Supabase project (free tier)

1. Go to <https://supabase.com/dashboard> → **New project**. Choose a name (e.g. `neel-portfolio`), a database password and a region near you. Wait about a minute for it to start.
2. **Create the database, policies and storage bucket:** go to **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**. This creates:
   - the tables and RLS policies
   - the private `portfolio` bucket with its storage policies
   - your profile row and the six starting projects (Touchline, Ball Knowledge, OIStexas, My Planner, OIS LTFB, Lunchtime Football)

   Only OIS LTFB and Lunchtime Football have website links. Add the others in the dashboard when you have them.
3. **Turn off public sign-ups:** go to **Authentication → Sign In / Providers** (called *Settings* in older dashboards). Switch off **Allow new users to sign up**. Leave the **Email** provider enabled.
4. **Create your admin login:** go to **Authentication → Users → Add user → Create new user**. Enter your email and a strong password, and tick **Auto Confirm User**.
5. **Make that login the admin:** in the **SQL Editor**, paste `supabase/make-admin.sql`, replace `you@example.com` with your email, and click **Run**. The last query should show your email.
6. **Copy two values** from **Project Settings → API Keys** (the project URL is under **Project Settings → Data API**, or on the project's home page):
   - **Project URL**, like `https://abcdefghij.supabase.co` → this is `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key (legacy tab), or the **publishable** key starting `sb_publishable_` → this is `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   **Do not** copy the `service_role` / secret key. This project never needs it.

## 2. Run locally

```bash
npm install
cp .env.example .env.local      # paste the two values from step 6
npm run dev                     # http://localhost:3000  and  http://localhost:3000/admin
```

## 3. Check your Supabase setup (recommended)

This signs in as you, creates a temporary draft project with two tiny images, checks that visitors can't see it, publishes it, checks they now can, and then deletes everything it created.

```bash
SUPABASE_URL=https://abcdefghij.supabase.co \
SUPABASE_ANON_KEY=your-anon-key \
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='your-password' \
npm run test:supabase
```

It also confirms that public sign-ups are off. Optionally add `OTHER_EMAIL` and `OTHER_PASSWORD` for a second, non-admin user to prove they can't edit.

## 4. Deploy on Vercel

1. Push this folder to a new GitHub repository.
2. On <https://vercel.com/new>, import the repository. The framework is detected as Next.js; no settings need changing.
3. Under **Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production and Preview.
4. Click **Deploy**, then open `https://<your-site>.vercel.app/admin` and sign in.

CLI alternative: `npx vercel link`, then `npx vercel env add NEXT_PUBLIC_SUPABASE_URL production` (repeat for the key), then `npx vercel --prod`.

## Using the dashboard

- **About me:** upload or replace your portrait, and edit your name, introduction and an optional contact email (shown in the footer). Text changes need **Save profile**; photos save as soon as they finish uploading.
- **Selected work:**
  - **Add project** creates a draft.
  - Use the arrows (or drag on desktop) to reorder. The numbers 01, 02… follow this order.
  - The switch publishes or unpublishes a project, and **Delete** asks you to confirm, then removes the project and all its images.
- **Project page:**
  - Edit the name, description, website and GitHub links, and the homepage layout (full width, image left or image right). Click **Save changes**.
  - The cover image and screenshots save as soon as they upload. You can upload several screenshots at once, reorder them with the arrows, add alt text, or remove them.
  - Every image slot shows an upload placeholder until you add a photo. On the public site, missing images appear as a clean grey frame.

## Tests

```bash
npm test          # schema + every RLS/storage policy, run in real Postgres (PGlite); path validation
npm run typecheck
npm run build
npm run test:supabase   # against your live project (see step 3)
```

## Free-tier notes

The Supabase free plan includes 1 GB of storage and 500 MB of database space, which is plenty for a portfolio of optimised WebP images. Free projects pause after a week with no activity; opening the dashboard resumes them. On Vercel Hobby, the `/media` responses and optimised images are cached at the edge, so repeat visits don't hit Supabase.
