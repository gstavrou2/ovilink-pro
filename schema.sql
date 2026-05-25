-- ============================================================
-- OVIlink Pro — Complete Database Schema
-- Τρέξε στο Supabase SQL Editor
-- ============================================================

-- =====================
-- TABLE: farms (tenants)
-- =====================
create table if not exists farms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  phone       text,
  email       text,
  notes       text,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- =====================
-- TABLE: users
-- =====================
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text not null,
  role          text not null default 'viewer' check (role in ('super_admin','admin','manager','viewer')),
  farm_id       uuid references farms(id) on delete set null,
  is_active     boolean default true,
  last_login    timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists users_email_idx on users(email);
create index if not exists users_farm_idx on users(farm_id);

-- =====================
-- TABLE: refresh_tokens
-- =====================
create table if not exists refresh_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

create index if not exists rt_user_idx on refresh_tokens(user_id);

-- =====================
-- TABLE: password_reset_tokens
-- =====================
create table if not exists password_reset_tokens (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  token       text not null unique,
  expires_at  timestamptz not null,
  created_at  timestamptz default now()
);

-- =====================
-- TABLE: module_licenses
-- =====================
create table if not exists module_licenses (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references farms(id) on delete cascade,
  module_name   text not null,
  license_key   text not null unique,
  is_active     boolean default true,
  expires_at    timestamptz,
  max_users     int,
  activated_at  timestamptz,
  created_at    timestamptz default now()
);

create index if not exists ml_farm_idx on module_licenses(farm_id);
create index if not exists ml_module_idx on module_licenses(farm_id, module_name);

-- =====================
-- TABLE: audit_logs
-- =====================
create table if not exists audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete set null,
  farm_id     uuid references farms(id) on delete set null,
  action      text not null,
  resource    text not null,
  resource_id uuid,
  ip_address  text,
  user_agent  text,
  details     jsonb,
  created_at  timestamptz default now()
);

create index if not exists al_farm_idx on audit_logs(farm_id);
create index if not exists al_created_idx on audit_logs(created_at desc);

-- =====================
-- TABLE: animals
-- =====================
create table if not exists animals (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  code        text not null,
  type        text not null check (type in ('sheep','goat')),
  breed       text,
  dob         date,
  ear_tag     text,
  status      text not null default 'active' check (status in ('active','dry','pregnant','sold','dead')),
  mother_code text,
  father_code text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(farm_id, code)
);

create index if not exists animals_farm_idx on animals(farm_id);

-- =====================
-- TABLE: milk_records
-- =====================
create table if not exists milk_records (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  animal_id   uuid not null references animals(id) on delete cascade,
  date        date not null,
  morning     numeric(6,2) default 0,
  evening     numeric(6,2) default 0,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists mr_farm_idx on milk_records(farm_id);
create index if not exists mr_date_idx on milk_records(date);

-- =====================
-- TABLE: milk_daily_totals
-- =====================
create table if not exists milk_daily_totals (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references farms(id) on delete cascade,
  date          date not null,
  sheep_morning numeric(8,2) default 0,
  sheep_evening numeric(8,2) default 0,
  goat_morning  numeric(8,2) default 0,
  goat_evening  numeric(8,2) default 0,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique(farm_id, date)
);

create index if not exists mdt_farm_idx on milk_daily_totals(farm_id);

-- =====================
-- TABLE: vaccines
-- =====================
create table if not exists vaccines (
  id           uuid primary key default gen_random_uuid(),
  farm_id      uuid not null references farms(id) on delete cascade,
  animal_id    uuid not null references animals(id) on delete cascade,
  group_id     uuid,
  vaccine_name text not null,
  date         date not null,
  next_date    date,
  vet_name     text,
  dose_ml      numeric(6,2),
  batch_no     text,
  notes        text,
  created_at   timestamptz default now()
);

create index if not exists vac_farm_idx on vaccines(farm_id);
create index if not exists vac_next_idx on vaccines(next_date);

-- =====================
-- TABLE: costs
-- =====================
create table if not exists costs (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  type        text not null check (type in ('expense','income')),
  category    text not null,
  group_id    uuid,
  date        date not null,
  amount      numeric(10,2) not null,
  description text,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists costs_farm_idx on costs(farm_id);
create index if not exists costs_date_idx on costs(date);

-- =====================
-- TABLE: animal_groups
-- =====================
create table if not exists animal_groups (
  id                 uuid primary key default gen_random_uuid(),
  farm_id            uuid not null references farms(id) on delete cascade,
  name               text not null,
  description        text,
  color              text default '#1D9E75',
  milk_threshold_kg  numeric(8,2),
  notify_email       text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

create index if not exists ag_farm_idx on animal_groups(farm_id);

-- =====================
-- TABLE: animal_group_members
-- =====================
create table if not exists animal_group_members (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  animal_id   uuid not null references animals(id) on delete cascade,
  group_id    uuid not null references animal_groups(id) on delete cascade,
  joined_date date not null default current_date,
  notes       text,
  created_at  timestamptz default now(),
  unique(animal_id)
);

-- =====================
-- TABLE: group_rations
-- =====================
create table if not exists group_rations (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references farms(id) on delete cascade,
  group_id      uuid not null references animal_groups(id) on delete cascade,
  feed_name     text not null,
  quantity_kg   numeric(8,3) not null default 0,
  cost_per_kg   numeric(8,3) default 0,
  valid_from    date not null default current_date,
  valid_to      date,
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists gr_farm_idx on group_rations(farm_id);
create index if not exists gr_active_idx on group_rations(group_id, is_active);

-- =====================
-- TABLE: warehouse_products
-- =====================
create table if not exists warehouse_products (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  name        text not null,
  category    text not null,
  unit        text not null default 'kg',
  quantity    numeric(10,2) default 0,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists wp_farm_idx on warehouse_products(farm_id);

-- =====================
-- TABLE: warehouse_movements
-- =====================
create table if not exists warehouse_movements (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  product_id  uuid not null references warehouse_products(id) on delete cascade,
  type        text not null check (type in ('in','out')),
  quantity    numeric(10,2) not null,
  date        date not null,
  reason      text,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists wm_farm_idx on warehouse_movements(farm_id);

-- =====================
-- TABLE: todos
-- =====================
create table if not exists todos (
  id            uuid primary key default gen_random_uuid(),
  farm_id       uuid not null references farms(id) on delete cascade,
  title         text not null,
  description   text,
  category      text not null,
  category_type text not null default 'unit' check (category_type in ('unit','personal')),
  priority      text not null default 'medium' check (priority in ('high','medium','low')),
  due_date      date,
  due_time      time,
  completed     boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists todos_farm_idx on todos(farm_id);

-- =====================
-- TABLE: notifications
-- =====================
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  farm_id     uuid not null references farms(id) on delete cascade,
  group_id    uuid references animal_groups(id) on delete cascade,
  type        text not null default 'milk_threshold',
  title       text not null,
  message     text not null,
  is_read     boolean default false,
  created_at  timestamptz default now()
);

create index if not exists notif_farm_idx on notifications(farm_id, is_read);

-- =====================
-- updated_at trigger
-- =====================
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger farms_updated_at before update on farms for each row execute function update_updated_at();
create trigger users_updated_at before update on users for each row execute function update_updated_at();
create trigger animals_updated_at before update on animals for each row execute function update_updated_at();
create trigger milk_daily_updated_at before update on milk_daily_totals for each row execute function update_updated_at();
create trigger animal_groups_updated_at before update on animal_groups for each row execute function update_updated_at();
create trigger group_rations_updated_at before update on group_rations for each row execute function update_updated_at();
create trigger warehouse_products_updated_at before update on warehouse_products for each row execute function update_updated_at();
create trigger todos_updated_at before update on todos for each row execute function update_updated_at();
