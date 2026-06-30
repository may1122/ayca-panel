create extension if not exists "uuid-ossp";
create table if not exists public.companies(id uuid primary key default uuid_generate_v4(),name text not null,city text,type text default 'pharmacy',status text not null default 'demo' check(status in('active','demo','passive')),package_name text default 'Demo',trial_ends_at date,subscription_ends_at date,created_at timestamptz not null default now());
create table if not exists public.profiles(id uuid primary key references auth.users(id) on delete cascade,email text not null,full_name text,role text not null default 'customer' check(role in('admin','customer')),company_id uuid references public.companies(id) on delete set null,created_at timestamptz not null default now());
create table if not exists public.demo_access(id uuid primary key default uuid_generate_v4(),company_id uuid not null references public.companies(id) on delete cascade,product text not null check(product in('nobet','insight')),is_active boolean not null default true,streamlit_url text not null,created_at timestamptz not null default now());
create table if not exists public.payments(id uuid primary key default uuid_generate_v4(),company_id uuid not null references public.companies(id) on delete cascade,amount numeric(12,2) not null,currency text not null default 'TRY',status text not null default 'pending' check(status in('pending','paid','failed','cancelled')),due_date date,paid_at timestamptz,created_at timestamptz not null default now());
create or replace function public.handle_new_user() returns trigger as $$ begin insert into public.profiles(id,email,full_name,role) values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''),'customer'); return new; end; $$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users; create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
insert into public.companies(name,city,type,status,package_name,trial_ends_at,subscription_ends_at) values('Demo Eczanesi','Kahramanmaraş','pharmacy','demo','Demo Paket',current_date+interval '14 days',current_date+interval '14 days') on conflict do nothing;
alter table public.companies enable row level security; alter table public.profiles enable row level security; alter table public.demo_access enable row level security; alter table public.payments enable row level security;
create or replace function public.is_admin() returns boolean as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin'); $$ language sql stable security definer;
drop policy if exists profiles_select_own_or_admin on public.profiles; create policy profiles_select_own_or_admin on public.profiles for select using(id=auth.uid() or public.is_admin());
drop policy if exists profiles_update_own_or_admin on public.profiles; create policy profiles_update_own_or_admin on public.profiles for update using(id=auth.uid() or public.is_admin());
drop policy if exists companies_select_own_or_admin on public.companies; create policy companies_select_own_or_admin on public.companies for select using(public.is_admin() or id in(select company_id from public.profiles where profiles.id=auth.uid()));
drop policy if exists companies_update_admin_only on public.companies; create policy companies_update_admin_only on public.companies for update using(public.is_admin());
drop policy if exists companies_insert_admin_only on public.companies; create policy companies_insert_admin_only on public.companies for insert with check(public.is_admin());
drop policy if exists demo_access_select_own_or_admin on public.demo_access; create policy demo_access_select_own_or_admin on public.demo_access for select using(public.is_admin() or company_id in(select company_id from public.profiles where profiles.id=auth.uid()));
drop policy if exists demo_access_admin_all on public.demo_access; create policy demo_access_admin_all on public.demo_access for all using(public.is_admin()) with check(public.is_admin());
drop policy if exists payments_select_own_or_admin on public.payments; create policy payments_select_own_or_admin on public.payments for select using(public.is_admin() or company_id in(select company_id from public.profiles where profiles.id=auth.uid()));
drop policy if exists payments_admin_all on public.payments; create policy payments_admin_all on public.payments for all using(public.is_admin()) with check(public.is_admin());
create table if not exists public.dashboard_metrics (
  id uuid primary key default uuid_generate_v4(),
  company_id uuid not null references public.companies(id) on delete cascade,
  risk_score numeric(5,2),
  critical_stock_count integer default 0,
  estimated_lost_profit numeric(12,2) default 0,
  estimated_order_amount numeric(12,2) default 0,
  ai_suggestion_count integer default 0,
  created_at timestamptz not null default now()
);

alter table public.dashboard_metrics enable row level security;

drop policy if exists dashboard_metrics_select_own_or_admin on public.dashboard_metrics;
create policy dashboard_metrics_select_own_or_admin
on public.dashboard_metrics
for select
using (
  public.is_admin()
  or company_id in (
    select company_id
    from public.profiles
    where profiles.id = auth.uid()
  )
);

drop policy if exists dashboard_metrics_admin_all on public.dashboard_metrics;
create policy dashboard_metrics_admin_all
on public.dashboard_metrics
for all
using (public.is_admin())
with check (public.is_admin());