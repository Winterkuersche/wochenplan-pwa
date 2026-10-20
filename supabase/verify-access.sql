-- Synthetic RLS, concurrency, payload and history tests; all rows are rolled back.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000101'), ('00000000-0000-4000-8000-000000000102');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}', true);
insert into public.wochenplan_documents(user_id,payload) values (
  '00000000-0000-4000-8000-000000000101',
  '{"backupVersion":2,"storage":{"wochenplan_master_v10":{"employees":[]},"wochenplan_plan_v10":{"schedule":{}},"wochenplan_ui_v10":{}}}'
);
do $$
declare affected integer;
begin
  assert (select count(*) from public.wochenplan_documents) = 1, 'Owner cannot read own plan';
  assert (select count(*) from public.wochenplan_history) = 1, 'First save has no history';
  begin
    insert into public.wochenplan_history(user_id,revision,payload) values ('00000000-0000-4000-8000-000000000101',999,'{}');
    raise exception 'Client can forge a history entry';
  exception when insufficient_privilege then null;
  end;
  delete from public.wochenplan_history;
  get diagnostics affected = row_count;
  assert affected = 0, 'Client can delete the server-maintained history';
  begin
    insert into public.wochenplan_documents(user_id,payload) select '00000000-0000-4000-8000-000000000102',payload from public.wochenplan_documents;
    raise exception 'Cross-account insert was allowed';
  exception when insufficient_privilege then null;
  end;
  update public.wochenplan_documents set revision = 2 where revision = 1;
  update public.wochenplan_documents set revision = 2 where revision = 1;
  get diagnostics affected = row_count;
  assert affected = 0, 'Stale revision overwrote another save';
  for rev in 3..25 loop
    update public.wochenplan_documents set revision = rev where revision = rev - 1;
  end loop;
  assert (select count(*) from public.wochenplan_history) = 11, 'Retention must keep ten latest and first daily';
  assert exists(select 1 from public.wochenplan_history where revision = 1), 'First daily snapshot was lost';
end;
$$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000102","role":"authenticated"}', true);
do $$
begin
  assert (select count(*) from public.wochenplan_documents) = 0, 'Other account can read plans';
  assert (select count(*) from public.wochenplan_history) = 0, 'Other account can read history';
  begin
    insert into public.wochenplan_documents(user_id,payload) values ('00000000-0000-4000-8000-000000000102','{}');
    raise exception 'Invalid payload was accepted';
  exception when check_violation then null;
  end;
end;
$$;
set local role anon;
do $$
begin
  begin
    perform * from public.wochenplan_documents;
    raise exception 'Anonymous plan access was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.wochenplan_history;
    raise exception 'Anonymous history access was allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
select 'RLS isolation, payload validation, revision conflict and history retention passed; no test data retained' as result;
