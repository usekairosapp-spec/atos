alter table public.positions
drop constraint if exists positions_default_slots_check;

alter table public.positions
add constraint positions_default_slots_positive check (default_slots >= 1);
