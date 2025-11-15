-- Supabase schema for StudyBuddy Live
create table if not exists public.sessions (
  id uuid primary key,
  created_by uuid references auth.users(id) default auth.uid(),
  created_at timestamp with time zone default now(),
  intensity text check (intensity in ('minimal','standard','high')) not null,
  course_summary text,
  current_problem_crop_url text,
  last_emotion text,
  status text default 'active'
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete cascade,
  role text check (role in ('user','ai')) not null,
  text text not null,
  emotion_at_time text,
  created_at timestamp with time zone default now()
);

-- Storage bucket for frames and crops
-- In the Supabase dashboard, create a bucket named 'studybuddy-frames'
-- and set public read for demo purposes.


