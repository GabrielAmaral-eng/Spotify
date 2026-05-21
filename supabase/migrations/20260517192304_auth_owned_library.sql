create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  description text check (description is null or char_length(description) <= 240),
  cover text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  track_id text not null,
  title text not null,
  artist text not null,
  album text not null,
  thumbnail text not null default '',
  duration integer not null check (duration >= 0),
  preview_url text,
  track_order integer not null default 0,
  added_at timestamptz not null default now(),
  unique (playlist_id, track_id)
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  track_id text not null,
  title text not null,
  artist text not null,
  album text not null,
  thumbnail text not null default '',
  duration integer not null check (duration >= 0),
  preview_url text,
  created_at timestamptz not null default now(),
  unique (user_id, track_id)
);

create index if not exists playlists_user_created_idx
  on public.playlists (user_id, created_at desc);

create index if not exists playlist_tracks_playlist_order_idx
  on public.playlist_tracks (playlist_id, track_order asc);

create index if not exists favorites_user_created_idx
  on public.favorites (user_id, created_at desc);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.favorites enable row level security;

create policy "Users can read own playlists"
  on public.playlists
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own playlists"
  on public.playlists
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own playlists"
  on public.playlists
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own playlists"
  on public.playlists
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read tracks from own playlists"
  on public.playlist_tracks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

create policy "Users can add tracks to own playlists"
  on public.playlist_tracks
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

create policy "Users can update tracks in own playlists"
  on public.playlist_tracks
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

create policy "Users can remove tracks from own playlists"
  on public.playlist_tracks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.playlists
      where playlists.id = playlist_tracks.playlist_id
        and playlists.user_id = (select auth.uid())
    )
  );

create policy "Users can read own favorites"
  on public.favorites
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create own favorites"
  on public.favorites
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own favorites"
  on public.favorites
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own favorites"
  on public.favorites
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.playlists to authenticated;
grant select, insert, update, delete on public.playlist_tracks to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
