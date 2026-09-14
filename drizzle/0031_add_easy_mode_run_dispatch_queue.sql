alter table "easy_mode_runs"
add column "execution_lease_token" uuid,
add column "execution_lease_expires_at" timestamp with time zone,
add column "execution_lease_acquired_at" timestamp with time zone;

create unique index "easy_mode_runs_one_active_per_project_unique"
on "easy_mode_runs" using btree ("project_id")
where "status" in ('queued','running');

create index "easy_mode_runs_dispatch_queue_idx"
on "easy_mode_runs" using btree ("status","created_at");
