import type { Track } from '../../types/track';
import { HttpError } from '../../utils/http-error';
import { createSupabaseUserClient } from '../../lib/supabase';

interface PlaylistRow {
  id: string;
  name: string;
  description: string | null;
  cover: string | null;
  created_at: string;
}

interface PlaylistTrackRow {
  playlist_id: string;
  track_id: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  preview_url: string | null;
  track_order: number;
}

interface FavoriteRow {
  track_id: string;
  title: string;
  artist: string;
  album: string;
  thumbnail: string;
  duration: number;
  preview_url: string | null;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  cover?: string;
  tracks: Track[];
  createdAt: string;
}

class LibraryService {
  async listPlaylists(accessToken: string): Promise<Playlist[]> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data: playlists, error: playlistsError } = await supabase
      .from('playlists')
      .select('id, name, description, cover, created_at')
      .order('created_at', { ascending: false });

    if (playlistsError) {
      throw playlistsError;
    }

    if (!playlists || playlists.length === 0) {
      return [];
    }

    const playlistIds = playlists.map((playlist) => playlist.id);
    const { data: tracks, error: tracksError } = await supabase
      .from('playlist_tracks')
      .select(
        'playlist_id, track_id, title, artist, album, thumbnail, duration, preview_url, track_order'
      )
      .in('playlist_id', playlistIds)
      .order('track_order', { ascending: true });

    if (tracksError) {
      throw tracksError;
    }

    return playlists.map((playlist) =>
      this.mapPlaylist(playlist as PlaylistRow, (tracks ?? []) as PlaylistTrackRow[])
    );
  }

  async getPlaylist(accessToken: string, id: string): Promise<Playlist> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data: playlist, error: playlistError } = await supabase
      .from('playlists')
      .select('id, name, description, cover, created_at')
      .eq('id', id)
      .maybeSingle();

    if (playlistError) {
      throw playlistError;
    }

    if (!playlist) {
      throw new HttpError('Playlist não encontrada.', 404);
    }

    const { data: tracks, error: tracksError } = await supabase
      .from('playlist_tracks')
      .select(
        'playlist_id, track_id, title, artist, album, thumbnail, duration, preview_url, track_order'
      )
      .eq('playlist_id', id)
      .order('track_order', { ascending: true });

    if (tracksError) {
      throw tracksError;
    }

    return this.mapPlaylist(playlist as PlaylistRow, (tracks ?? []) as PlaylistTrackRow[]);
  }

  async createPlaylist(
    accessToken: string,
    userId: string,
    name: string,
    description?: string
  ): Promise<Playlist> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data, error } = await supabase
      .from('playlists')
      .insert({
        user_id: userId,
        name,
        description: description || null
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return this.getPlaylist(accessToken, data.id as string);
  }

  async updatePlaylist(
    accessToken: string,
    id: string,
    name: string,
    description?: string | null
  ): Promise<Playlist> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data, error } = await supabase
      .from('playlists')
      .update({
        name,
        description: description || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new HttpError('Playlist não encontrada.', 404);
    }

    return this.getPlaylist(accessToken, id);
  }

  async deletePlaylist(accessToken: string, id: string): Promise<void> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data, error } = await supabase.from('playlists').delete().eq('id', id).select('id');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      throw new HttpError('Playlist não encontrada.', 404);
    }
  }

  async addTrackToPlaylist(
    accessToken: string,
    playlistId: string,
    track: Track
  ): Promise<Playlist> {
    const supabase = createSupabaseUserClient(accessToken);
    const playlist = await this.getPlaylist(accessToken, playlistId);
    const existingTrack = playlist.tracks.some((item) => item.id === track.id);

    if (existingTrack) {
      const { error } = await supabase
        .from('playlist_tracks')
        .update(this.toTrackPayload(track))
        .eq('playlist_id', playlistId)
        .eq('track_id', track.id);

      if (error) {
        throw error;
      }

      return this.getPlaylist(accessToken, playlistId);
    }

    const { data: lastTrack, error: orderError } = await supabase
      .from('playlist_tracks')
      .select('track_order')
      .eq('playlist_id', playlistId)
      .order('track_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    const nextOrder = Number(lastTrack?.track_order ?? -1) + 1;
    const { error } = await supabase.from('playlist_tracks').insert({
      playlist_id: playlistId,
      track_id: track.id,
      ...this.toTrackPayload(track),
      track_order: nextOrder
    });

    if (error) {
      throw error;
    }

    return this.getPlaylist(accessToken, playlistId);
  }

  async removeTrackFromPlaylist(
    accessToken: string,
    playlistId: string,
    trackId: string
  ): Promise<void> {
    const supabase = createSupabaseUserClient(accessToken);
    await this.getPlaylist(accessToken, playlistId);
    const { error } = await supabase
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('track_id', trackId);

    if (error) {
      throw error;
    }
  }

  async listFavorites(accessToken: string): Promise<Track[]> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data, error } = await supabase
      .from('favorites')
      .select('track_id, title, artist, album, thumbnail, duration, preview_url')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as FavoriteRow[]).map((favorite) => this.mapTrack(favorite));
  }

  async favoriteTrack(
    accessToken: string,
    userId: string,
    track: Track
  ): Promise<Track> {
    const supabase = createSupabaseUserClient(accessToken);
    const { data, error } = await supabase
      .from('favorites')
      .upsert(
        {
          user_id: userId,
          track_id: track.id,
          ...this.toTrackPayload(track)
        },
        {
          onConflict: 'user_id,track_id'
        }
      )
      .select('track_id, title, artist, album, thumbnail, duration, preview_url')
      .single();

    if (error) {
      throw error;
    }

    return this.mapTrack(data as FavoriteRow);
  }

  async unfavoriteTrack(accessToken: string, trackId: string): Promise<void> {
    const supabase = createSupabaseUserClient(accessToken);
    const { error } = await supabase.from('favorites').delete().eq('track_id', trackId);

    if (error) {
      throw error;
    }
  }

  private toTrackPayload(track: Track): Omit<FavoriteRow, 'track_id'> {
    return {
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      preview_url: track.previewUrl
    };
  }

  private mapPlaylist(playlist: PlaylistRow, tracks: PlaylistTrackRow[]): Playlist {
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? undefined,
      cover: playlist.cover ?? undefined,
      tracks: tracks
        .filter((track) => track.playlist_id === playlist.id)
        .map((track) => this.mapTrack(track)),
      createdAt: playlist.created_at
    };
  }

  private mapTrack(track: FavoriteRow | PlaylistTrackRow): Track {
    return {
      id: track.track_id,
      source: 'spotify',
      title: track.title,
      artist: track.artist,
      album: track.album,
      thumbnail: track.thumbnail,
      duration: track.duration,
      previewUrl: track.preview_url
    };
  }
}

export const libraryService = new LibraryService();
