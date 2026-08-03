create table if not exists public.tasks (
  user_id uuid not null default '00000000-0000-4000-8000-000000000001'::uuid,
  id text not null,
  title text not null check (length(trim(title)) > 0),
  start_date date not null,
  end_date date,
  owner text,
  category text not null check (category in ('health', 'growth', 'career', 'home', 'travel')),
  task_type text not null check (task_type in ('range', 'milestone')),
  is_ongoing boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint tasks_date_order check (end_date is null or end_date >= start_date)
);

create index if not exists tasks_user_sort_order_idx
  on public.tasks (user_id, sort_order);

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_tasks_updated_at();

alter table public.tasks enable row level security;

-- 家庭口令模式：anon 只能读写固定家庭 user_id 这一份数据
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

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    execute 'alter publication supabase_realtime add table public.tasks';
  end if;
end $$;
