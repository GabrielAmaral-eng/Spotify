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
}
