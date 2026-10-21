-- Actual hosted Auth/RPC roles, synthetic rows only; all changes roll back.
begin;
insert into auth.users(id) values ('30000000-0000-4000-8000-000000000001'),('30000000-0000-4000-8000-000000000002'),('30000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$
declare created jsonb; bid uuid; invitation jsonb; plan jsonb; payload jsonb;
begin
 payload:='{"backupVersion":2,"storage":{"wochenplan_master_v10":{"employees":[]},"wochenplan_plan_v10":{"schedule":{},"absences":[]},"wochenplan_ui_v10":{}}}';
 created:=public.wochenplan_collaboration('create',jsonb_build_object('name','Synthetic verification','display_name','TL Test','payload',payload));
 bid:=(created->>'id')::uuid;
 perform set_config('wp.test.branch',bid::text,true);
 plan:=public.wochenplan_collaboration('read',jsonb_build_object('branch_id',bid));
 assert (plan->>'can_edit')::boolean, 'Owner is not editable';
 invitation:=public.wochenplan_collaboration('invite',jsonb_build_object('branch_id',bid));
 perform set_config('wp.test.invite',invitation->>'token',true);
 begin
  perform 1 from wochenplan_private.plans;
  raise exception 'Direct table access was allowed';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
do $$ begin
 begin
  perform public.wochenplan_collaboration('read',jsonb_build_object('branch_id',current_setting('wp.test.branch')));
  raise exception 'Foreign account could read';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims','{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ declare plan jsonb; begin
 perform public.wochenplan_collaboration('accept_invite',jsonb_build_object('token',current_setting('wp.test.invite'),'display_name','SV Test'));
 plan:=public.wochenplan_collaboration('read',jsonb_build_object('branch_id',current_setting('wp.test.branch')));
 assert not (plan->>'can_edit')::boolean, 'Reader received edit rights';
 begin
  perform public.wochenplan_collaboration('save',jsonb_build_object('branch_id',current_setting('wp.test.branch'),'expected_revision',1,'payload',plan->'payload'));
  raise exception 'Reader could write';
 exception when insufficient_privilege then null; end;
 begin
  perform public.wochenplan_collaboration('grant',jsonb_build_object('branch_id',current_setting('wp.test.branch')));
  raise exception 'Reader could grant rights';
 exception when insufficient_privilege then null; end;
end $$;
set local role anon;
do $$ begin
 begin
  perform public.wochenplan_collaboration('list');
  raise exception 'Anonymous access was allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'Hosted collaboration authentication, owner/member isolation and direct-write restrictions passed; no test rows retained' as result;
