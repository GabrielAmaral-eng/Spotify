import type { Track } from '../../types/track';
import { HttpError } from '../../utils/http-error';
import { spotifyHttp } from './spotify-http';
import { tokenService } from './token.service';

interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

interface SpotifyArtist {
  name: string;
}

interface SpotifyAlbum {
  name: string;
  images: SpotifyImage[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  duration_ms: number;
  preview_url: string | null;
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
  };
}

class SpotifyService {
  async searchTracks(query: string): Promise<Track[]> {
    const token = await tokenService.getToken();
    const { data } = await spotifyHttp.get<SpotifySearchResponse>('https://api.spotify.com/v1/search', {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        q: query,
        type: 'track',
        limit: 10
      }
    });

    return data.tracks.items.map((track) => this.normalizeTrack(track));
  }

  async getTrack(id: string): Promise<Track> {
    const token = await tokenService.getToken();
    const { data } = await spotifyHttp.get<SpotifyTrack>(`https://api.spotify.com/v1/tracks/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!data?.id) {
      throw new HttpError('Faixa não encontrada.', 404);
    }

    return this.normalizeTrack(data);
  }

  private normalizeTrack(track: SpotifyTrack): Track {
    const image = track.album.images[0]?.url ?? '';

    return {
      id: track.id,
      source: 'spotify',
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(', '),
      album: track.album.name,
      thumbnail: image,
      duration: Math.round(track.duration_ms / 1000),
      previewUrl: track.preview_url
    };
  }
}

export const spotifyService = new SpotifyService();
