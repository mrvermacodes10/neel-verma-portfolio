-- ============================================================================
-- Neel Verma — portfolio schema
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: tables/policies are created only if missing; seed rows only once.
-- ============================================================================

-- ---------- Admins ----------------------------------------------------------
-- Only users listed here may change content. Signing in alone is not enough.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins can see themselves" on public.admins;
create policy "admins can see themselves" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------- Profile (single row) -------------------------------------------
create table if not exists public.profile (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Neel Verma',
  intro text not null default '',
  photo_path text,
  photo_width int,
  photo_height int,
  photo_blur text,
  email text,
  updated_at timestamptz not null default now()
);
alter table public.profile enable row level security;

-- ---------- Projects --------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  url text check (url is null or url ~* '^https?://'),
  github_url text check (github_url is null or github_url ~* '^https?://'),
  layout text not null default 'full' check (layout in ('full', 'left', 'right')),
  cover_path text,
  cover_width int,
  cover_height int,
  cover_blur text,
  position int not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_position_idx on public.projects (position);
alter table public.projects enable row level security;

-- ---------- Additional screenshots -----------------------------------------
create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  path text not null,
  width int,
  height int,
  blur text,
  alt text not null default '',
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists project_images_project_idx on public.project_images (project_id, position);
alter table public.project_images enable row level security;

-- ---------- updated_at ------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
drop trigger if exists profile_touch on public.profile;
create trigger profile_touch before update on public.profile for each row execute function public.touch_updated_at();

-- ---------- Row Level Security ---------------------------------------------
-- Profile: everyone can read; only admins can change.
drop policy if exists "profile is public" on public.profile;
create policy "profile is public" on public.profile for select to anon, authenticated using (true);
drop policy if exists "admins update profile" on public.profile;
create policy "admins update profile" on public.profile for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Projects: visitors see published projects; admins see and change everything.
drop policy if exists "published projects are public" on public.projects;
create policy "published projects are public" on public.projects for select to anon, authenticated using (published or public.is_admin());
drop policy if exists "admins insert projects" on public.projects;
create policy "admins insert projects" on public.projects for insert to authenticated with check (public.is_admin());
drop policy if exists "admins update projects" on public.projects;
create policy "admins update projects" on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete projects" on public.projects;
create policy "admins delete projects" on public.projects for delete to authenticated using (public.is_admin());

-- Screenshots follow their project's visibility.
drop policy if exists "images of published projects are public" on public.project_images;
create policy "images of published projects are public" on public.project_images for select to anon, authenticated
  using (public.is_admin() or exists (select 1 from public.projects p where p.id = project_id and p.published));
drop policy if exists "admins insert images" on public.project_images;
create policy "admins insert images" on public.project_images for insert to authenticated with check (public.is_admin());
drop policy if exists "admins update images" on public.project_images;
create policy "admins update images" on public.project_images for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admins delete images" on public.project_images;
create policy "admins delete images" on public.project_images for delete to authenticated using (public.is_admin());

-- Table privileges (RLS above decides which rows).
grant usage on schema public to anon, authenticated;
grant select on public.profile, public.projects, public.project_images to anon, authenticated;
grant insert, update, delete on public.projects, public.project_images to authenticated;
grant update on public.profile to authenticated;
grant select on public.admins to authenticated;
-- Supabase grants every role full table privileges by default; take away what visitors never need.
revoke insert, update, delete, truncate on public.profile, public.projects, public.project_images, public.admins from anon;
revoke select on public.admins from anon;
revoke insert, update, delete, truncate on public.admins from authenticated;

-- ---------- Storage bucket --------------------------------------------------
-- Private bucket: files are only readable through the policies below.
-- Paths: profile/<file>  and  projects/<project-id>/<file>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', false, 10485760, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_portfolio_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_admin()
    or split_part(object_name, '/', 1) = 'profile'
    or (
      split_part(object_name, '/', 1) = 'projects'
      and exists (
        select 1 from public.projects p
        where p.id::text = split_part(object_name, '/', 2) and p.published
      )
    );
$$;
revoke all on function public.can_read_portfolio_object(text) from public;
grant execute on function public.can_read_portfolio_object(text) to anon, authenticated;

drop policy if exists "portfolio: read published" on storage.objects;
create policy "portfolio: read published" on storage.objects for select to anon, authenticated
  using (bucket_id = 'portfolio' and public.can_read_portfolio_object(name));
drop policy if exists "portfolio: admins upload" on storage.objects;
create policy "portfolio: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and public.is_admin());
drop policy if exists "portfolio: admins update" on storage.objects;
create policy "portfolio: admins update" on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and public.is_admin()) with check (bucket_id = 'portfolio' and public.is_admin());
drop policy if exists "portfolio: admins delete" on storage.objects;
create policy "portfolio: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and public.is_admin());

-- ---------- Seed (only on first run) ----------------------------------------
insert into public.profile (id, name, intro)
values (1, 'Neel Verma', 'I am a student and developer who designs and builds websites and digital products — from football games and simulations to tools that make everyday life a little easier.')
on conflict (id) do nothing;

insert into public.projects (name, description, url, layout, position, published)
select * from (values
  ('Touchline', 'A football management simulation. Placeholder description — edit this in the admin dashboard.', null::text, 'full', 1, true),
  ('Ball Knowledge', 'A football knowledge game. Placeholder description — edit this in the admin dashboard.', null, 'left', 2, true),
  ('OIStexas', 'A multiplayer Texas Hold''em website. Placeholder description — edit this in the admin dashboard.', null, 'right', 3, true),
  ('My Planner', 'An AI-powered personal planner. Placeholder description — edit this in the admin dashboard.', null, 'full', 4, true),
  ('OIS LTFB', 'Placeholder description — edit this in the admin dashboard.', 'https://ois-ltfb-8g91.vercel.app/', 'left', 5, true),
  ('Lunchtime Football', 'Placeholder description — edit this in the admin dashboard.', 'https://lunchtime-football.vercel.app/', 'right', 6, true)
) as seed(name, description, url, layout, position, published)
where not exists (select 1 from public.projects);
