-- 已有库升级到「家庭口令」共享模式：在 Supabase SQL Editor 执行一次

alter table public.tasks
  alter column user_id set default '00000000-0000-4000-8000-000000000001'::uuid;

-- 家庭共享不再绑定登录用户，去掉对 auth.users 的外键
alter table public.tasks drop constraint if exists tasks_user_id_fkey;

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;
drop policy if exists "tasks_select_family" on public.tasks;
drop policy if exists "tasks_insert_family" on public.tasks;
drop policy if exists "tasks_update_family" on public.tasks;
drop policy if exists "tasks_delete_family" on public.tasks;

create policy "tasks_select_family"
on public.tasks for select
to anon, authenticated
using (user_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy "tasks_insert_family"
on public.tasks for insert
to anon, authenticated
with check (user_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy "tasks_update_family"
on public.tasks for update
to anon, authenticated
using (user_id = '00000000-0000-4000-8000-000000000001'::uuid)
with check (user_id = '00000000-0000-4000-8000-000000000001'::uuid);

create policy "tasks_delete_family"
on public.tasks for delete
to anon, authenticated
using (user_id = '00000000-0000-4000-8000-000000000001'::uuid);

grant select, insert, update, delete on table public.tasks to anon, authenticated;
