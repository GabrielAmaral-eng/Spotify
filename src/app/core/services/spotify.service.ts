import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Track } from '../../shared/models/track.model';

interface SearchResponse {
  tracks: Track[];
}

interface TrackResponse {
  track: Track;
}

interface AuthorizationUrlResponse {
  authorizeUrl: string;
}

export interface SpotifyConnectionStatus {
  connected: boolean;
  spotifyUserId?: string;
  displayName?: string;
}

export interface SpotifyPlaybackToken {
  accessToken: string;
  expiresIn: number;
}

@Injectable()
export class SpotifyService {
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private readonly http = inject(HttpClient);

  searchTracks(query: string): Observable<Track[]> {
    const params = new HttpParams().set('q', query);

    return this.http
      .get<SearchResponse>(`${this.apiUrl}/spotify/search`, { params })
      .pipe(map((response) => response.tracks));
  }

  getTrack(id: string): Observable<Track> {
    return this.http
      .get<TrackResponse>(`${this.apiUrl}/spotify/track/${id}`)
      .pipe(map((response) => response.track));
  }

  getAuthorizationUrl(): Observable<string> {
    return this.http
      .get<AuthorizationUrlResponse>(`${this.apiUrl}/spotify/auth/login`)
      .pipe(map((response) => response.authorizeUrl));
  }

  getConnectionStatus(): Observable<SpotifyConnectionStatus> {
    return this.http.get<SpotifyConnectionStatus>(`${this.apiUrl}/spotify/auth/status`);
  }

  getPlaybackToken(): Observable<SpotifyPlaybackToken> {
    return this.http.get<SpotifyPlaybackToken>(`${this.apiUrl}/spotify/auth/token`);
  }

  disconnect(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/spotify/auth/connection`);
  }

  playTrack(trackId: string, deviceId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/spotify/player/play`, {
      trackId,
      deviceId
    });
  }
}
