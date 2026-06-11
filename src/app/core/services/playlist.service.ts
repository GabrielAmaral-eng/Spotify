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
  /** Nome da playlist especial de músicas curtidas (sempre fixada no topo). */
  private static readonly LIKED_PLAYLIST_NAME = 'músicas curtidas';

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

  /** Indica se a playlist é a de "Músicas curtidas". */
  isLikedPlaylist(playlist: Playlist): boolean {
    return playlist.name.trim().toLowerCase() === PlaylistService.LIKED_PLAYLIST_NAME;
  }

  loadPlaylists(): Observable<Playlist[]> {
    return this.http.get<PlaylistsResponse>(`${this.apiUrl}/library/playlists`).pipe(
      map((response) => response.playlists),
      tap((playlists) => this.emitPlaylists(playlists))
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
        tap((playlist) => this.emitPlaylists([playlist, ...this.playlistsSubject.value]))
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
        this.emitPlaylists(playlists);
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
    const playlist = this.playlistsSubject.value.find((item) => item.id === playlistId);
    const fromLiked = playlist ? this.isLikedPlaylist(playlist) : false;

    return this.removePlaylistTrack(playlistId, trackId).pipe(
      switchMap(() => {
        // Req. 3: remover uma música da playlist de curtidas também remove a curtida.
        if (fromLiked && this.favoritesSubject.value.some((track) => track.id === trackId)) {
          return this.removeFavorite(trackId);
        }
        return of(undefined);
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
        const likedPlaylist = this.playlistsSubject.value.find((p) => this.isLikedPlaylist(p));

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
    return this.removeFavorite(trackId).pipe(
      switchMap(() => {
        const likedPlaylist = this.playlistsSubject.value.find((p) => this.isLikedPlaylist(p));

        if (likedPlaylist && likedPlaylist.tracks.some((t) => t.id === trackId)) {
          return this.removePlaylistTrack(likedPlaylist.id, trackId);
        }
        return of(undefined);
      })
    );
  }

  toggleFavorite(track: Track): Observable<Track | void> {
    const isFavorite = this.favoritesSubject.value.some((favorite) => favorite.id === track.id);

    return isFavorite ? this.unfavoriteTrack(track.id) : this.favoriteTrack(track);
  }

  /**
   * Remove a faixa de uma playlist (HTTP + estado) e, se a playlist ficar
   * vazia, a exclui automaticamente (Req. 2 — vale inclusive para a de
   * "Músicas curtidas", que é recriada quando o usuário curte de novo).
   */
  private removePlaylistTrack(playlistId: string, trackId: string): Observable<void> {
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

          this.emitPlaylists(playlists);
        }),
        switchMap(() => {
          const playlist = this.playlistsSubject.value.find((item) => item.id === playlistId);

          if (playlist && playlist.tracks.length === 0) {
            return this.deletePlaylist(playlistId);
          }

          return of(undefined);
        })
      );
  }

  /** Remove a curtida (HTTP + estado de favoritos). */
  private removeFavorite(trackId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/library/favorites/${trackId}`).pipe(
      tap(() => {
        const favorites = this.favoritesSubject.value.filter((track) => track.id !== trackId);
        this.favoritesSubject.next(favorites);
      })
    );
  }

  private upsertPlaylist(playlist: Playlist): void {
    const playlists = this.playlistsSubject.value;
    const index = playlists.findIndex((item) => item.id === playlist.id);

    if (index === -1) {
      this.emitPlaylists([playlist, ...playlists]);
      return;
    }

    const next = [...playlists];
    next[index] = playlist;
    this.emitPlaylists(next);
  }

  /**
   * Publica a lista de playlists garantindo que "Músicas curtidas" fique
   * fixada no topo (Req. 1), preservando a ordem das demais.
   */
  private emitPlaylists(playlists: Playlist[]): void {
    this.playlistsSubject.next(this.withLikedPinned(playlists));
  }

  private withLikedPinned(playlists: Playlist[]): Playlist[] {
    const index = playlists.findIndex((playlist) => this.isLikedPlaylist(playlist));

    if (index <= 0) {
      return playlists;
    }

    const liked = playlists[index];
    const rest = playlists.filter((_, i) => i !== index);
    return [liked, ...rest];
  }
}
