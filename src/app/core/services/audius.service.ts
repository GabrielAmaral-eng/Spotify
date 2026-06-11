import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Track } from '../../shared/models/track.model';

interface SearchResponse {
  tracks: Track[];
  hasMore: boolean;
}

interface TrackResponse {
  track: Track;
}

/** Uma pagina de resultados da busca, com o indicador de proxima pagina. */
export interface TrackSearchPage {
  tracks: Track[];
  hasMore: boolean;
}

@Injectable()
export class AudiusService {
  private readonly apiUrl = environment.apiUrl.replace(/\/$/, '');
  private readonly http = inject(HttpClient);

  searchTracks(query: string, limit: number, offset: number): Observable<TrackSearchPage> {
    const params = new HttpParams()
      .set('q', query)
      .set('limit', String(limit))
      .set('offset', String(offset));

    return this.http
      .get<SearchResponse>(`${this.apiUrl}/audius/search`, { params })
      .pipe(map((response) => ({ tracks: response.tracks, hasMore: response.hasMore })));
  }

  getTrack(id: string): Observable<Track> {
    return this.http
      .get<TrackResponse>(`${this.apiUrl}/audius/track/${id}`)
      .pipe(map((response) => response.track));
  }
}
