-- One-off: promote a registered account to admin.
-- Run in Supabase Studio's SQL editor AFTER signing up through the app.
-- There is no automated alternative that is not a self-promotion hole.
--
-- Replace the email, then run.

update profiles
set role = 'admin', updated_at = now()
where email = 'holysliit5@gmail.com';

select id, email, role, status from profiles where role = 'admin';
