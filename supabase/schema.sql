-- Dentist AI Lead & Booking System — Supabase schema
-- Run this in Supabase SQL editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type lead_source as enum ('website', 'email', 'calendar', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new', 'contacted', 'booked', 'lost', 'spam');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_intent as enum (
    'new_patient', 'emergency', 'cleaning', 'price_inquiry', 'insurance',
    'reschedule', 'cancel', 'kids', 'invisalign', 'dental_work', 'general', 'spam'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_priority as enum ('urgent', 'normal', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type msg_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

do $$ begin
  create type appt_status as enum ('scheduled', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

-- ---------- leads ----------
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  first_name    text,
  last_name     text,
  email         text,
  phone         text,
  source        lead_source not null default 'website',
  status        lead_status not null default 'new',
  message       text,                      -- original inbound message
  service       text,                      -- service they asked about (free text)
  -- AI fields
  intent        lead_intent,
  priority      lead_priority default 'normal',
  ai_summary    text,
  ai_reply      text,                      -- suggested reply draft
  ai_processed_at timestamptz,
  -- email threading
  gmail_thread_id text,
  -- timing metrics
  first_reply_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_idx on leads(created_at desc);
create index if not exists leads_email_idx on leads(lower(email));
create unique index if not exists leads_gmail_thread_idx on leads(gmail_thread_id) where gmail_thread_id is not null;

-- ---------- messages (conversation per lead) ----------
create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  direction     msg_direction not null,
  channel       text not null default 'email',   -- email | website
  subject       text,
  body          text not null,
  gmail_message_id text unique,
  sent_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists messages_lead_idx on messages(lead_id, sent_at);

-- ---------- appointments (synced from Google Calendar) ----------
create table if not exists appointments (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid references leads(id) on delete set null,
  calendar_event_id text unique,
  title             text,
  patient_name      text,
  patient_email     text,
  service           text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  status            appt_status not null default 'scheduled',
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists appointments_start_idx on appointments(starts_at);

-- ---------- clinic settings (single row) ----------
create table if not exists clinic_settings (
  id                int primary key default 1 check (id = 1),
  clinic_name       text not null default 'Swish Dental',
  clinic_email      text,
  phone             text,
  address           text,
  hours             text default 'Mon–Fri 8am–6pm, Sat 9am–2pm',
  services          text default 'The Essentials (exam, cleaning, x-rays, whitening); Kids Dentistry; Dental Work (fillings, crowns, restorative); Invisalign',
  pricing_notes     text default 'New patient exam + cleaning from $199. Most insurance accepted. Financing available.',
  insurance         text default 'Delta Dental, Cigna, Aetna, MetLife, Northeast Delta, MaineCare',
  tone              text default 'Warm, friendly, concise. Never diagnose. Always offer to book.',
  booking_link      text,
  auto_reply        boolean not null default false,   -- auto-send simple replies
  daily_summary_email text,
  updated_at        timestamptz not null default now()
);

insert into clinic_settings (id) values (1) on conflict (id) do nothing;

-- ---------- google oauth tokens (single row) ----------
create table if not exists google_tokens (
  id            int primary key default 1 check (id = 1),
  access_token  text,
  refresh_token text,
  expiry_date   bigint,
  scope         text,
  email         text,
  gmail_history_id text,
  last_gmail_sync timestamptz,
  last_calendar_sync timestamptz,
  updated_at    timestamptz not null default now()
);

-- ---------- updated_at trigger ----------
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

do $$ begin
  create trigger leads_updated before update on leads for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger appointments_updated before update on appointments for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;
do $$ begin
  create trigger settings_updated before update on clinic_settings for each row execute function set_updated_at();
exception when duplicate_object then null; end $$;

-- ---------- RLS: server uses service role; lock everything else ----------
alter table leads enable row level security;
alter table messages enable row level security;
alter table appointments enable row level security;
alter table clinic_settings enable row level security;
alter table google_tokens enable row level security;
