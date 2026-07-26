drop policy if exists "assignments read by authorized users" on public.schedule_assignments;
create policy "assignments read by authorized users"
on public.schedule_assignments
for select to authenticated
using (
  user_id = (select auth.uid())
  and public.is_active_schedule_participant(department_schedule_id, user_id)
);
