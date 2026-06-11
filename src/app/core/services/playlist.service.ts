import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, map, tap, of, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Playlist } from '../../shared/models/playlist.model';
import { Track } from '../../shared/models/track.model';

interface PlaylistsResponse {
  playlists: Playlist[];
}

interface PlaylistResponse {
  playlist: Playlist;
}

interface FavoritesResponse {
  favorites: Track[];
}

interface FavoriteResponse {
  favorite: Track;
}

@Injectable()
export class PlaylistService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private readonly playlistsSubject = new BehaviorSubject<Playlist[]>([]);
  private readonly favoritesSubject = new BehaviorSubject<Track[]>([]);

  readonly playlists$ = this.playlistsSubject.asObservable();
  readonly favorites$ = this.favoritesSubject.asObservable();
  readonly favoriteIds$ = this.favorites$.pipe(
    map((favorites) => new Set(favorites.map((track) => track.id)))
  );

  get playlistsSnapshot(): Playlist[] {
    return this.playlistsSubject.value;
  }

  get favoritesSnapshot(): Track[] {
    return this.favoritesSubject.value;
  }

  loadPlaylists(): Observable<Playlist[]> {
    return this.http.get<PlaylistsResponse>(`${this.apiUrl}/library/playlists`).pipe(
      map((response) => response.playlists),
      tap((playlists) => this.playlistsSubject.next(playlists))
    );
  }

  getPlaylist(id: string): Observable<Playlist> {
    return this.http.get<PlaylistResponse>(`${this.apiUrl}/library/playlists/${id}`).pipe(
      map((response) => response.playlist),
      tap((playlist) => this.upsertPlaylist(playlist))
    );
  }

  createPlaylist(name: string, description?: string): Observable<Playlist> {
    return this.http
      .post<PlaylistResponse>(`${this.apiUrl}/library/playlists`, { name, description })
      .pipe(
        map((response) => response.playlist),
        tap((playlist) => this.playlistsSubject.next([playlist, ...this.playlistsSubject.value]))
      );
  }

  updatePlaylist(id: string, name: string, description?: string): Observable<Playlist> {
    return this.http
      .put<PlaylistResponse>(`${this.apiUrl}/library/playlists/${id}`, { name, description })
      .pipe(
        map((response) => response.playlist),
        tap((playlist) => this.upsertPlaylist(playlist))
      );
  }

  deletePlaylist(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/library/playlists/${id}`).pipe(
      tap(() => {
        const playlists = this.playlistsSubject.value.filter((playlist) => playlist.id !== id);
        this.playlistsSubject.next(playlists);
      })
    );
  }

  addTrackToPlaylist(playlistId: string, track: Track): Observable<Playlist> {
    return this.http
      .post<PlaylistResponse>(`${this.apiUrl}/library/playlists/${playlistId}/tracks`, { track })
      .pipe(
        map((response) => response.playlist),
        tap((playlist) => this.upsertPlaylist(playlist))
      );
  }

  removeTrackFromPlaylist(playlistId: string, trackId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/library/playlists/${playlistId}/tracks/${trackId}`)
      .pipe(
        tap(() => {
          const playlists = this.playlistsSubject.value.map((playlist) => {
            if (playlist.id !== playlistId) {
              return playlist;
            }

            return {
              ...playlist,
              tracks: playlist.tracks.filter((track) => track.id !== trackId)
            };
          });

          this.playlistsSubject.next(playlists);
        })
      );
  }

  loadFavorites(): Observable<Track[]> {
    return this.http.get<FavoritesResponse>(`${this.apiUrl}/library/favorites`).pipe(
      map((response) => response.favorites),
      tap((favorites) => this.favoritesSubject.next(favorites))
    );
  }

  favoriteTrack(track: Track): Observable<Track> {
    return this.http.post<FavoriteResponse>(`${this.apiUrl}/library/favorites`, track).pipe(
      map((response) => response.favorite),
      tap((favorite) => {
        const withoutTrack = this.favoritesSubject.value.filter((item) => item.id !== favorite.id);
        this.favoritesSubject.next([favorite, ...withoutTrack]);
      }),
      switchMap((favorite) => {
        const likedPlaylist = this.playlistsSubject.value.find(
          (p) => p.name.toLowerCase() === 'músicas curtidas'
        );

        if (likedPlaylist) {
          const hasTrack = likedPlaylist.tracks.some((t) => t.id === track.id);
          if (hasTrack) {
            return of(favorite);
          }
          return this.addTrackToPlaylist(likedPlaylist.id, track).pipe(
            map(() => favorite)
          );
        } else {
          return this.createPlaylist('Músicas curtidas').pipe(
            switchMap((newPlaylist) => this.addTrackToPlaylist(newPlaylist.id, track)),
            map(() => favorite)
          );
        }
      })
    );
  }

  unfavoriteTrack(trackId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/library/favorites/${trackId}`).pipe(
      tap(() => {
        const favorites = this.favoritesSubject.value.filter((track) => track.id !== trackId);
        this.favoritesSubject.next(favorites);
      }),
      switchMap(() => {
        const likedPlaylist = this.playlistsSubject.value.find(
          (p) => p.name.toLowerCase() === 'músicas curtidas'
        );

        if (likedPlaylist) {
          const hasTrack = likedPlaylist.tracks.some((t) => t.id === trackId);
          if (hasTrack) {
            return this.removeTrackFromPlaylist(likedPlaylist.id, trackId);
          }
        }
        return of(undefined);
      })
    );
  }

  toggleFavorite(track: Track): Observable<Track | void> {
    const isFavorite = this.favoritesSubject.value.some((favorite) => favorite.id === track.id);

    return isFavorite ? this.unfavoriteTrack(track.id) : this.favoriteTrack(track);
  }

  private upsertPlaylist(playlist: Playlist): void {
    const playlists = this.playlistsSubject.value;
    const index = playlists.findIndex((item) => item.id === playlist.id);

    if (index === -1) {
      this.playlistsSubject.next([playlist, ...playlists]);
      return;
    }

    const next = [...playlists];
    next[index] = playlist;
    this.playlistsSubject.next(next);
  }
}
