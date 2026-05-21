create table if not exists public.spotify_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  spotify_user_id text not null,
  spotify_display_name text,
  encrypted_refresh_token text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spotify_connections_spotify_user_idx
  on public.spotify_connections (spotify_user_id);

alter table public.spotify_connections enable row level security;

revoke all on public.spotify_connections from anon, authenticated;
