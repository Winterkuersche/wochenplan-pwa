-- Per-account planning document with optimistic concurrency and private history.
-- Run once on the Wochenplan project. No existing application data is changed.
begin;

create table public.wochenplan_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null check ((
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload->'storage'->'wochenplan_master_v10'->'employees') = 'array'
    and jsonb_typeof(payload->'storage'->'wochenplan_plan_v10') = 'object'
    and octet_length(payload::text) <= 4194304
  ) is true
  ),
  updated_at timestamptz not null default now()
);

create table public.wochenplan_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, revision)
);

alter table public.wochenplan_documents enable row level security;
alter table public.wochenplan_history enable row level security;
revoke all on public.wochenplan_documents, public.wochenplan_history from anon, public;
grant select, insert, update on public.wochenplan_documents to authenticated;
grant select, insert, delete on public.wochenplan_history to authenticated;

create policy "Own planning document read" on public.wochenplan_documents
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own planning document create" on public.wochenplan_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Own planning document update" on public.wochenplan_documents
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Own history read" on public.wochenplan_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Own history create" on public.wochenplan_history
  for insert to authenticated with check ((select auth.uid()) = user_id and pg_trigger_depth() > 0);
create policy "Own history retention" on public.wochenplan_history
  for delete to authenticated using ((select auth.uid()) = user_id and pg_trigger_depth() > 0);

create function public.wochenplan_check_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.revision <> 1 then raise exception 'Initial revision must be 1'; end if;
  else
    if new.user_id <> old.user_id or new.revision <> old.revision + 1 then
      raise exception 'Planning revision conflict';
    end if;
    if (old.payload#>'{storage,wochenplan_plan_v10}') ? 'vacationCalendar'
       and not coalesce((new.payload#>'{storage,wochenplan_plan_v10}') ? 'vacationCalendar',false)
       and new.payload#>'{capabilities,vacationCalendar}' is distinct from 'true'::jsonb then
      raise exception 'CLIENT_UPDATE_REQUIRED' using errcode='22023';
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create function public.wochenplan_record_history() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.wochenplan_history(user_id, revision, payload, created_at)
    values (new.user_id, new.revision, new.payload, new.updated_at);
  -- Keep the ten latest revisions plus the first revision from each of the
  -- latest thirty UTC calendar days. Navigation never creates cloud revisions.
  delete from public.wochenplan_history h
    where h.user_id = new.user_id and h.revision not in (
      select recent.revision from (
        select revision from public.wochenplan_history
        where user_id = new.user_id order by revision desc limit 10
      ) recent
      union
      select daily.revision from (
        select min(revision) as revision from public.wochenplan_history
        where user_id = new.user_id
        group by (created_at at time zone 'UTC')::date
        order by (created_at at time zone 'UTC')::date desc limit 30
      ) daily
    );
  return new;
end;
$$;
revoke all on function public.wochenplan_check_revision(), public.wochenplan_record_history() from public, anon;
grant execute on function public.wochenplan_check_revision(), public.wochenplan_record_history() to authenticated;

create trigger wochenplan_revision before insert or update on public.wochenplan_documents
  for each row execute function public.wochenplan_check_revision();
create trigger wochenplan_history after insert or update on public.wochenplan_documents
  for each row execute function public.wochenplan_record_history();

commit;
