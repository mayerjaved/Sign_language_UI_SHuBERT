# Supabase Auth Setup

This app uses Supabase Auth for email/password and Google sign-in. The frontend must only receive public Supabase values.

## Environment Variables

Add these to `.env.local` for local development and to Vercel project environment variables for deployment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://hqocuvbgloogqnrboxgp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

For the local FastAPI backend, use backend-only environment variables:

```env
SUPABASE_URL=https://hqocuvbgloogqnrboxgp.supabase.co
SUPABASE_SECRET_KEY=sb_secret_your_rotated_backend_key
```

Never put `SUPABASE_SECRET_KEY` or any `sb_secret_...` key in frontend code, `NEXT_PUBLIC_*` variables, or browser-visible Vercel variables.

## Google Login

In Supabase, enable Google under Authentication > Sign In / Providers.

In Google Cloud, create an OAuth Client ID with:

```text
Application type: Web application
Authorized JavaScript origins:
  http://localhost:3000
  https://sign-language-ui-s-hu-bert-4cmij6xks-mr2ballin-9654s-projects.vercel.app
  https://your-production-domain.com

Authorized redirect URIs:
  https://hqocuvbgloogqnrboxgp.supabase.co/auth/v1/callback
```

Then paste the Google Client ID and Client Secret into the Google provider settings in Supabase.

In Supabase Authentication > URL Configuration, set:

```text
Site URL:
  https://sign-language-ui-s-hu-bert-4cmij6xks-mr2ballin-9654s-projects.vercel.app

Redirect URLs:
  http://localhost:3000/auth/callback
  https://sign-language-ui-s-hu-bert-4cmij6xks-mr2ballin-9654s-projects.vercel.app/auth/callback
  https://your-production-domain.com/auth/callback
```

## Initial Database Shape

Run this in Supabase SQL Editor when you are ready to store profiles and learning scores in Supabase.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  current_path text,
  user_agent text,
  page_view_count integer not null default 1 check (page_view_count >= 0),
  duration_seconds integer generated always as (
    greatest(
      0,
      extract(epoch from (coalesce(ended_at, last_seen_at) - started_at))::integer
    )
  ) stored
);

create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  score numeric not null check (score >= 0 and score <= 100),
  feedback jsonb not null default '{}'::jsonb,
  model_version text,
  confirmed boolean,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  best_score numeric not null default 0 check (best_score >= 0 and best_score <= 100),
  attempts_count integer not null default 0 check (attempts_count >= 0),
  last_attempt_at timestamptz,
  primary key (user_id, word_id)
);

alter table public.profiles enable row level security;
alter table public.app_sessions enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_progress enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can read their own app sessions"
on public.app_sessions for select
using (auth.uid() = user_id);

create policy "Users can insert their own app sessions"
on public.app_sessions for insert
with check (auth.uid() = user_id);

create policy "Users can update their own app sessions"
on public.app_sessions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read their own attempts"
on public.learning_attempts for select
using (auth.uid() = user_id);

create policy "Users can read their own progress"
on public.learning_progress for select
using (auth.uid() = user_id);

create or replace function public.increment_app_session_page_views(
  session_id uuid,
  session_user_id uuid,
  current_page text
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.app_sessions
  set
    page_view_count = page_view_count + 1,
    current_path = current_page,
    last_seen_at = now()
  where id = session_id
    and user_id = session_user_id
    and user_id = auth.uid();
$$;
```

The backend should insert `learning_attempts` and update `learning_progress` with the backend secret key after it verifies the user's Supabase JWT. Do not allow browser inserts for trusted scores.

## Where To See Users And Usage

Supabase built-in auth users:

```text
Supabase Dashboard > Authentication > Users
```

This shows accounts, providers, creation time, and last sign-in metadata managed by Supabase Auth.

App usage tables:

```text
Supabase Dashboard > Table Editor > profiles
Supabase Dashboard > Table Editor > app_sessions
```

Useful SQL reports:

```sql
select
  p.email,
  p.display_name,
  p.last_seen_at,
  count(s.id) as session_count,
  sum(s.duration_seconds) as total_seconds,
  round(sum(s.duration_seconds) / 60.0, 1) as total_minutes,
  max(s.last_seen_at) as most_recent_activity
from public.profiles p
left join public.app_sessions s on s.user_id = p.id
group by p.id, p.email, p.display_name, p.last_seen_at
order by most_recent_activity desc nulls last;
```

```sql
select
  p.email,
  s.started_at,
  s.ended_at,
  s.last_seen_at,
  s.duration_seconds,
  round(s.duration_seconds / 60.0, 1) as duration_minutes,
  s.page_view_count,
  s.current_path
from public.app_sessions s
join public.profiles p on p.id = s.user_id
order by s.started_at desc;
```
