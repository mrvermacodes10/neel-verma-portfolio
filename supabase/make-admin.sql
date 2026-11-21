-- Run AFTER creating your login in Dashboard → Authentication → Users → Add user.
-- Replace the email below with the one you used, then Run.
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com'
on conflict (user_id) do nothing;

-- Check: should return one row with your email.
select u.email from public.admins a join auth.users u on u.id = a.user_id;
