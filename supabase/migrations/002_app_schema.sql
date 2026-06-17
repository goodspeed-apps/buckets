-- 002_app_schema.sql — app-specific domain tables.
-- Generated deterministically by DevAgent from architecture.dataModels.
-- Do NOT recreate tables from 001_base_schema.sql.

-- Users (users)
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text,
  created_at timestamptz default now() not null,
  subscription_tier text not null,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  revenuecat_customer_id text,
  onboarding_completed boolean not null,
  avatar_initials text,
  theme_preference text not null,
  pay_frequency text,
  pay_day text,
  notifications_enabled boolean not null,
  paycheck_reminder_enabled boolean not null,
  due_date_warning_enabled boolean not null,
  monthly_summary_notif_enabled boolean not null,
  post_onboarding_upsell_shown_at timestamptz,
  last_monthly_summary_shown text,
  push_token text,
  updated_at timestamptz default now() not null
);
alter table public.users enable row level security;
drop policy if exists "users_select_self" on public.users;
create policy "users_select_self" on public.users for select using (auth.uid() = id);
drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users for update using (auth.uid() = id) with check (auth.uid() = id);

-- Buckets (buckets)
create table if not exists public.buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  target_amount numeric(12,2) not null,
  target_date date not null,
  monthly_set_aside numeric(10,2) not null,
  total_saved numeric(12,2) not null,
  status text not null,
  template_id uuid,
  archived_at timestamptz,
  funded_at timestamptz,
  sort_order integer not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index if not exists buckets_user_id_idx on public.buckets(user_id);
alter table public.buckets enable row level security;
drop policy if exists "buckets_select_own" on public.buckets;
create policy "buckets_select_own" on public.buckets for select using (auth.uid() = user_id);
drop policy if exists "buckets_insert_own" on public.buckets;
create policy "buckets_insert_own" on public.buckets for insert with check (auth.uid() = user_id);
drop policy if exists "buckets_update_own" on public.buckets;
create policy "buckets_update_own" on public.buckets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "buckets_delete_own" on public.buckets;
create policy "buckets_delete_own" on public.buckets for delete using (auth.uid() = user_id);

-- Contributions (contributions)
create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  bucket_id uuid not null,
  user_id uuid not null,
  amount numeric(10,2) not null,
  contributed_on date not null,
  note text,
  running_total_after numeric(12,2) not null,
  created_at timestamptz default now() not null
);
create index if not exists contributions_user_id_idx on public.contributions(user_id);
alter table public.contributions enable row level security;
drop policy if exists "contributions_select_own" on public.contributions;
create policy "contributions_select_own" on public.contributions for select using (auth.uid() = user_id);
drop policy if exists "contributions_insert_own" on public.contributions;
create policy "contributions_insert_own" on public.contributions for insert with check (auth.uid() = user_id);
drop policy if exists "contributions_update_own" on public.contributions;
create policy "contributions_update_own" on public.contributions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "contributions_delete_own" on public.contributions;
create policy "contributions_delete_own" on public.contributions for delete using (auth.uid() = user_id);

-- BucketTemplates (bucket_templates)
create table if not exists public.bucket_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_key text not null,
  suggested_amount numeric(10,2) not null,
  smart_date_hint text not null,
  smart_date_logic jsonb not null,
  description text,
  sort_order integer not null,
  is_active boolean not null
);
alter table public.bucket_templates enable row level security;
drop policy if exists "bucket_templates_read_public" on public.bucket_templates;
drop policy if exists "bucket_templates_select_scoped" on public.bucket_templates;
drop policy if exists "bucket_templates_read_authenticated" on public.bucket_templates;
drop policy if exists "bucket_templates_update_scoped" on public.bucket_templates;
drop policy if exists "bucket_templates_delete_scoped" on public.bucket_templates;
create policy "bucket_templates_read_public" on public.bucket_templates for select to anon, authenticated using (true);

-- NotificationLogs (notification_logs)
create table if not exists public.notification_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  notification_type text not null,
  bucket_id uuid,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null,
  expo_ticket_id text,
  created_at timestamptz default now() not null
);
create index if not exists notification_logs_user_id_idx on public.notification_logs(user_id);
alter table public.notification_logs enable row level security;
drop policy if exists "notification_logs_select_own" on public.notification_logs;
create policy "notification_logs_select_own" on public.notification_logs for select using (auth.uid() = user_id);
drop policy if exists "notification_logs_insert_own" on public.notification_logs;
create policy "notification_logs_insert_own" on public.notification_logs for insert with check (auth.uid() = user_id);
drop policy if exists "notification_logs_update_own" on public.notification_logs;
create policy "notification_logs_update_own" on public.notification_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "notification_logs_delete_own" on public.notification_logs;
create policy "notification_logs_delete_own" on public.notification_logs for delete using (auth.uid() = user_id);

-- SubscriptionEvents (subscription_events)
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  revenuecat_product_id text not null,
  price_usd numeric(8,2),
  effective_at timestamptz not null,
  expires_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz default now() not null
);
create index if not exists subscription_events_user_id_idx on public.subscription_events(user_id);
alter table public.subscription_events enable row level security;
drop policy if exists "subscription_events_select_own" on public.subscription_events;
create policy "subscription_events_select_own" on public.subscription_events for select using (auth.uid() = user_id);
drop policy if exists "subscription_events_insert_own" on public.subscription_events;
create policy "subscription_events_insert_own" on public.subscription_events for insert with check (auth.uid() = user_id);
drop policy if exists "subscription_events_update_own" on public.subscription_events;
create policy "subscription_events_update_own" on public.subscription_events for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "subscription_events_delete_own" on public.subscription_events;
create policy "subscription_events_delete_own" on public.subscription_events for delete using (auth.uid() = user_id);

-- Foreign keys (PostgREST embedded joins depend on these).
do $$ begin
  alter table public.contributions add constraint contributions_bucket_id_fkey foreign key (bucket_id) references public.buckets(id) on delete cascade;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.notification_logs add constraint notification_logs_bucket_id_fkey foreign key (bucket_id) references public.buckets(id) on delete set null;
exception when duplicate_object then null; end $$;
