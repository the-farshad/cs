-- Initial schema for cs.thefarshad.com API.
-- Idempotent: safe to run repeatedly on startup.

-- gen_random_uuid() lives in pgcrypto.
create extension if not exists "pgcrypto";

-- Accounts. Created/looked up by email on magic-link verify.
create table if not exists users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  handle     text not null,
  created_at timestamptz default now()
);

-- Single-use, short-lived magic-link tokens.
create table if not exists magic_tokens (
  token      text primary key,
  email      text not null,
  expires_at timestamptz not null,
  used       boolean default false,
  created_at timestamptz default now()
);

-- Per-user completed lesson/problem refs. One row per completed ref.
create table if not exists progress (
  user_id      uuid references users(id) on delete cascade,
  ref_id       text not null,
  completed_at timestamptz default now(),
  primary key (user_id, ref_id)
);
